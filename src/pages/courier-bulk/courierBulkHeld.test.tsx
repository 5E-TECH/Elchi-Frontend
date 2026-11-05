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

  it("menejer: kuryer qo'lidagi «sotildi» yuborilmaydi va sanalmaydi; bekor / ertaga — odatdagidek", () => {
    const orders = [
      { id: "1", ...COURIER_HELD },
      { id: "2", ...COURIER_HELD },
      { id: "3", ...COURIER_HELD },
      { id: "4", ...BRANCH_HELD },
    ];
    const actions: Record<string, CourierBulkAction> = { "2": "cancel", "3": "tomorrow" };
    expect(getCourierBulkFinalizeTasks(orders, actions, "manager")).toEqual([
      { order: orders[1], action: "cancel" },
      { order: orders[3], action: "sold" },
    ]);
    expect(getCourierBulkCounts(orders, actions, "manager")).toEqual({ cancel: 1, sold: 1, tomorrow: 1, total: 4 });
    expect(getCourierBulkUnmarkedCount(orders, actions, "manager")).toBe(1);
    expect(getCourierBulkKept(orders, actions, "manager")).toEqual({
      tomorrow: [orders[2]],
      replacement: [],
      courierHeld: [orders[0]],
      awaitingPost: [],
    });
    // Kuryerning o'zi uchun hammasi yuboriladi (avvalgidek).
    expect(getCourierBulkFinalizeTasks(orders, actions)).toHaveLength(3);
  });

  it("pochtasi qabul qilinmagan qator — belgidan qat'i nazar so'rovsiz, faqat «Barchasi» filtrida", () => {
    const orders = [
      { id: "1", status: "waiting" },
      { id: "2", ...SCAN_TAKEN },
      { id: "3", ...SCAN_TAKEN },
    ];
    const actions: Record<string, CourierBulkAction> = { "3": "cancel" };
    expect(getCourierBulkFinalizeTasks(orders, actions)).toEqual([{ order: orders[0], action: "sold" }]);
    expect(getCourierBulkCounts(orders, actions)).toEqual({ cancel: 0, sold: 1, tomorrow: 0, total: 3 });
    expect(getCourierBulkUnmarkedCount(orders, actions)).toBe(1);
    expect(getCourierBulkKept(orders, actions).awaitingPost).toEqual([orders[1], orders[2]]);
    const ids = (result: "all" | "sold" | "cancel" | "unmarked") =>
      filterCourierBulkOrders(orders as unknown as CourierBulkOrder[], actions, { query: "", result }).map((item) => item.id);
    expect(ids("all")).toEqual(["1", "2", "3"]);
    expect(ids("sold")).toEqual(["1"]);
    expect(ids("cancel")).toEqual([]);
    expect(ids("unmarked")).toEqual(["1"]);
  });

  it("«Sotiladi» / «Belgilanmagan» filtri bu yerdan sotilmaydiganni chiqarmaydi (menejerda kuryer qo'lidagi)", () => {
    const orders = [
      { id: "1", status: "waiting", ...COURIER_HELD },
      { id: "2", status: "waiting", ...COURIER_HELD },
      { id: "3", status: "waiting", ...BRANCH_HELD },
    ] as unknown as CourierBulkOrder[];
    const actions: Record<string, CourierBulkAction> = { "2": "cancel" };
    const ids = (result: "all" | "sold" | "cancel" | "unmarked", viewer?: "courier" | "manager") =>
      filterCourierBulkOrders(orders, actions, { query: "", result, viewer }).map((item) => item.id);
    expect(ids("sold", "manager")).toEqual(["3"]);
    expect(ids("unmarked", "manager")).toEqual(["3"]);
    expect(ids("cancel", "manager")).toEqual(["2"]);
    expect(ids("all", "manager")).toEqual(["1", "2", "3"]);
    // Kuryerning o'zi uchun — avvalgidek.
    expect(ids("sold")).toEqual(["1", "3"]);
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
    }
    for (const id of cancelIds) await user.click(radio(`Mijoz ${id}`, "Bekor"));
    for (const id of tomorrowIds) await user.click(radio(`Mijoz ${id}`, "Ertaga"));

    const dialog = await finalize(user);
    expect(dialog).toHaveTextContent("30 ta buyurtma: quyidagilar bajariladi");
    expect(dialog).toHaveTextContent("17 ta sotilgan deb belgilanadi");
    expect(dialog).toHaveTextContent("5 ta bekor qilinadi");
    expect(dialog).toHaveTextContent("5 tasi ertaga qoladi");
    expect(dialog).toHaveTextContent("3 ta buyurtma pochtasi qabul qilinmagan");
    expect(within(dialog).getByRole("note")).toHaveTextContent("22 ta buyurtma holati darhol o'zgaradi.");
    const getsBefore = mocks.get.mock.calls.length;
    await user.click(within(dialog).getByRole("button", { name: "Tasdiqlash" }));

    await waitFor(() => expect(mocks.sell).toHaveBeenCalledTimes(17));
    expect(mocks.cancel).toHaveBeenCalledTimes(5);
    const soldIds = mocks.sell.mock.calls.map(([call]) => call.orderId).sort();
    expect(soldIds).toEqual(
      orders.map((item) => item.id).filter((id) => ![...cancelIds, ...tomorrowIds, ...awaitingIds].includes(id)),
    );
    expect(mocks.cancel.mock.calls.map(([call]) => call.orderId).sort()).toEqual(cancelIds);
    expect(await screen.findByText(/22 ta buyurtma muvaffaqiyatli yakunlandi/)).toBeInTheDocument();

    // Ro'yxatda: ertaga qoldirilganlar belgisi bilan (keyingi bosishda sotilib ketmasin), pochtasi qabul
    // qilinmaganlar sababi bilan; bajarilganlar yo'q.
    await waitFor(() => expect(screen.queryByText("Mijoz 127")).not.toBeInTheDocument());
    for (const id of tomorrowIds) expect(radio(`Mijoz ${id}`, "Ertaga")).toBeChecked();
    for (const id of awaitingIds) {
      expect(within(rowOf(`Mijoz ${id}`)).getByTestId("courier-bulk-awaiting-post")).toBeInTheDocument();
    }
    expect(screen.queryByText("Mijoz 101")).not.toBeInTheDocument();
    // Yakunlash paytida ro'yxat har muvaffaqiyatdan keyin qayta so'ralmaydi — oxirida bir marta.
    expect(mocks.get.mock.calls.length - getsBefore).toBeLessThanOrEqual(1);
  });

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
    const dialog = await finalize(user);
    await user.click(within(dialog).getByRole("button", { name: "Tasdiqlash" }));

    const result = await screen.findByRole("dialog", { name: "Yakunlashda xatolik" });
    expect(result).toHaveTextContent("№11 · Vali");
    await user.click(within(result).getByRole("button", { name: "Tushunarli" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Yakunlashda xatolik" })).not.toBeInTheDocument());

    expect(screen.queryByText("Ali")).not.toBeInTheDocument();
    expect(screen.queryByText("Soli")).not.toBeInTheDocument();
    expect(within(rowOf("Vali")).getByTestId("courier-bulk-row-error")).toHaveTextContent(
      "Yakunlanmadi: Buyurtma topilmadi yoki kutilmoqda (waiting) holatida emas",
    );

    // Belgi o'zgartirilsa — eski sabab olib tashlanadi.
    await user.click(radio("Vali", "Ertaga"));
    expect(screen.queryByTestId("courier-bulk-row-error")).not.toBeInTheDocument();
  });

  it("xato oynasi so'rovsiz qoldirilganlarni ham aytadi (ertaga, pochtasi qabul qilinmagan)", async () => {
    respondWith([order("10", "Ali"), order("11", "Vali"), order("12", "Soli", SCAN_TAKEN), order("13", "Gani")]);
    mocks.sell.mockRejectedValue(backendError("Server xatosi"));
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);

    expect(await screen.findByText("Gani")).toBeInTheDocument();
    await user.click(radio("Gani", "Ertaga"));
    const dialog = await finalize(user);
    await user.click(within(dialog).getByRole("button", { name: "Tasdiqlash" }));

    const result = await screen.findByRole("dialog", { name: "Yakunlashda xatolik" });
    expect(result).toHaveTextContent("2 ta buyurtma yakunlanmadi");
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
    const dialog = await finalize(user);
    await scan("tok-10-qr");
    expect(screen.queryByText("Ali bekor qilishga belgilandi")).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Orqaga" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());

    // Oyna yopilgach skan yana ishlaydi.
    await scan("tok-10-qr");
    expect(await screen.findByText("Ali bekor qilishga belgilandi")).toBeInTheDocument();
  });
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
    expect(within(rowOf("Soli")).queryByText("Belgilanmagan")).not.toBeInTheDocument();
    const summary = screen.getByRole("group", { name: "Kun yakuni" });
    expect(summary).toHaveTextContent(/Kutilayotgan\s*3/);
    expect(summary).toHaveTextContent(/Sotiladi\s*2/);
    // Kamera eslatmasi ham faqat sukut «sotildi» qo'llanadiganlarni sanaydi.
    expect(getActiveScanTarget()?.listNote).toBe("Skanerlanmagan 2 ta buyurtma sotilgan deb belgilanadi.");

    const dialog = await finalize(user);
    expect(dialog).toHaveTextContent("2 ta sotilgan deb belgilanadi");
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
    respondWith([order("20", "Ali", COURIER_HELD), order("21", "Vali", COURIER_HELD), order("22", "Soli", BRANCH_HELD)]);
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />, { preloadedState: asManager(true) });

    expect(await screen.findByText("Ali")).toBeInTheDocument();
    expect(within(rowOf("Ali")).getByTestId("courier-bulk-courier-held")).toHaveTextContent(
      "Kuryer qo'lida — uni kuryerning o'zi sotadi",
    );
    expect(within(rowOf("Soli")).queryByTestId("courier-bulk-courier-held")).not.toBeInTheDocument();
    // Sukut «sotildi» qo'llanmaydigan qatorda «Belgilanmagan» belgisi yo'q.
    expect(within(rowOf("Ali")).queryByText("Belgilanmagan")).not.toBeInTheDocument();
    expect(within(rowOf("Soli")).getByText("Belgilanmagan")).toBeInTheDocument();
    expect(getActiveScanTarget()?.listNote).toBe("Skanerlanmagan 1 ta buyurtma sotilgan deb belgilanadi.");
    await user.click(radio("Vali", "Bekor"));
    expect(screen.queryByTestId("courier-bulk-no-permission")).not.toBeInTheDocument();

    const dialog = await finalize(user);
    expect(dialog).toHaveTextContent("1 ta sotilgan deb belgilanadi");
    // «Belgilanmagan» — faqat sukut bo'yicha sotiladigan (filialdagi) qator, kuryer qo'lidagi emas.
    expect(dialog).toHaveTextContent("1 tasi belgilanmagan, sukut bo'yicha");
    expect(dialog).toHaveTextContent("1 ta bekor qilinadi");
    expect(dialog).toHaveTextContent("1 ta buyurtma kuryer qo'lida — sotilmaydi");
    expect(dialog).toHaveTextContent("Kutilmoqda holatida qoladi — uni kuryerning o'zi sotadi");
    await user.click(within(dialog).getByRole("button", { name: "Tasdiqlash" }));

    await waitFor(() => expect(mocks.cancel).toHaveBeenCalledTimes(1));
    expect(mocks.cancel).toHaveBeenCalledWith(expect.objectContaining({ orderId: "21" }));
    await waitFor(() => expect(mocks.sell).toHaveBeenCalledTimes(1));
    expect(mocks.sell).toHaveBeenCalledWith(expect.objectContaining({ orderId: "22" }));
    expect(await screen.findByText(/1 ta buyurtma kuryer qo'lida — ularni kuryerning o'zi sotadi\./)).toBeInTheDocument();
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
    const dialog = await finalize(user);
    await user.click(within(dialog).getByRole("button", { name: "Tasdiqlash" }));
    await waitFor(() => expect(mocks.sell).toHaveBeenCalledWith(expect.objectContaining({ orderId: "20" })));
  });
});
