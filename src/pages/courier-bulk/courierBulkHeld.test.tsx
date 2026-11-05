import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CourierBulkPage from "./index";
import { renderWithProviders } from "../../test/test-utils";
import { getActiveScanTarget, resetScanTargets } from "../../shared/lib/scanner/scanTargets";
import {
  filterCourierBulkOrders,
  getCourierBulkCounts,
  getCourierBulkFinalizeTasks,
  getCourierBulkKept,
  getCourierBulkSellBlock,
  getCourierBulkUnmarkedCount,
  isCourierBulkAwaitingPost,
  getCourierBulkRetryKind,
  withCourierBulkRetry,
  type CourierBulkAction,
  type CourierBulkOrder,
} from "./model/courierBulk";

/**
 * «Tezkor amal»: «30 ta buyurtmadan 20 tasini sotish, 5 tasini bekor qilish, 5 tasini ertaga qoldirish — kunni
 * yakunlasam hammasi yopilmayapti, sotilganlardan nechtasi eski holatiga qaytib qolyapti» (2026-11-05).
 *
 * Sabablar (lokal stekda takrorlangan):
 *  A) kuryer skan bilan olgan, pochtasi qabul qilinmagan posilka (6qypMFeT) ro'yxatga «Kutilayotgan» bilan keladi,
 *     holati ON_THE_ROAD — backend sotishni ham, bekor qilishni ham 400 bilan rad etadi;
 *  B) menejer kuryer qo'lidagi buyurtmani sotmaydi (LC-04, backend 400);
 *  C) xato bergan qator natija oynasi yopilgach belgisiz «Sotildi» bo'lib, o'zgarmagandek ko'rinardi; bajarilganlar
 *     ro'yxat yangilanguncha belgisiz qolardi.
 * Endi A va B uchun so'rov yuborilmaydi (qatorda va tasdiq oynasida sababi), C — qatorda backend sababi, bajarilganlar
 * darhol ro'yxatdan chiqadi.
 *
 * Ega qoidasi (2026-11-05, keyinroq): sukut natija YO'Q — «10 tasini «Sotildi» belgilab yakunlasam, belgilanmagan
 * qolganlari ham sotilib ketyapti». Belgilanmagan qator so'rovsiz kutilmoqda qoladi («Ertaga» kabi); shuning uchun
 * testlarda sotiladiganlar qatordagi «Sotildi» bilan aniq belgilanadi (`markSold`).
 */

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  sell: vi.fn(),
  cancel: vi.fn(),
  feedback: vi.fn(() => Promise.resolve()),
}));

vi.mock("../../shared/api/api", () => ({ api: { get: mocks.get } }));

vi.mock("../../entities/orders", () => ({
  useOrders: () => ({
    SellOrder: { mutateAsync: mocks.sell, isPending: false },
    CancelOrder: { mutateAsync: mocks.cancel, isPending: false },
  }),
}));

vi.mock("../../shared/lib/scanner/feedback", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../shared/lib/scanner/feedback")>()),
  playScanFeedback: mocks.feedback,
}));

const order = (id: string, name: string, over: Record<string, unknown> = {}) => ({
  id,
  status: "waiting",
  total_price: 100000,
  createdAt: "2026-11-04T08:00:00.000Z",
  qr_code_token: `tok-${id}-qr`,
  customer: { name, phone_number: "+998901112233" },
  market: { name: "Baraka Shop" },
  ...over,
});

/** Kuryer skan bilan olgan, pochtasi qabul qilinmagan posilka (6qypMFeT). */
const SCAN_TAKEN = { status: "on the road", holder_type: "COURIER", holder_courier_id: "328" };
/** Kuryer qo'lidagi kutilayotgan buyurtma (menejer ro'yxatida). */
const COURIER_HELD = { holder_type: "COURIER", holder_courier_id: "328", courier_id: "328" };
/** Filialda turgan kutilayotgan buyurtma. */
const BRANCH_HELD = { holder_type: "BRANCH", holder_courier_id: null, courier_id: null };

const page = (orders: unknown[]) => ({ data: { statusCode: 200, data: { data: orders, total: orders.length } } });
const respondWith = (orders: unknown[]) => mocks.get.mockResolvedValue(page(orders));

const backendError = (message: string, status = 400) =>
  Object.assign(new Error(message), { response: { status, data: { message } } });

const asManager = (canSellCancel: boolean) =>
  ({
    role: { id: "295", role: "manager", region: null, name: "Jasur Tursunov" },
    user: { user: { id: "295", role: "manager", can_sell_cancel: canSellCancel } },
  }) as never;

const radio = (name: string, label: "Sotildi" | "Bekor" | "Ertaga") =>
  within(screen.getByRole("radiogroup", { name: `${name}: natija` })).getByRole("radio", { name: label });

const rowOf = (name: string) => screen.getByRole("radiogroup", { name: `${name}: natija` }).closest("tr") as HTMLElement;

/** Sukut natija yo'q (ega 2026-11-05) — sotiladiganlar qatordagi «Sotildi» bilan aniq belgilanadi. */
const markSold = async (user: ReturnType<typeof userEvent.setup>, names: string[]) => {
  for (const name of names) await user.click(radio(name, "Sotildi"));
};

/** Qatorda hech qaysi natija tanlanmagan (belgilanmagan). */
const expectNoResult = (name: string) => {
  for (const label of ["Sotildi", "Bekor", "Ertaga"] as const) expect(radio(name, label)).not.toBeChecked();
};

const finalize = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: /Kunni yakunlash/ }));
  return screen.findByRole("alertdialog", { name: "Kunni yakunlashni tasdiqlang" });
};

const scan = async (value: string) => {
  await act(async () => {
    for (const key of value) fireEvent.keyDown(window, { key });
    fireEvent.keyDown(window, { key: "Enter" });
  });
};

beforeEach(() => {
  resetScanTargets();
  mocks.get.mockReset();
  mocks.sell.mockReset();
  mocks.cancel.mockReset();
  mocks.feedback.mockClear();
  mocks.sell.mockResolvedValue({});
  mocks.cancel.mockResolvedValue({});
});

describe("courierBulk model — yopilmaydigan qatorlar", () => {
  it("pochtasi qabul qilinmagan: holat ON_THE_ROAD (har qanday yozilishda); holatsiz qator — kutilmoqda", () => {
    expect(isCourierBulkAwaitingPost({ status: "on the road" })).toBe(true);
    expect(isCourierBulkAwaitingPost({ status: "ON_THE_ROAD" })).toBe(true);
    expect(isCourierBulkAwaitingPost({ status: "waiting" })).toBe(false);
    expect(isCourierBulkAwaitingPost({ status: "WAITING" })).toBe(false);
    expect(isCourierBulkAwaitingPost({ id: "1" })).toBe(false);
    expect(isCourierBulkAwaitingPost(null)).toBe(false);
  });

  it("sotish bloki: menejerda kuryer qo'lidagi — `courierHeld` (almashtirish ham), kuryerda — almashtirish", () => {
    const held = { id: "1", ...COURIER_HELD };
    expect(getCourierBulkSellBlock(held, "manager")).toBe("courierHeld");
    expect(getCourierBulkSellBlock(held, "courier")).toBeNull();
    expect(getCourierBulkSellBlock(held)).toBeNull();
    expect(getCourierBulkSellBlock({ id: "2", ...BRANCH_HELD }, "manager")).toBeNull();
    // `'0'` — tayinlanmagan pochta sentineli, kuryer emas (backend `normalizeCourierId`).
    expect(getCourierBulkSellBlock({ id: "3", courier_id: "0", holder_type: "BRANCH" }, "manager")).toBeNull();
    const replacement = { ...held, replacement_of_order_id: "81", replacement_state: "awaiting_old_pickup" };
    // Menejer uni «Buyurtmalar»dan ham sotmaydi — sabab «kuryer qo'lida»; kuryer uchun — «Eski mahsulotni oldim».
    expect(getCourierBulkSellBlock(replacement, "manager")).toBe("courierHeld");
    expect(getCourierBulkSellBlock(replacement, "courier")).toBe("replacement");
    expect(getCourierBulkSellBlock({ ...replacement, ...BRANCH_HELD }, "manager")).toBe("replacement");
  });

  it("menejer: kuryer qo'lidagi aniq «sotildi» yuborilmaydi va sanalmaydi; bekor / ertaga — odatdagidek; belgisiz — o'zgarmaydi", () => {
    const orders = [
      { id: "1", ...COURIER_HELD },
      { id: "2", ...COURIER_HELD },
      { id: "3", ...COURIER_HELD },
      { id: "4", ...BRANCH_HELD },
      { id: "5", ...COURIER_HELD },
      { id: "6", ...BRANCH_HELD },
    ];
    // Sukut natija yo'q: «sotildi» faqat aniq belgi bilan; 5 va 6 — belgilanmagan.
    const actions: Record<string, CourierBulkAction> = { "1": "sold", "2": "cancel", "3": "tomorrow", "4": "sold" };
    expect(getCourierBulkFinalizeTasks(orders, actions, "manager")).toEqual([
      { order: orders[1], action: "cancel" },
      { order: orders[3], action: "sold" },
    ]);
    expect(getCourierBulkCounts(orders, actions, "manager")).toEqual({ cancel: 1, sold: 1, tomorrow: 1, total: 6 });
    // Belgilanmaganlar soni kuryer qo'lidagini ham sanaydi — u ham o'zgarmaydi (sotilmaydi).
    expect(getCourierBulkUnmarkedCount(orders, actions)).toBe(2);
    // `courierHeld` — faqat ANIQ «sotildi»; belgisiz kuryer qo'lidagi — `unmarked` guruhida.
    expect(getCourierBulkKept(orders, actions, "manager")).toEqual({
      unmarked: [orders[4], orders[5]],
      tomorrow: [orders[2]],
      replacement: [],
      courierHeld: [orders[0]],
      awaitingPost: [],
    });
    // Kuryerning o'zi uchun aniq belgilanganlarning hammasi yuboriladi (avvalgidek); belgisizlar — yo'q.
    expect(getCourierBulkFinalizeTasks(orders, actions).map((task) => task.order.id)).toEqual(["1", "2", "4"]);
    expect(getCourierBulkCounts(orders, actions)).toEqual({ cancel: 1, sold: 2, tomorrow: 1, total: 6 });
  });

  it("pochtasi qabul qilinmagan qator — belgidan qat'i nazar so'rovsiz, faqat «Barchasi» filtrida", () => {
    const orders = [
      { id: "1", status: "waiting" },
      { id: "2", ...SCAN_TAKEN },
      { id: "3", ...SCAN_TAKEN },
      { id: "4", ...SCAN_TAKEN },
      { id: "5", status: "waiting" },
    ];
    // 2 — belgisiz, 3 — «bekor», 4 — «sotildi»: uchalasi ham so'rovsiz. 5 — kutilayotgan, belgisiz: o'zgarmaydi.
    const actions: Record<string, CourierBulkAction> = { "1": "sold", "3": "cancel", "4": "sold" };
    expect(getCourierBulkFinalizeTasks(orders, actions)).toEqual([{ order: orders[0], action: "sold" }]);
    expect(getCourierBulkCounts(orders, actions)).toEqual({ cancel: 0, sold: 1, tomorrow: 0, total: 5 });
    // Pochtasi qabul qilinmagan belgisiz qator «belgilanmagan»ga kirmaydi (uni belgilab bo'lmaydi, o'z izohi bor).
    expect(getCourierBulkUnmarkedCount(orders, actions)).toBe(1);
    const kept = getCourierBulkKept(orders, actions);
    expect(kept.awaitingPost).toEqual([orders[1], orders[2], orders[3]]);
    expect(kept.unmarked).toEqual([orders[4]]);
    const ids = (result: "all" | "sold" | "cancel" | "unmarked") =>
      filterCourierBulkOrders(orders as unknown as CourierBulkOrder[], actions, { query: "", result }).map((item) => item.id);
    expect(ids("all")).toEqual(["1", "2", "3", "4", "5"]);
    expect(ids("sold")).toEqual(["1"]);
    expect(ids("cancel")).toEqual([]);
    expect(ids("unmarked")).toEqual(["5"]);
  });

  it("«Sotiladi» filtri bu yerdan sotilmaydiganni chiqarmaydi (menejerda kuryer qo'lidagi); «Belgilanmagan» — barcha belgisizlar", () => {
    const orders = [
      { id: "1", status: "waiting", ...COURIER_HELD },
      { id: "2", status: "waiting", ...COURIER_HELD },
      { id: "3", status: "waiting", ...BRANCH_HELD },
      { id: "4", status: "waiting", ...COURIER_HELD },
      { id: "5", status: "waiting", ...BRANCH_HELD },
    ] as unknown as CourierBulkOrder[];
    const actions: Record<string, CourierBulkAction> = { "1": "sold", "2": "cancel", "3": "sold" };
    const ids = (result: "all" | "sold" | "cancel" | "unmarked", viewer?: "courier" | "manager") =>
      filterCourierBulkOrders(orders, actions, { query: "", result, viewer }).map((item) => item.id);
    expect(ids("sold", "manager")).toEqual(["3"]);
    // Belgisiz qator sukut bo'yicha sotilmaydi — kuryer qo'lidagi belgisiz ham «Belgilanmagan»da chiqadi.
    expect(ids("unmarked", "manager")).toEqual(["4", "5"]);
    expect(ids("cancel", "manager")).toEqual(["2"]);
    expect(ids("all", "manager")).toEqual(["1", "2", "3", "4", "5"]);
    // Kuryerning o'zi uchun — avvalgidek.
    expect(ids("sold")).toEqual(["1", "3"]);
    expect(ids("unmarked")).toEqual(["4", "5"]);
  });

  it("qayta yuboriladigan xatolar: 429 va «bajarilmoqda» 409 — kutish; 5xx va javobsiz — server; 4xx — yo'q", () => {
    expect(getCourierBulkRetryKind(backendError("ThrottlerException: Too Many Requests", 429))).toBe("wait");
    expect(
      getCourierBulkRetryKind(
        Object.assign(new Error("409"), { response: { status: 409, data: { code: "IDEMPOTENCY_IN_PROGRESS" } } }),
      ),
    ).toBe("wait");
    expect(
      getCourierBulkRetryKind(
        backendError("Takroriy so'rov: bu amal hozir bajarilmoqda — biroz kuting va holatni tekshiring", 409),
      ),
    ).toBe("wait");
    // Biznes ziddiyati (holat o'zgargan) — qayta yuborilmaydi.
    expect(getCourierBulkRetryKind(backendError("Buyurtma #5 holati o'zgardi — sahifani yangilang", 409))).toBeNull();
    expect(getCourierBulkRetryKind(backendError("Internal server error", 500))).toBe("server");
    expect(getCourierBulkRetryKind(backendError("Buyurtma xizmati vaqtida javob bermadi (timeout)", 504))).toBe("server");
    expect(getCourierBulkRetryKind(Object.assign(new Error("Network Error"), { code: "ERR_NETWORK", request: {} }))).toBe(
      "server",
    );
    expect(getCourierBulkRetryKind(backendError("Faqat kutilayotgan buyurtma sotiladi"))).toBeNull();
    expect(getCourierBulkRetryKind(backendError("Ruxsat yo'q", 403))).toBeNull();
    expect(getCourierBulkRetryKind(new Error("kutilmagan"))).toBeNull();
    expect(getCourierBulkRetryKind(null)).toBeNull();
  });

  it("qayta yuborish: 429 — chegaragacha, 5xx — ko'pi bilan 2 marta, 4xx — darhol", async () => {
    const waits: number[] = [];
    const wait = async (ms: number) => {
      waits.push(ms);
    };
    const tooMany = backendError("ThrottlerException: Too Many Requests", 429);
    const serverError = backendError("Internal server error", 500);

    const flaky = vi.fn().mockRejectedValueOnce(tooMany).mockRejectedValueOnce(serverError).mockResolvedValue("ok");
    await expect(withCourierBulkRetry(flaky, { delays: [1, 2, 3], wait })).resolves.toBe("ok");
    expect(flaky).toHaveBeenCalledTimes(3);
    expect(waits).toEqual([1, 2]);

    const rejected = vi.fn().mockRejectedValue(backendError("Buyurtma topilmadi"));
    await expect(withCourierBulkRetry(rejected, { delays: [1, 2, 3], wait })).rejects.toThrow("Buyurtma topilmadi");
    expect(rejected).toHaveBeenCalledTimes(1);

    waits.length = 0;
    const throttled = vi.fn().mockRejectedValue(tooMany);
    await expect(withCourierBulkRetry(throttled, { delays: [1, 2, 3], wait })).rejects.toBe(tooMany);
    expect(throttled).toHaveBeenCalledTimes(4);
    expect(waits).toEqual([1, 2, 3]);

    waits.length = 0;
    const broken = vi.fn().mockRejectedValue(serverError);
    await expect(withCourierBulkRetry(broken, { delays: [1, 2, 3], serverRetries: 2, wait })).rejects.toBe(serverError);
    expect(broken).toHaveBeenCalledTimes(3);
    expect(waits).toEqual([1, 2]);
  });

  it("vazifalar + qoldirilganlar ro'yxatni to'liq va takrorsiz qoplaydi (har qanday belgi, ikkala rol)", () => {
    const shapes = [{}, COURIER_HELD, BRANCH_HELD, SCAN_TAKEN, { replacement_of_order_id: "9", replacement_state: "awaiting_old_pickup" }];
    const marks: Array<CourierBulkAction | undefined> = [undefined, "sold", "cancel", "tomorrow"];
    const orders = shapes.flatMap((shape, s) => marks.map((_, m) => ({ id: `${s}-${m}`, status: "waiting", ...shape })));
    const actions = Object.fromEntries(
      orders.flatMap((item, index) => (marks[index % marks.length] ? [[item.id, marks[index % marks.length]]] : [])),
    ) as Record<string, CourierBulkAction>;

    for (const viewer of ["courier", "manager"] as const) {
      const sent = getCourierBulkFinalizeTasks(orders, actions, viewer).map((task) => task.order.id);
      const kept = Object.values(getCourierBulkKept(orders, actions, viewer)).flat().map((item) => item.id);
      expect([...sent, ...kept].sort()).toEqual(orders.map((item) => item.id).sort());
      const counts = getCourierBulkCounts(orders, actions, viewer);
      expect(counts.sold + counts.cancel).toBe(sent.length);
    }
  });
});

describe("CourierBulkPage — 30 ta: 20 sotildi, 5 bekor, 5 ertaga", () => {
  it("⭐ 20 ta «sotildi» (3 tasi pochtasi qabul qilinmagan), 5 bekor, 5 ertaga — har biri to'g'ri yakunlanadi", async () => {
    // Foydalanuvchi ssenariysi: 20 tadan 3 tasi skan bilan olingan, pochtasi qabul qilinmagan (holat «yo'lda») —
    // tuzatishgacha ular ham «sotildi» bo'lib ketardi va backend rad etardi (ro'yxatda eski holatida qolardi).
    // Sukut natija yo'q: qolgan 17 tasi qatordagi «Sotildi» bilan aniq belgilanadi; pochtasi qabul qilinmagan 3 tasini
    // belgilab bo'lmaydi.
    const awaitingIds = ["128", "129", "130"];
    const orders = Array.from({ length: 30 }, (_, index) => {
      const id = String(101 + index);
      return order(id, `Mijoz ${id}`, awaitingIds.includes(id) ? SCAN_TAKEN : {});
    });
    const cancelIds = ["101", "102", "103", "104", "105"];
    const tomorrowIds = ["106", "107", "108", "109", "110"];
    mocks.get.mockResolvedValueOnce(page(orders));
    // Yakunlashdan keyin serverda faqat ertaga qoldirilganlar va pochtasi qabul qilinmaganlar qoladi.
    mocks.get.mockResolvedValue(page(orders.filter((item) => [...tomorrowIds, ...awaitingIds].includes(item.id))));
    const user = userEvent.setup();
    const { queryClient } = renderWithProviders(<CourierBulkPage />);
    // Haqiqiy `SellOrder` / `CancelOrder` kabi: javob tarmoqdan keladi (kamida bitta macrotask), keyin ["orders"] eskiradi.
    const succeed = async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      return {};
    };
    mocks.sell.mockImplementation(succeed);
    mocks.cancel.mockImplementation(succeed);

    expect(await screen.findByText("Mijoz 127")).toBeInTheDocument();
    for (const id of awaitingIds) {
      expect(within(rowOf(`Mijoz ${id}`)).getByTestId("courier-bulk-awaiting-post")).toBeInTheDocument();
      expect(radio(`Mijoz ${id}`, "Sotildi")).toBeDisabled();
    }
    const soldIds = orders
      .map((item) => item.id)
      .filter((id) => ![...cancelIds, ...tomorrowIds, ...awaitingIds].includes(id));
    expect(soldIds).toHaveLength(17);
    await markSold(user, soldIds.map((id) => `Mijoz ${id}`));
    for (const id of cancelIds) await user.click(radio(`Mijoz ${id}`, "Bekor"));
    for (const id of tomorrowIds) await user.click(radio(`Mijoz ${id}`, "Ertaga"));
    expect(screen.getByRole("group", { name: "Kun yakuni" })).toHaveTextContent(/Sotiladi\s*17\s*ta/);

    const dialog = await finalize(user);
    expect(dialog).toHaveTextContent("30 ta buyurtma: quyidagilar bajariladi");
    expect(dialog).toHaveTextContent("17 ta sotilgan deb belgilanadi");
    expect(dialog).toHaveTextContent("Sotilgan holatiga o'tadi");
    expect(dialog).toHaveTextContent("5 ta bekor qilinadi");
    expect(dialog).toHaveTextContent("5 tasi ertaga qoladi");
    expect(dialog).toHaveTextContent("3 ta buyurtma pochtasi qabul qilinmagan");
    // Hammasi belgilangan (pochtasi qabul qilinmaganlar «belgilanmagan»ga kirmaydi).
    expect(dialog).not.toHaveTextContent("belgilanmagan");
    expect(within(dialog).getByRole("note")).toHaveTextContent("22 ta buyurtma holati darhol o'zgaradi.");
    const getsBefore = mocks.get.mock.calls.length;
    await user.click(within(dialog).getByRole("button", { name: "Tasdiqlash" }));

    await waitFor(() => expect(mocks.sell).toHaveBeenCalledTimes(17));
    expect(mocks.cancel).toHaveBeenCalledTimes(5);
    expect(mocks.sell.mock.calls.map(([call]) => call.orderId).sort()).toEqual(soldIds);
    expect(mocks.cancel.mock.calls.map(([call]) => call.orderId).sort()).toEqual(cancelIds);
    expect(await screen.findByText(/22 ta buyurtma muvaffaqiyatli yakunlandi/)).toBeInTheDocument();

    // Ro'yxatda: ertaga qoldirilganlar belgisi bilan (kuryer nimani tanlagani ko'rinib tursin), pochtasi qabul
    // qilinmaganlar sababi bilan; bajarilganlar yo'q.
    await waitFor(() => expect(screen.queryByText("Mijoz 127")).not.toBeInTheDocument());
    for (const id of tomorrowIds) expect(radio(`Mijoz ${id}`, "Ertaga")).toBeChecked();
    for (const id of awaitingIds) {
      expect(within(rowOf(`Mijoz ${id}`)).getByTestId("courier-bulk-awaiting-post")).toBeInTheDocument();
    }
    expect(screen.queryByText("Mijoz 101")).not.toBeInTheDocument();
    // Yakunlash paytida ro'yxat har muvaffaqiyatdan keyin qayta so'ralmaydi — oxirida bir marta.
    expect(mocks.get.mock.calls.length - getsBefore).toBeLessThanOrEqual(1);
  }, 30_000);

  it("bajarilganlar ro'yxat yangilanishini kutmasdan chiqadi; xato bergan qatorda backend sababi qoladi", async () => {
    mocks.get.mockResolvedValueOnce(page([order("10", "Ali"), order("11", "Vali"), order("12", "Soli")]));
    // Yangilanish so'rovi javobsiz qoladi — ro'yxat faqat kesh yangilanishi bilan o'zgaradi.
    mocks.get.mockReturnValue(new Promise(() => undefined));
    mocks.sell.mockImplementation(({ orderId }: { orderId: string }) =>
      orderId === "11" ? Promise.reject(backendError("Buyurtma topilmadi yoki kutilmoqda (waiting) holatida emas")) : Promise.resolve({}),
    );
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);

    expect(await screen.findByText("Ali")).toBeInTheDocument();
    await markSold(user, ["Ali", "Vali", "Soli"]);
    const dialog = await finalize(user);
    await user.click(within(dialog).getByRole("button", { name: "Tasdiqlash" }));

    const result = await screen.findByRole("dialog", { name: "Yakunlashda xatolik" });
    expect(result).toHaveTextContent("№11 · Vali");
    await user.click(within(result).getByRole("button", { name: "Tushunarli" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Yakunlashda xatolik" })).not.toBeInTheDocument());

    expect(mocks.sell).toHaveBeenCalledTimes(3);
    expect(screen.queryByText("Ali")).not.toBeInTheDocument();
    expect(screen.queryByText("Soli")).not.toBeInTheDocument();
    expect(within(rowOf("Vali")).getByTestId("courier-bulk-row-error")).toHaveTextContent(
      "Yakunlanmadi: Buyurtma topilmadi yoki kutilmoqda (waiting) holatida emas",
    );
    // Xato bergan qator o'z «Sotildi» belgisini saqlaydi (belgisiz bo'lib qolmaydi).
    expect(radio("Vali", "Sotildi")).toBeChecked();

    // Belgi o'zgartirilsa — eski sabab olib tashlanadi.
    await user.click(radio("Vali", "Ertaga"));
    expect(screen.queryByTestId("courier-bulk-row-error")).not.toBeInTheDocument();
  });

  it("xato oynasi so'rovsiz qoldirilganlarni ham aytadi (belgilanmagan, ertaga, pochtasi qabul qilinmagan)", async () => {
    respondWith([
      order("10", "Ali"),
      order("11", "Vali"),
      order("12", "Soli", SCAN_TAKEN),
      order("13", "Gani"),
      order("14", "Hasan"),
    ]);
    mocks.sell.mockRejectedValue(backendError("Server xatosi"));
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);

    expect(await screen.findByText("Gani")).toBeInTheDocument();
    await markSold(user, ["Ali", "Vali"]);
    await user.click(radio("Gani", "Ertaga"));
    // Hasan belgilanmagan — so'rov ketmaydi, o'zgarmaydi.
    const dialog = await finalize(user);
    await user.click(within(dialog).getByRole("button", { name: "Tasdiqlash" }));

    const result = await screen.findByRole("dialog", { name: "Yakunlashda xatolik" });
    expect(mocks.sell.mock.calls.map(([call]) => call.orderId).sort()).toEqual(["10", "11"]);
    expect(mocks.cancel).not.toHaveBeenCalled();
    expect(result).toHaveTextContent("2 ta buyurtma yakunlanmadi");
    expect(result).toHaveTextContent("1 ta belgilanmagan buyurtma o'zgarmadi.");
    expect(result).toHaveTextContent("1 ta buyurtma ertaga qoldirildi.");
    expect(result).toHaveTextContent("1 ta buyurtma pochtasi qabul qilinmagan — «Pochta»da qabul qilgach yakunlang.");
    expect(result).not.toHaveTextContent("muvaffaqiyatli yakunlandi");
  });

  it("429 bo'lgan sotish kutib qayta yuboriladi va o'tadi (xato oynasisiz)", async () => {
    respondWith([order("10", "Ali"), order("11", "Vali")]);
    let calls = 0;
    mocks.sell.mockImplementation(({ orderId }: { orderId: string }) => {
      if (orderId === "11" && calls++ === 0) return Promise.reject(backendError("ThrottlerException: Too Many Requests", 429));
      return Promise.resolve({});
    });
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);

    expect(await screen.findByText("Ali")).toBeInTheDocument();
    await markSold(user, ["Ali", "Vali"]);
    const dialog = await finalize(user);
    await user.click(within(dialog).getByRole("button", { name: "Tasdiqlash" }));

    // Birinchi kutish — 2 s (COURIER_BULK_RETRY_DELAYS_MS[0]).
    await waitFor(() => expect(mocks.sell).toHaveBeenCalledTimes(3), { timeout: 6000 });
    expect(mocks.sell.mock.calls.filter(([call]) => call.orderId === "11")).toHaveLength(2);
    expect(await screen.findByText(/2 ta buyurtma muvaffaqiyatli yakunlandi/)).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Yakunlashda xatolik" })).not.toBeInTheDocument();
  }, 15_000);

  it("500 (yuklama) bo'lgan sotish ayni Idempotency-Key bilan qayta yuboriladi va o'tadi", async () => {
    respondWith([order("10", "Ali"), order("11", "Vali")]);
    let failed = false;
    mocks.sell.mockImplementation(({ orderId }: { orderId: string }) => {
      if (orderId === "10" && !failed) {
        failed = true;
        return Promise.reject(backendError("Internal server error", 500));
      }
      return Promise.resolve({});
    });
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);

    expect(await screen.findByText("Ali")).toBeInTheDocument();
    await markSold(user, ["Ali", "Vali"]);
    const dialog = await finalize(user);
    await user.click(within(dialog).getByRole("button", { name: "Tasdiqlash" }));

    await waitFor(() => expect(mocks.sell).toHaveBeenCalledTimes(3), { timeout: 6000 });
    const keyOf = (id: string) =>
      mocks.sell.mock.calls.filter(([call]) => call.orderId === id).map(([call]) => call.headers["Idempotency-Key"]);
    const [first, retry] = keyOf("10");
    expect(first).toMatch(/^courier-bulk:[^:]+:sold:10$/);
    expect(retry).toBe(first);
    expect(keyOf("11")).toHaveLength(1);
    expect(keyOf("11")[0]).not.toBe(first);
    expect(await screen.findByText(/2 ta buyurtma muvaffaqiyatli yakunlandi/)).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Yakunlashda xatolik" })).not.toBeInTheDocument();
  }, 15_000);

  it("tasdiq oynasi ochiq turganda skan belgini o'zgartirmaydi (yuboriladiganlar oyna ochilganda olingan)", async () => {
    respondWith([order("10", "Ali"), order("11", "Vali")]);
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);

    expect(await screen.findByText("Ali")).toBeInTheDocument();
    // Oyna ochilishi uchun yuboriladigan buyurtma kerak — Vali aniq «Sotildi»; Ali belgilanmagan.
    await markSold(user, ["Vali"]);
    const dialog = await finalize(user);
    await scan("tok-10-qr");
    expect(screen.queryByText("Ali bekor qilishga belgilandi")).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Orqaga" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expectNoResult("Ali");

    // Oyna yopilgach skan yana ishlaydi.
    await scan("tok-10-qr");
    expect(await screen.findByText("Ali bekor qilishga belgilandi")).toBeInTheDocument();
    expect(radio("Ali", "Bekor")).toBeChecked();
  });
});

describe("CourierBulkPage — sukut natija yo'q (ega 2026-11-05)", () => {
  it("⭐ 25 ta: 10 sotildi, 5 bekor, 5 ertaga, 5 belgilanmagan — faqat belgilanganlar yakunlanadi, belgisizlar o'zgarmaydi", async () => {
    // Ega shikoyati: «20 ta buyurtmadan 5 tasi bekor, 5 tasi ertaga, 10 tasi sotildi — shu 10 tani belgilab kunni
    // yakunlasam, qolganlari ham sotildi bo'lib ketyapti» (sukut «Sotildi» edi). Endi belgisiz qator so'rovsiz,
    // kutilmoqda holatida qoladi — xuddi «Ertaga» kabi.
    const orders = Array.from({ length: 25 }, (_, index) => order(String(201 + index), `Mijoz ${201 + index}`));
    const ids = orders.map((item) => item.id);
    const soldIds = ids.slice(0, 10);
    const cancelIds = ids.slice(10, 15);
    const tomorrowIds = ids.slice(15, 20);
    const unmarkedIds = ids.slice(20);
    mocks.get.mockResolvedValueOnce(page(orders));
    // Yakunlashdan keyin serverda ertaga qoldirilganlar va belgilanmaganlar qoladi (kutilmoqda).
    mocks.get.mockResolvedValue(page(orders.filter((item) => [...tomorrowIds, ...unmarkedIds].includes(item.id))));
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);

    expect(await screen.findByText("Mijoz 225")).toBeInTheDocument();
    // Hech bir qator oldindan «Sotildi»da (yoki boshqa natijada) turmaydi.
    for (const id of ids) expectNoResult(`Mijoz ${id}`);
    const summary = screen.getByRole("group", { name: "Kun yakuni" });
    expect(summary).toHaveTextContent(/Sotiladi\s*0\s*ta/);
    expect(summary).toHaveTextContent(/Belgilanmagan: 25 ta — o'zgarmaydi/);

    await markSold(user, soldIds.map((id) => `Mijoz ${id}`));
    for (const id of cancelIds) await user.click(radio(`Mijoz ${id}`, "Bekor"));
    for (const id of tomorrowIds) await user.click(radio(`Mijoz ${id}`, "Ertaga"));
    expect(summary).toHaveTextContent(/Sotiladi\s*10\s*ta/);
    expect(summary).toHaveTextContent(/Belgilanmagan: 5 ta — o'zgarmaydi/);
    for (const id of unmarkedIds) {
      expectNoResult(`Mijoz ${id}`);
      expect(within(rowOf(`Mijoz ${id}`)).getByText("Belgilanmagan")).toBeInTheDocument();
    }

    const dialog = await finalize(user);
    expect(dialog).toHaveTextContent("25 ta buyurtma: quyidagilar bajariladi");
    expect(dialog).toHaveTextContent(/(?<!\d)10 ta sotilgan deb belgilanadi/);
    expect(dialog).toHaveTextContent("Sotilgan holatiga o'tadi");
    expect(dialog).toHaveTextContent(/(?<!\d)5 ta bekor qilinadi/);
    expect(dialog).toHaveTextContent(/(?<!\d)5 tasi ertaga qoladi/);
    expect(dialog).toHaveTextContent(/(?<!\d)5 tasi belgilanmagan — o'zgarmaydi/);
    expect(within(dialog).getByRole("note")).toHaveTextContent("15 ta buyurtma holati darhol o'zgaradi.");
    await user.click(within(dialog).getByRole("button", { name: "Tasdiqlash" }));

    await waitFor(() => expect(mocks.sell).toHaveBeenCalledTimes(10));
    await waitFor(() => expect(mocks.cancel).toHaveBeenCalledTimes(5));
    expect(mocks.sell.mock.calls.map(([call]) => call.orderId).sort()).toEqual(soldIds);
    expect(mocks.cancel.mock.calls.map(([call]) => call.orderId).sort()).toEqual(cancelIds);
    // Belgilanmagan va «Ertaga» qatorlar uchun hech qanday so'rov yo'q.
    const requested = [...mocks.sell.mock.calls, ...mocks.cancel.mock.calls].map(([call]) => call.orderId);
    for (const id of [...unmarkedIds, ...tomorrowIds]) expect(requested).not.toContain(id);
    const success = /(?<!\d)15 ta buyurtma muvaffaqiyatli yakunlandi 5 ta belgilanmagan buyurtma o'zgarmadi\./;
    expect(await screen.findByText(success)).toBeInTheDocument();
    expect(mocks.sell).toHaveBeenCalledTimes(10);
    expect(mocks.cancel).toHaveBeenCalledTimes(5);

    // Ro'yxat: sotilgan / bekor qilinganlar chiqdi; belgilanmaganlar «Belgilanmagan» bilan, ertaga — belgisi bilan.
    await waitFor(() => expect(screen.queryByText("Mijoz 201")).not.toBeInTheDocument());
    for (const id of [...soldIds, ...cancelIds]) expect(screen.queryByText(`Mijoz ${id}`)).not.toBeInTheDocument();
    for (const id of unmarkedIds) {
      expectNoResult(`Mijoz ${id}`);
      expect(within(rowOf(`Mijoz ${id}`)).getByText("Belgilanmagan")).toBeInTheDocument();
    }
    for (const id of tomorrowIds) expect(radio(`Mijoz ${id}`, "Ertaga")).toBeChecked();
  }, 30_000);
});

describe("CourierBulkPage — pochtasi qabul qilinmagan posilka (kuryer)", () => {
  beforeEach(() => {
    respondWith([order("10", "Ali"), order("11", "Vali"), order("12", "Soli", SCAN_TAKEN)]);
  });

  it("⭐ qatorda sabab, natija o'chiq; tasdiq oynasi aytadi; so'rov faqat kutilayotganlarga", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);

    expect(await screen.findByText("Soli")).toBeInTheDocument();
    expect(within(rowOf("Soli")).getByTestId("courier-bulk-awaiting-post")).toHaveTextContent(
      "Pochta hali qabul qilinmagan — avval «Pochta»da qabul qiling",
    );
    expect(radio("Soli", "Bekor")).toBeDisabled();
    expect(radio("Soli", "Sotildi")).toBeDisabled();
    expect(within(rowOf("Soli")).queryByText("Belgilanmagan")).not.toBeInTheDocument();
    // Sukut natija yo'q: kutilayotganlar belgilanmagan, «Sotiladi» — 0.
    expectNoResult("Ali");
    expectNoResult("Vali");
    expect(within(rowOf("Ali")).getByText("Belgilanmagan")).toBeInTheDocument();
    const summary = screen.getByRole("group", { name: "Kun yakuni" });
    expect(summary).toHaveTextContent(/Kutilayotgan\s*3/);
    expect(summary).toHaveTextContent(/Sotiladi\s*0\s*ta/);
    expect(summary).toHaveTextContent("Belgilanmagan: 2 ta — o'zgarmaydi");
    // Kamera eslatmasi belgilanmaganlarni sanaydi (pochtasi qabul qilinmagani kirmaydi) — ular o'zgarmaydi.
    expect(getActiveScanTarget()?.listNote).toBe("Belgilanmagan 2 ta buyurtma o'zgarmaydi.");

    await markSold(user, ["Ali"]);
    // Belgilanmagan qatorda «Sotildi» bosilsa — oddiy tanlov kabi aniq belgi qo'yiladi.
    expect(radio("Ali", "Sotildi")).toBeChecked();
    expectNoResult("Vali");
    expect(getActiveScanTarget()?.listNote).toBe("Belgilanmagan 1 ta buyurtma o'zgarmaydi.");
    await markSold(user, ["Vali"]);
    expect(summary).toHaveTextContent(/Sotiladi\s*2\s*ta/);
    expect(within(rowOf("Ali")).queryByText("Belgilanmagan")).not.toBeInTheDocument();

    const dialog = await finalize(user);
    expect(dialog).toHaveTextContent("2 ta sotilgan deb belgilanadi");
    expect(dialog).not.toHaveTextContent("belgilanmagan");
    expect(dialog).toHaveTextContent("1 ta buyurtma pochtasi qabul qilinmagan");
    expect(dialog).toHaveTextContent("O'zgarmaydi — avval «Pochta»da pochtani qabul qiling");
    expect(dialog).not.toHaveTextContent("ertaga qoladi");
    await user.click(within(dialog).getByRole("button", { name: "Tasdiqlash" }));

    await waitFor(() => expect(mocks.sell).toHaveBeenCalledTimes(2));
    expect(mocks.sell).not.toHaveBeenCalledWith(expect.objectContaining({ orderId: "12" }));
    expect(mocks.cancel).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/1 ta buyurtma pochtasi qabul qilinmagan — «Pochta»da qabul qilgach yakunlang\./),
    ).toBeInTheDocument();
    expect(mocks.sell).toHaveBeenCalledTimes(2);
  });

  it("skan: pochtasi qabul qilinmagan posilka belgilanmaydi, ogohlantirish chiqadi", async () => {
    renderWithProviders(<CourierBulkPage />);

    expect(await screen.findByText("Soli")).toBeInTheDocument();
    await scan("tok-12-qr");
    expect(await screen.findByText("Pochta hali qabul qilinmagan")).toBeInTheDocument();
    expect(radio("Soli", "Bekor")).not.toBeChecked();
    expect(mocks.feedback).toHaveBeenCalledWith("error", "Pochta hali qabul qilinmagan — avval «Pochta»da qabul qiling");
  });

  it("faqat pochtasi qabul qilinmaganlar qolsa — so'rov yo'q, sababi aytiladi", async () => {
    respondWith([order("12", "Soli", SCAN_TAKEN)]);
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);

    expect(await screen.findByText("Soli")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Kunni yakunlash/ }));
    expect(await screen.findByText(/Yakunlanadigan buyurtma yo'q\. 1 ta buyurtma pochtasi qabul qilinmagan/)).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(mocks.sell).not.toHaveBeenCalled();
  });
});

describe("CourierBulkPage — menejer (LC-04)", () => {
  it("⭐ kuryer qo'lidagi «sotildi» yuborilmaydi (sababi qatorda va oynada); bekor qilish va filialdagini sotish — yuboriladi", async () => {
    respondWith([
      order("20", "Ali", COURIER_HELD),
      order("21", "Vali", COURIER_HELD),
      order("22", "Soli", BRANCH_HELD),
      order("23", "Gani", COURIER_HELD),
    ]);
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />, { preloadedState: asManager(true) });

    expect(await screen.findByText("Ali")).toBeInTheDocument();
    expect(within(rowOf("Ali")).getByTestId("courier-bulk-courier-held")).toHaveTextContent(
      "Kuryer qo'lida — uni kuryerning o'zi sotadi",
    );
    expect(within(rowOf("Soli")).queryByTestId("courier-bulk-courier-held")).not.toBeInTheDocument();
    // Sukut natija yo'q: belgisiz qatorlarning hammasida (kuryer qo'lidagida ham) «Belgilanmagan» belgisi bor.
    expect(within(rowOf("Ali")).getByText("Belgilanmagan")).toBeInTheDocument();
    expect(within(rowOf("Soli")).getByText("Belgilanmagan")).toBeInTheDocument();
    expectNoResult("Ali");
    expect(getActiveScanTarget()?.listNote).toBe("Belgilanmagan 4 ta buyurtma o'zgarmaydi.");
    // Ali — kuryer qo'lida, aniq «Sotildi» (yuborilmaydi); Vali — bekor; Soli — filialda, aniq «Sotildi»;
    // Gani — kuryer qo'lida, belgilanmagan (o'zgarmaydi).
    await markSold(user, ["Ali", "Soli"]);
    await user.click(radio("Vali", "Bekor"));
    expect(screen.queryByTestId("courier-bulk-no-permission")).not.toBeInTheDocument();
    expect(within(rowOf("Ali")).queryByText("Belgilanmagan")).not.toBeInTheDocument();
    expect(within(rowOf("Gani")).getByText("Belgilanmagan")).toBeInTheDocument();

    const dialog = await finalize(user);
    expect(dialog).toHaveTextContent("1 ta sotilgan deb belgilanadi");
    expect(dialog).toHaveTextContent("Sotilgan holatiga o'tadi");
    expect(dialog).toHaveTextContent("1 ta bekor qilinadi");
    // «Kuryer qo'lida» — faqat aniq «Sotildi» belgilangani (Ali); belgisiz Gani — «belgilanmagan».
    expect(dialog).toHaveTextContent("1 ta buyurtma kuryer qo'lida — sotilmaydi");
    expect(dialog).toHaveTextContent("Kutilmoqda holatida qoladi — uni kuryerning o'zi sotadi");
    expect(dialog).toHaveTextContent("1 tasi belgilanmagan — o'zgarmaydi");
    await user.click(within(dialog).getByRole("button", { name: "Tasdiqlash" }));

    await waitFor(() => expect(mocks.cancel).toHaveBeenCalledTimes(1));
    expect(mocks.cancel).toHaveBeenCalledWith(expect.objectContaining({ orderId: "21" }));
    await waitFor(() => expect(mocks.sell).toHaveBeenCalledTimes(1));
    expect(mocks.sell).toHaveBeenCalledWith(expect.objectContaining({ orderId: "22" }));
    expect(await screen.findByText(/1 ta buyurtma kuryer qo'lida — ularni kuryerning o'zi sotadi\./)).toBeInTheDocument();
    expect(screen.getByText(/1 ta belgilanmagan buyurtma o'zgarmadi\./)).toBeInTheDocument();
    // Yakun tugagach: jami aniq 1 bekor, 1 sotish — kuryer qo'lidagi Ali va belgisiz Gani uchun so'rov yo'q.
    expect(mocks.cancel).toHaveBeenCalledTimes(1);
    expect(mocks.sell).toHaveBeenCalledTimes(1);
    const requested = [...mocks.sell.mock.calls, ...mocks.cancel.mock.calls].map(([call]) => call.orderId);
    expect(requested).not.toContain("20");
    expect(requested).not.toContain("23");
  });

  it("sotish/bekor ruxsati yo'q menejer — ogohlantirish, «Kunni yakunlash» o'chiq", async () => {
    respondWith([order("22", "Soli", BRANCH_HELD)]);
    renderWithProviders(<CourierBulkPage />, { preloadedState: asManager(false) });

    expect(await screen.findByText("Soli")).toBeInTheDocument();
    expect(screen.getByTestId("courier-bulk-no-permission")).toHaveTextContent("Sotish va bekor qilish ruxsati yo'q");
    expect(screen.getByRole("button", { name: /Kunni yakunlash/ })).toBeDisabled();
  });

  it("kuryerning o'zi uchun kuryer qo'lidagi buyurtma odatdagidek sotiladi", async () => {
    respondWith([order("20", "Ali", COURIER_HELD)]);
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);

    expect(await screen.findByText("Ali")).toBeInTheDocument();
    expect(screen.queryByTestId("courier-bulk-courier-held")).not.toBeInTheDocument();
    await markSold(user, ["Ali"]);
    const dialog = await finalize(user);
    await user.click(within(dialog).getByRole("button", { name: "Tasdiqlash" }));
    await waitFor(() => expect(mocks.sell).toHaveBeenCalledWith(expect.objectContaining({ orderId: "20" })));
  });
});
