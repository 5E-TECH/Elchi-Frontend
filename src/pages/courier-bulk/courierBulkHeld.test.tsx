import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CourierBulkPage from "./index";
import { renderWithProviders } from "../../test/test-utils";
import { getActiveScanTarget, resetScanTargets } from "../../shared/lib/scanner/scanTargets";
import {
  COURIER_BULK_CHUNK_SIZE,
  filterCourierBulkOrders,
  getCourierBulkCounts,
  getCourierBulkFinalizeTasks,
  getCourierBulkKept,
  getCourierBulkSellBlock,
  getCourierBulkUnmarkedCount,
  getCourierBulkRetryKind,
  runCourierBulkAction,
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
 *     holati ON_THE_ROAD — backend sotishni ham, bekor qilishni ham 400 bilan rad etadi. COURIER-SCAN (ega,
 *     2026-11-17): skan = qabul — skan bilan olingan posilka darhol WAITING, to'siq olib tashlandi (to'siqsiz
 *     belgilanadi va yuboriladi);
 *  B) menejer kuryer qo'lidagi buyurtmani sotolmasdi (LC-04, backend 400). 2026-11-21 dan backend uni KURYER NOMIDAN
 *     sotadi (pul kuryer kassasi orqali) — FE to'siqni olib tashladi, tasdiq oynasida menejerga izoh;
 *  C) xato bergan qator natija oynasi yopilgach belgisiz «Sotildi» bo'lib, o'zgarmagandek ko'rinardi; bajarilganlar
 *     ro'yxat yangilanguncha belgisiz qolardi. Endi qatorda backend sababi, bajarilganlar darhol ro'yxatdan chiqadi.
 *
 * BeePost modeli (ega 2026-11-21, 2026-11-05 dagi «sukut yo'q» qarori bekor): belgilanmagan qator — sukut «Sotildi»
 * (qatorda «Sotildi» tanlangan ko'rinadi, «Belgilanmagan» belgisi bilan). Kuryer faqat «Bekor» va «Ertaga»ni
 * belgilaydi; tasdiq oynasida belgilanmaganlar sotilishi belgilash katagi bilan tasdiqlanadi. Isbotsizlar BULK so'rov
 * bilan ketadi (avval bekorlar, keyin sotuvlar; 20 tadan bo'lak, ketma-ket, bitta yakunlash kaliti).
 */

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  sell: vi.fn(),
  cancel: vi.fn(),
  bulk: vi.fn(),
  feedback: vi.fn(() => Promise.resolve()),
}));

vi.mock("../../shared/api/api", () => ({ api: { get: mocks.get } }));

vi.mock("../../entities/orders", () => ({
  useOrders: () => ({
    SellOrder: { mutateAsync: mocks.sell, isPending: false },
    CancelOrder: { mutateAsync: mocks.cancel, isPending: false },
    BulkOrderAction: { mutateAsync: mocks.bulk, isPending: false },
  }),
}));

vi.mock("../../shared/lib/scanner/feedback", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../shared/lib/scanner/feedback")>()),
  playScanFeedback: mocks.feedback,
}));

type BulkCall = { action: "sold" | "cancel"; orderIds: string[]; comment?: string; headers?: Record<string, string> };
type BulkFailure = { order_id: string; status_code: number; message: string };

const bulkCalls = () => mocks.bulk.mock.calls.map(([call]) => call as BulkCall);
const bulkSummary = () => bulkCalls().map(({ action, orderIds }) => [action, orderIds]);

/** Server javobi (`POST /orders/bulk/*`): berilgan `failed` dan tashqari hammasi bajarildi. */
const bulkBody = ({ action, orderIds }: BulkCall, failed: BulkFailure[] = []) => {
  const failedIds = new Set(failed.map((failure) => failure.order_id));
  return {
    statusCode: 200,
    data: {
      action,
      total: orderIds.length,
      succeeded: orderIds.filter((orderId) => !failedIds.has(orderId)),
      failed: failed.filter((failure) => orderIds.includes(failure.order_id)),
    },
  };
};

/** Bitta yakunlashning bulk kaliti (bo'laklarga ayni). */
const RUN_KEY = /^courier-bulk:[^:]+$/;

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

/** Kuryer skan bilan olgan posilka — COURIER-SCAN: skan = qabul, darhol «Kutilmoqda» va kuryerda. */
const SCAN_TAKEN = { status: "waiting", holder_type: "COURIER", holder_courier_id: "328", courier_id: "328" };
/** Kuryer qo'lidagi kutilayotgan buyurtma (menejer ro'yxatida). */
const COURIER_HELD = { holder_type: "COURIER", holder_courier_id: "328", courier_id: "328" };
/** Filialda turgan kutilayotgan buyurtma. */
const BRANCH_HELD = { holder_type: "BRANCH", holder_courier_id: null, courier_id: null };
/** Eski mahsulot olinmagan almashtirish (lQjt6sKP) — bu yerdan sotilmaydi. */
const AWAITING = { replacement_of_order_id: "81", replacement_state: "awaiting_old_pickup" };

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

/** Belgilanmagan qator: sukut «Sotildi» tanlangan ko'rinadi, qatorda «Belgilanmagan» belgisi (ular sotiladi). */
const expectUnmarked = (name: string) => {
  expect(radio(name, "Sotildi")).toBeChecked();
  expect(radio(name, "Bekor")).not.toBeChecked();
  expect(radio(name, "Ertaga")).not.toBeChecked();
  expect(within(rowOf(name)).getByText("Belgilanmagan")).toBeInTheDocument();
};

const finalize = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: /Kunni yakunlash/ }));
  return screen.findByRole("alertdialog", { name: "Kunni yakunlashni tasdiqlang" });
};

/** «Belgilanmagan N ta buyurtma SOTILISHINI tushunaman» katagi (bo'lsa) belgilanadi, keyin «Tasdiqlash». */
const confirmDialog = async (user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement) => {
  const acknowledge = within(dialog).queryByRole("checkbox", { name: /SOTILISHINI tushunaman/ });
  if (acknowledge) await user.click(acknowledge);
  await user.click(within(dialog).getByRole("button", { name: "Tasdiqlash" }));
};

const scan = async (value: string) => {
  await act(async () => {
    for (const key of value) fireEvent.keyDown(window, { key });
    fireEvent.keyDown(window, { key: "Enter" });
  });
};

beforeEach(() => {
  resetScanTargets();
  // Belgilar `localStorage` da saqlanadi — testlar bir-biriga belgi qoldirmasin.
  localStorage.clear();
  mocks.get.mockReset();
  mocks.sell.mockReset();
  mocks.cancel.mockReset();
  mocks.bulk.mockReset();
  mocks.feedback.mockClear();
  mocks.sell.mockResolvedValue({});
  mocks.cancel.mockResolvedValue({});
  mocks.bulk.mockImplementation((call: BulkCall) => Promise.resolve(bulkBody(call)));
});

describe("courierBulk model — yopilmaydigan qatorlar", () => {
  it("sotish bloki — faqat almashtirish; kuryer qo'lidagi endi to'silmaydi (LC-04, 2026-11-21: kuryer nomidan sotiladi)", () => {
    const held = { id: "1", ...COURIER_HELD };
    expect(getCourierBulkSellBlock(held)).toBeNull();
    expect(getCourierBulkSellBlock({ id: "2", ...BRANCH_HELD })).toBeNull();
    // `'0'` — tayinlanmagan pochta sentineli, kuryer emas (backend `normalizeCourierId`).
    expect(getCourierBulkSellBlock({ id: "3", courier_id: "0", holder_type: "BRANCH" })).toBeNull();
    const replacement = { ...held, ...AWAITING };
    // Kuryer qo'lidagi almashtirish ham — yagona sabab «Eski mahsulotni oldim».
    expect(getCourierBulkSellBlock(replacement)).toBe("replacement");
    expect(getCourierBulkSellBlock({ ...replacement, ...BRANCH_HELD })).toBe("replacement");
    expect(getCourierBulkSellBlock({ ...replacement, replacement_state: "old_collected" })).toBeNull();
  });

  it("kuryer qo'lidagi «sotildi» (aniq yoki belgisiz) yuboriladi va sanaladi; bekor / ertaga — odatdagidek", () => {
    const orders = [
      { id: "1", ...COURIER_HELD },
      { id: "2", ...COURIER_HELD },
      { id: "3", ...COURIER_HELD },
      { id: "4", ...BRANCH_HELD },
      { id: "5", ...COURIER_HELD },
      { id: "6", ...BRANCH_HELD },
    ];
    // 5 va 6 — belgilanmagan: sukut «sotildi».
    const actions: Record<string, CourierBulkAction> = { "1": "sold", "2": "cancel", "3": "tomorrow", "4": "sold" };
    expect(getCourierBulkFinalizeTasks(orders, actions)).toEqual([
      { order: orders[0], action: "sold" },
      { order: orders[1], action: "cancel" },
      { order: orders[3], action: "sold" },
      { order: orders[4], action: "sold" },
      { order: orders[5], action: "sold" },
    ]);
    expect(getCourierBulkCounts(orders, actions)).toEqual({ cancel: 1, sold: 4, tomorrow: 1, total: 6 });
    // «Belgilanmagan» — belgi qo'yilmaganlar (kuryer qo'lidagi ham); ular ham sotiladi.
    expect(getCourierBulkUnmarkedCount(orders, actions)).toBe(2);
    // So'rovsiz faqat «ertaga» qoladi — kuryer qo'lidagi uchun alohida guruh yo'q.
    expect(getCourierBulkKept(orders, actions)).toEqual({ tomorrow: [orders[2]], replacement: [] });
  });

  it("COURIER-SCAN: skan bilan olingan (kutilmoqda, kuryerda) qator — to'siqsiz: belgilanadi, yuboriladi, filtrlarda", () => {
    const orders = [
      { id: "1", status: "waiting" },
      { id: "2", ...SCAN_TAKEN },
      { id: "3", ...SCAN_TAKEN },
      // Deploy oynasidagi eski qator (hali «yo'lda») — ham to'siqsiz: sotish / bekor uni backend o'zi qabul qiladi.
      { id: "4", ...SCAN_TAKEN, status: "on the road" },
      { id: "5", status: "waiting" },
    ];
    const actions: Record<string, CourierBulkAction> = { "1": "sold", "3": "cancel", "4": "sold" };
    // "2" va "5" — belgisiz, sukut «sotildi».
    expect(getCourierBulkFinalizeTasks(orders, actions)).toEqual([
      { order: orders[0], action: "sold" },
      { order: orders[1], action: "sold" },
      { order: orders[2], action: "cancel" },
      { order: orders[3], action: "sold" },
      { order: orders[4], action: "sold" },
    ]);
    expect(getCourierBulkCounts(orders, actions)).toEqual({ cancel: 1, sold: 4, tomorrow: 0, total: 5 });
    expect(getCourierBulkUnmarkedCount(orders, actions)).toBe(2);
    expect(getCourierBulkKept(orders, actions)).toEqual({ tomorrow: [], replacement: [] });
    const ids = (result: "all" | "sold" | "cancel" | "unmarked") =>
      filterCourierBulkOrders(orders as unknown as CourierBulkOrder[], actions, { query: "", result }).map((item) => item.id);
    expect(ids("all")).toEqual(["1", "2", "3", "4", "5"]);
    expect(ids("sold")).toEqual(["1", "2", "4", "5"]);
    expect(ids("cancel")).toEqual(["3"]);
    expect(ids("unmarked")).toEqual(["2", "5"]);
  });

  it("«Sotiladi» filtri kuryer qo'lidagini ham, belgisizlarni ham chiqaradi — faqat almashtirish chiqmaydi", () => {
    const orders = [
      { id: "1", status: "waiting", ...COURIER_HELD },
      { id: "2", status: "waiting", ...COURIER_HELD },
      { id: "3", status: "waiting", ...BRANCH_HELD },
      { id: "4", status: "waiting", ...COURIER_HELD },
      { id: "5", status: "waiting", ...BRANCH_HELD },
      { id: "6", status: "waiting", ...COURIER_HELD, ...AWAITING },
    ] as unknown as CourierBulkOrder[];
    const actions: Record<string, CourierBulkAction> = { "1": "sold", "2": "cancel", "3": "sold" };
    const ids = (result: "all" | "sold" | "cancel" | "unmarked") =>
      filterCourierBulkOrders(orders, actions, { query: "", result }).map((item) => item.id);
    expect(ids("sold")).toEqual(["1", "3", "4", "5"]);
    // «Belgilanmagan» — belgi qo'yilmaganlarning hammasi (almashtirish ham).
    expect(ids("unmarked")).toEqual(["4", "5", "6"]);
    expect(ids("cancel")).toEqual(["2"]);
    expect(ids("all")).toEqual(["1", "2", "3", "4", "5", "6"]);
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

  it("qayta yuborish (isbotli yakka so'rov): 429 — chegaragacha, 5xx — ko'pi bilan 2 marta, 4xx — darhol", async () => {
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

  it("bulk: 20 tadan bo'lak, bo'laklar ketma-ket; javobdagi `succeeded` / `failed` har buyurtmaga, 4xx — qayta yuborilmaydi", async () => {
    expect(COURIER_BULK_CHUNK_SIZE).toBe(20);
    const ids = Array.from({ length: 45 }, (_, index) => String(index + 1));
    const rejectedMessage = "Faqat kutilayotgan buyurtma sotiladi";
    let inFlight = 0;
    let peak = 0;
    const send = vi.fn(async (chunk: readonly string[]) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight -= 1;
      return bulkBody(
        { action: "sold", orderIds: [...chunk] },
        [{ order_id: "7", status_code: 400, message: rejectedMessage }],
      );
    });
    const chunksDone: number[] = [];
    const outcome = await runCourierBulkAction(ids, send, {
      wait: async () => undefined,
      onChunkDone: (count) => chunksDone.push(count),
    });

    expect(send.mock.calls.map(([chunk]) => chunk.length)).toEqual([20, 20, 5]);
    expect(send.mock.calls.flatMap(([chunk]) => [...chunk])).toEqual(ids);
    expect(peak).toBe(1);
    expect(chunksDone).toEqual([20, 20, 5]);
    expect(outcome.size).toBe(45);
    expect(outcome.get("1")).toEqual({ status: "fulfilled", value: undefined });
    expect(outcome.get("45")).toEqual({ status: "fulfilled", value: undefined });
    // Biznes xatosi — axios xatosi shaklida (natija oynasi backend sababini o'qiydi), qayta yuborilmaydi.
    expect(outcome.get("7")).toEqual({
      status: "rejected",
      reason: { response: { status: 400, data: { message: rejectedMessage } } },
    });
    expect(send).toHaveBeenCalledTimes(3);
  });

  it("bulk qayta yuborish: butun so'rov 429 — bo'lak qayta; javobdagi 5xx / «Takroriy so'rov» 409 — faqat o'shalar; javobda yo'q — xato", async () => {
    const waits: number[] = [];
    const wait = async (ms: number) => {
      waits.push(ms);
    };
    const send = vi
      .fn()
      .mockRejectedValueOnce(backendError("ThrottlerException: Too Many Requests", 429))
      .mockResolvedValueOnce({
        statusCode: 200,
        data: {
          succeeded: ["1"],
          failed: [
            { order_id: "2", status_code: 500, message: "Internal server error" },
            {
              order_id: "3",
              status_code: 409,
              message: "Takroriy so'rov: bu amal hozir bajarilmoqda — biroz kuting va holatni tekshiring",
            },
            { order_id: "4", status_code: 400, message: "Faqat kutilayotgan buyurtma sotiladi" },
          ],
        },
      })
      .mockResolvedValueOnce({ statusCode: 200, data: { succeeded: ["2", "3"], failed: [] } });

    const outcome = await runCourierBulkAction(["1", "2", "3", "4", "5"], send, { delays: [1, 2, 3], wait });

    expect(send.mock.calls.map(([chunk]) => [...chunk])).toEqual([
      ["1", "2", "3", "4", "5"],
      ["1", "2", "3", "4", "5"],
      ["2", "3"],
    ]);
    expect(waits).toEqual([1, 2]);
    for (const id of ["1", "2", "3"]) expect(outcome.get(id)).toEqual({ status: "fulfilled", value: undefined });
    expect(outcome.get("4")).toEqual({
      status: "rejected",
      reason: { response: { status: 400, data: { message: "Faqat kutilayotgan buyurtma sotiladi" } } },
    });
    // Javobda umuman yo'q buyurtma — sababsiz xato (qayta yuborilmaydi).
    expect(outcome.get("5")).toEqual({ status: "rejected", reason: { response: { status: 0, data: {} } } });

    // Doimiy 500 (javobda) — ko'pi bilan 2 marta qayta, keyin xato natijaga.
    waits.length = 0;
    const broken = vi.fn(async (chunk: readonly string[]) => ({
      statusCode: 200,
      data: {
        succeeded: [],
        failed: chunk.map((orderId) => ({ order_id: orderId, status_code: 500, message: "Internal server error" })),
      },
    }));
    const brokenOutcome = await runCourierBulkAction(["9"], broken, { delays: [1, 2, 3], serverRetries: 2, wait });
    expect(broken).toHaveBeenCalledTimes(3);
    expect(waits).toEqual([1, 2]);
    expect(brokenOutcome.get("9")).toEqual({
      status: "rejected",
      reason: { response: { status: 500, data: { message: "Internal server error" } } },
    });

    // Butun so'rov 403 — qayta yuborilmaydi, bo'lakdagi hammasi shu xato bilan.
    const denied = backendError("Ruxsat yo'q", 403);
    const forbidden = vi.fn().mockRejectedValue(denied);
    const deniedOutcome = await runCourierBulkAction(["1", "2"], forbidden, { wait });
    expect(forbidden).toHaveBeenCalledTimes(1);
    expect(deniedOutcome.get("1")).toEqual({ status: "rejected", reason: denied });
    expect(deniedOutcome.get("2")).toEqual({ status: "rejected", reason: denied });
  });

  it("vazifalar + qoldirilganlar ro'yxatni to'liq va takrorsiz qoplaydi (har qanday belgi)", () => {
    const shapes = [{}, COURIER_HELD, BRANCH_HELD, SCAN_TAKEN, AWAITING];
    const marks: Array<CourierBulkAction | undefined> = [undefined, "sold", "cancel", "tomorrow"];
    const orders = shapes.flatMap((shape, s) => marks.map((_, m) => ({ id: `${s}-${m}`, status: "waiting", ...shape })));
    const actions = Object.fromEntries(
      orders.flatMap((item, index) => (marks[index % marks.length] ? [[item.id, marks[index % marks.length]]] : [])),
    ) as Record<string, CourierBulkAction>;

    const sent = getCourierBulkFinalizeTasks(orders, actions).map((task) => task.order.id);
    const kept = Object.values(getCourierBulkKept(orders, actions)).flat().map((item) => item.id);
    expect([...sent, ...kept].sort()).toEqual(orders.map((item) => item.id).sort());
    const counts = getCourierBulkCounts(orders, actions);
    expect(counts.sold + counts.cancel).toBe(sent.length);
  });
});

describe("CourierBulkPage — 30 ta: 20 sotildi, 5 bekor, 5 ertaga", () => {
  it("⭐ 5 bekor, 5 ertaga belgilanadi, qolgan 20 tasi (3 tasi skan bilan olingan) sukut bo'yicha sotiladi — bulk bilan", async () => {
    // Foydalanuvchi ssenariysi: 20 tadan 3 tasi skan bilan olingan. COURIER-SCAN (ega, 2026-11-17): skan = qabul —
    // ular ham «Kutilmoqda» va kuryerda, boshqalari kabi to'siqsiz sotiladi. BeePost modeli: kuryer faqat 5 «Bekor» va
    // 5 «Ertaga»ni belgilaydi, belgisiz 20 tasi sotiladi.
    const scanTakenIds = ["128", "129", "130"];
    const orders = Array.from({ length: 30 }, (_, index) => {
      const id = String(101 + index);
      return order(id, `Mijoz ${id}`, scanTakenIds.includes(id) ? SCAN_TAKEN : {});
    });
    const cancelIds = ["101", "102", "103", "104", "105"];
    const tomorrowIds = ["106", "107", "108", "109", "110"];
    mocks.get.mockResolvedValueOnce(page(orders));
    // Yakunlashdan keyin serverda faqat ertaga qoldirilganlar qoladi.
    mocks.get.mockResolvedValue(page(orders.filter((item) => tomorrowIds.includes(item.id))));
    const user = userEvent.setup();
    const { queryClient } = renderWithProviders(<CourierBulkPage />);
    // Haqiqiy `BulkOrderAction` kabi: javob tarmoqdan keladi (kamida bitta macrotask), keyin ["orders"] eskiradi.
    mocks.bulk.mockImplementation(async (call: BulkCall) => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      return bulkBody(call);
    });

    expect(await screen.findByText("Mijoz 127")).toBeInTheDocument();
    for (const id of scanTakenIds) {
      expect(within(rowOf(`Mijoz ${id}`)).queryByTestId("courier-bulk-awaiting-post")).not.toBeInTheDocument();
      expect(radio(`Mijoz ${id}`, "Sotildi")).toBeEnabled();
      expectUnmarked(`Mijoz ${id}`);
    }
    const soldIds = orders.map((item) => item.id).filter((id) => ![...cancelIds, ...tomorrowIds].includes(id));
    expect(soldIds).toHaveLength(20);
    for (const id of cancelIds) await user.click(radio(`Mijoz ${id}`, "Bekor"));
    for (const id of tomorrowIds) await user.click(radio(`Mijoz ${id}`, "Ertaga"));
    const summary = screen.getByRole("group", { name: "Kun yakuni" });
    expect(summary).toHaveTextContent(/Sotiladi\s*20\s*ta/);
    expect(summary).toHaveTextContent("Shundan belgilanmagan: 20 ta");

    const dialog = await finalize(user);
    expect(dialog).toHaveTextContent("30 ta buyurtma: quyidagilar bajariladi");
    expect(dialog).toHaveTextContent("20 ta sotilgan deb belgilanadi");
    expect(dialog).toHaveTextContent("Sotilgan holatiga o'tadi — 20 tasi belgilanmagan (skanerlanmagan)");
    expect(dialog).toHaveTextContent("5 ta bekor qilinadi");
    expect(dialog).toHaveTextContent("5 tasi ertaga qoladi");
    expect(dialog).not.toHaveTextContent("pochtasi qabul qilinmagan");
    expect(dialog).not.toHaveTextContent("o'zgarmaydi");
    expect(within(dialog).getByRole("note")).toHaveTextContent("25 ta buyurtma holati darhol o'zgaradi.");
    // Belgilanmaganlar sotilishi tasdiqlanmaguncha «Tasdiqlash» o'chiq.
    const confirmButton = within(dialog).getByRole("button", { name: "Tasdiqlash" });
    expect(confirmButton).toBeDisabled();
    await user.click(within(dialog).getByRole("checkbox", { name: "Belgilanmagan 20 ta buyurtma SOTILISHINI tushunaman" }));
    expect(confirmButton).toBeEnabled();
    const getsBefore = mocks.get.mock.calls.length;
    await user.click(confirmButton);

    await waitFor(() => expect(mocks.bulk).toHaveBeenCalledTimes(2));
    // Avval bekorlar, keyin sotuvlar — 20 ta sotuv bitta bo'lakda; yakka so'rov yo'q.
    expect(bulkSummary()).toEqual([
      ["cancel", cancelIds],
      ["sold", soldIds],
    ]);
    expect(bulkCalls().map((call) => call.headers)).toEqual([
      { "X-Request-Source": "courier-bulk", "Idempotency-Key": expect.stringMatching(RUN_KEY) },
      { "X-Request-Source": "courier-bulk", "Idempotency-Key": bulkCalls()[0].headers?.["Idempotency-Key"] },
    ]);
    expect(mocks.sell).not.toHaveBeenCalled();
    expect(mocks.cancel).not.toHaveBeenCalled();
    expect(await screen.findByText(/25 ta buyurtma muvaffaqiyatli yakunlandi/)).toBeInTheDocument();

    // Ro'yxatda: ertaga qoldirilganlar belgisi bilan (kuryer nimani tanlagani ko'rinib tursin); bajarilganlar yo'q.
    await waitFor(() => expect(screen.queryByText("Mijoz 127")).not.toBeInTheDocument());
    for (const id of tomorrowIds) expect(radio(`Mijoz ${id}`, "Ertaga")).toBeChecked();
    for (const id of scanTakenIds) expect(screen.queryByText(`Mijoz ${id}`)).not.toBeInTheDocument();
    expect(screen.queryByText("Mijoz 101")).not.toBeInTheDocument();
    // Yakunlash paytida ro'yxat har muvaffaqiyatdan keyin qayta so'ralmaydi — oxirida bir marta.
    expect(mocks.get.mock.calls.length - getsBefore).toBeLessThanOrEqual(1);
  }, 30_000);

  it("bajarilganlar ro'yxat yangilanishini kutmasdan chiqadi; xato bergan qatorda backend sababi qoladi", async () => {
    mocks.get.mockResolvedValueOnce(page([order("10", "Ali"), order("11", "Vali"), order("12", "Soli")]));
    // Yangilanish so'rovi javobsiz qoladi — ro'yxat faqat kesh yangilanishi bilan o'zgaradi.
    mocks.get.mockReturnValue(new Promise(() => undefined));
    mocks.bulk.mockImplementation((call: BulkCall) =>
      Promise.resolve(
        bulkBody(call, [
          { order_id: "11", status_code: 400, message: "Buyurtma topilmadi yoki kutilmoqda (waiting) holatida emas" },
        ]),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);

    expect(await screen.findByText("Ali")).toBeInTheDocument();
    const dialog = await finalize(user);
    await confirmDialog(user, dialog);

    const result = await screen.findByRole("dialog", { name: "Yakunlashda xatolik" });
    expect(result).toHaveTextContent("№11 · Vali");
    expect(result).toHaveTextContent("Buyurtma topilmadi yoki kutilmoqda (waiting) holatida emas");
    await user.click(within(result).getByRole("button", { name: "Tushunarli" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Yakunlashda xatolik" })).not.toBeInTheDocument());

    // Bitta bulk so'rov; 400 — qayta yuborilmaydi.
    expect(bulkSummary()).toEqual([["sold", ["10", "11", "12"]]]);
    expect(screen.queryByText("Ali")).not.toBeInTheDocument();
    expect(screen.queryByText("Soli")).not.toBeInTheDocument();
    expect(within(rowOf("Vali")).getByTestId("courier-bulk-row-error")).toHaveTextContent(
      "Yakunlanmadi: Buyurtma topilmadi yoki kutilmoqda (waiting) holatida emas",
    );
    // Xato bergan qator o'z natijasini saqlaydi — belgisiz, sukut «Sotildi».
    expectUnmarked("Vali");

    // Belgi o'zgartirilsa — eski sabab olib tashlanadi.
    await user.click(radio("Vali", "Ertaga"));
    expect(screen.queryByTestId("courier-bulk-row-error")).not.toBeInTheDocument();
  });

  it("xato oynasi so'rovsiz qoldirilganlarni ham aytadi (ertaga, almashtirish)", async () => {
    respondWith([
      order("10", "Ali"),
      order("11", "Vali"),
      order("12", "Soli", SCAN_TAKEN),
      order("13", "Gani"),
      order("14", "Hasan"),
      order("15", "Karim", AWAITING),
    ]);
    // Sotish so'rovi butunligicha rad etildi (400 — qayta yuborilmaydi); bekor qilish — o'tdi.
    mocks.bulk.mockImplementation((call: BulkCall) =>
      call.action === "sold" ? Promise.reject(backendError("Server xatosi")) : Promise.resolve(bulkBody(call)),
    );
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);

    expect(await screen.findByText("Gani")).toBeInTheDocument();
    await user.click(radio("Gani", "Ertaga"));
    await user.click(radio("Hasan", "Bekor"));
    // Ali, Vali, Soli — belgisiz (sukut «sotildi»); Karim — belgisiz almashtirish (bu yerdan sotilmaydi).
    const dialog = await finalize(user);
    expect(within(dialog).getByRole("checkbox", { name: "Belgilanmagan 3 ta buyurtma SOTILISHINI tushunaman" })).toBeInTheDocument();
    await confirmDialog(user, dialog);

    const result = await screen.findByRole("dialog", { name: "Yakunlashda xatolik" });
    expect(bulkSummary()).toEqual([
      ["cancel", ["14"]],
      ["sold", ["10", "11", "12"]],
    ]);
    expect(mocks.sell).not.toHaveBeenCalled();
    expect(mocks.cancel).not.toHaveBeenCalled();
    expect(result).toHaveTextContent("3 ta buyurtma yakunlanmadi");
    expect(result).toHaveTextContent("1 ta buyurtma muvaffaqiyatli yakunlandi");
    expect(within(within(result).getByRole("list", { name: "Yakunlanmagan buyurtmalar" })).getAllByRole("listitem")).toHaveLength(3);
    expect(result).toHaveTextContent("Server xatosi");
    expect(result).toHaveTextContent("1 ta buyurtma ertaga qoldirildi.");
    expect(result).toHaveTextContent("1 ta almashtirish buyurtmasi «Buyurtmalar»dan sotiladi.");
    expect(result).not.toHaveTextContent("belgilanmagan buyurtma o'zgarmadi");
    expect(result).not.toHaveTextContent("pochtasi qabul qilinmagan");
  });

  it("429 bergan bulk so'rov kutib, ayni kalit bilan qayta yuboriladi va o'tadi (xato oynasisiz)", async () => {
    respondWith([order("10", "Ali"), order("11", "Vali")]);
    mocks.bulk.mockRejectedValueOnce(backendError("ThrottlerException: Too Many Requests", 429));
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);

    expect(await screen.findByText("Ali")).toBeInTheDocument();
    const dialog = await finalize(user);
    await confirmDialog(user, dialog);

    // Birinchi kutish — 2 s (COURIER_BULK_RETRY_DELAYS_MS[0]).
    await waitFor(() => expect(mocks.bulk).toHaveBeenCalledTimes(2), { timeout: 6000 });
    const [first, retry] = bulkCalls();
    expect(first.orderIds).toEqual(["10", "11"]);
    expect(retry.orderIds).toEqual(["10", "11"]);
    expect(first.headers?.["Idempotency-Key"]).toMatch(RUN_KEY);
    expect(retry.headers?.["Idempotency-Key"]).toBe(first.headers?.["Idempotency-Key"]);
    expect(await screen.findByText(/2 ta buyurtma muvaffaqiyatli yakunlandi/)).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Yakunlashda xatolik" })).not.toBeInTheDocument();
    expect(mocks.sell).not.toHaveBeenCalled();
  }, 15_000);

  it("javobda 500 (yuklama) bergan buyurtma ayni Idempotency-Key bilan yolg'iz qayta yuboriladi va o'tadi", async () => {
    respondWith([order("10", "Ali"), order("11", "Vali")]);
    mocks.bulk.mockImplementationOnce((call: BulkCall) =>
      Promise.resolve(bulkBody(call, [{ order_id: "10", status_code: 500, message: "Internal server error" }])),
    );
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);

    expect(await screen.findByText("Ali")).toBeInTheDocument();
    const dialog = await finalize(user);
    await confirmDialog(user, dialog);

    await waitFor(() => expect(mocks.bulk).toHaveBeenCalledTimes(2), { timeout: 6000 });
    const [first, retry] = bulkCalls();
    expect(first.orderIds).toEqual(["10", "11"]);
    // Faqat xato bergan #10 qayta yuboriladi (#11 birinchi urinishda o'tgan).
    expect(retry.orderIds).toEqual(["10"]);
    expect(first.headers?.["Idempotency-Key"]).toMatch(RUN_KEY);
    expect(retry.headers?.["Idempotency-Key"]).toBe(first.headers?.["Idempotency-Key"]);
    expect(await screen.findByText(/2 ta buyurtma muvaffaqiyatli yakunlandi/)).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Yakunlashda xatolik" })).not.toBeInTheDocument();
  }, 15_000);

  it("tasdiq oynasi ochiq turganda skan belgini o'zgartirmaydi (yuboriladiganlar oyna ochilganda olingan)", async () => {
    respondWith([order("10", "Ali"), order("11", "Vali")]);
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);

    expect(await screen.findByText("Ali")).toBeInTheDocument();
    // Belgisizlar ham sotiladi — oyna belgisiz ochiladi.
    const dialog = await finalize(user);
    await scan("tok-10-qr");
    expect(screen.queryByText("Ali bekor qilishga belgilandi")).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Orqaga" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expectUnmarked("Ali");
    expect(mocks.bulk).not.toHaveBeenCalled();

    // Oyna yopilgach skan yana ishlaydi.
    await scan("tok-10-qr");
    expect(await screen.findByText("Ali bekor qilishga belgilandi")).toBeInTheDocument();
    expect(radio("Ali", "Bekor")).toBeChecked();
  });
});

describe("CourierBulkPage — sukut natija «Sotildi» (BeePost, ega 2026-11-21)", () => {
  it("⭐ 25 ta: 10 aniq sotildi, 5 bekor, 5 ertaga, 5 belgilanmagan — belgisizlar ham sotiladi (katak bilan tasdiqlanib)", async () => {
    // Ega: «kunni yakunlash xuddi BeePost'nikiday ishlashi kerak» — skanerlanmagan (belgisiz) posilka sotiladi.
    // 2026-11-05 dagi «sukut yo'q» qarori bekor; xavfsizlik — tasdiq oynasidagi belgilash katagi.
    const orders = Array.from({ length: 25 }, (_, index) => order(String(201 + index), `Mijoz ${201 + index}`));
    const ids = orders.map((item) => item.id);
    const soldIds = ids.slice(0, 10);
    const cancelIds = ids.slice(10, 15);
    const tomorrowIds = ids.slice(15, 20);
    const unmarkedIds = ids.slice(20);
    mocks.get.mockResolvedValueOnce(page(orders));
    // Yakunlashdan keyin serverda faqat ertaga qoldirilganlar qoladi (kutilmoqda).
    mocks.get.mockResolvedValue(page(orders.filter((item) => tomorrowIds.includes(item.id))));
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);

    expect(await screen.findByText("Mijoz 225")).toBeInTheDocument();
    // Har qator oldindan «Sotildi»da (sukut), «Belgilanmagan» belgisi bilan.
    for (const id of ids) expectUnmarked(`Mijoz ${id}`);
    const summary = screen.getByRole("group", { name: "Kun yakuni" });
    expect(summary).toHaveTextContent(/Sotiladi\s*25\s*ta/);
    expect(summary).toHaveTextContent("Shundan belgilanmagan: 25 ta");

    // 10 tasi aniq «Sotildi» (adashib «Bekor» bosilib, keyin tuzatilgan) — belgilangan, «Belgilanmagan» emas.
    for (const id of soldIds) {
      await user.click(radio(`Mijoz ${id}`, "Bekor"));
      await user.click(radio(`Mijoz ${id}`, "Sotildi"));
    }
    for (const id of cancelIds) await user.click(radio(`Mijoz ${id}`, "Bekor"));
    for (const id of tomorrowIds) await user.click(radio(`Mijoz ${id}`, "Ertaga"));
    expect(summary).toHaveTextContent(/Sotiladi\s*15\s*ta/);
    expect(summary).toHaveTextContent("Shundan belgilanmagan: 5 ta");
    for (const id of soldIds) {
      expect(radio(`Mijoz ${id}`, "Sotildi")).toBeChecked();
      expect(within(rowOf(`Mijoz ${id}`)).queryByText("Belgilanmagan")).not.toBeInTheDocument();
    }
    for (const id of unmarkedIds) expectUnmarked(`Mijoz ${id}`);

    const dialog = await finalize(user);
    expect(dialog).toHaveTextContent("25 ta buyurtma: quyidagilar bajariladi");
    expect(dialog).toHaveTextContent(/(?<!\d)15 ta sotilgan deb belgilanadi/);
    expect(dialog).toHaveTextContent("Sotilgan holatiga o'tadi — 5 tasi belgilanmagan (skanerlanmagan)");
    expect(dialog).toHaveTextContent(/(?<!\d)5 ta bekor qilinadi/);
    expect(dialog).toHaveTextContent(/(?<!\d)5 tasi ertaga qoladi/);
    expect(dialog).not.toHaveTextContent("o'zgarmaydi");
    expect(within(dialog).getByRole("note")).toHaveTextContent("20 ta buyurtma holati darhol o'zgaradi.");
    const confirmButton = within(dialog).getByRole("button", { name: "Tasdiqlash" });
    expect(confirmButton).toBeDisabled();
    const acknowledge = within(dialog).getByRole("checkbox", { name: "Belgilanmagan 5 ta buyurtma SOTILISHINI tushunaman" });
    expect(acknowledge).not.toBeChecked();
    // Katak belgilanmaguncha bosish hech narsa yubormaydi.
    await user.click(confirmButton);
    expect(mocks.bulk).not.toHaveBeenCalled();
    await user.click(acknowledge);
    expect(confirmButton).toBeEnabled();
    await user.click(confirmButton);

    await waitFor(() => expect(mocks.bulk).toHaveBeenCalledTimes(2));
    // Sotuv bo'lagida aniq belgilangan 10 ta va belgisiz 5 ta — sahifa tartibida.
    expect(bulkSummary()).toEqual([
      ["cancel", cancelIds],
      ["sold", [...soldIds, ...unmarkedIds]],
    ]);
    expect(bulkCalls().map((call) => call.comment)).toEqual([
      "Kuryer tezkor amal orqali bekor qildi",
      "Kuryer tezkor amal orqali sotildi deb yakunladi",
    ]);
    // «Ertaga» qatorlar uchun hech qanday so'rov yo'q.
    const requested = bulkCalls().flatMap((call) => call.orderIds);
    for (const id of tomorrowIds) expect(requested).not.toContain(id);
    const success = /(?<!\d)20 ta buyurtma muvaffaqiyatli yakunlandi 5 ta buyurtma ertaga qoldirildi\./;
    expect(await screen.findByText(success)).toBeInTheDocument();
    expect(screen.queryByText(/belgilanmagan buyurtma o'zgarmadi/)).not.toBeInTheDocument();
    expect(mocks.bulk).toHaveBeenCalledTimes(2);
    expect(mocks.sell).not.toHaveBeenCalled();
    expect(mocks.cancel).not.toHaveBeenCalled();

    // Ro'yxat: sotilgan / bekor qilinganlar (belgisizlar ham) chiqdi; ertaga — belgisi bilan.
    await waitFor(() => expect(screen.queryByText("Mijoz 201")).not.toBeInTheDocument());
    for (const id of [...soldIds, ...cancelIds, ...unmarkedIds]) {
      expect(screen.queryByText(`Mijoz ${id}`)).not.toBeInTheDocument();
    }
    for (const id of tomorrowIds) expect(radio(`Mijoz ${id}`, "Ertaga")).toBeChecked();
  }, 30_000);
});

describe("CourierBulkPage — skan bilan olingan posilka (kuryer, COURIER-SCAN)", () => {
  beforeEach(() => {
    respondWith([order("10", "Ali"), order("11", "Vali"), order("12", "Soli", SCAN_TAKEN)]);
  });

  it("⭐ skan bilan olingan qator to'siqsiz: sababsiz, natija faol, «Belgilanmagan» (sukut «Sotildi»); yuboriladi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);

    expect(await screen.findByText("Soli")).toBeInTheDocument();
    expect(within(rowOf("Soli")).queryByTestId("courier-bulk-awaiting-post")).not.toBeInTheDocument();
    expect(radio("Soli", "Bekor")).toBeEnabled();
    expect(radio("Soli", "Sotildi")).toBeEnabled();
    expectUnmarked("Soli");
    const summary = screen.getByRole("group", { name: "Kun yakuni" });
    expect(summary).toHaveTextContent(/Kutilayotgan\s*3/);
    expect(summary).toHaveTextContent(/Sotiladi\s*3\s*ta/);
    expect(summary).toHaveTextContent("Shundan belgilanmagan: 3 ta");
    expect(getActiveScanTarget()?.listNote).toBe("Belgilanmagan 3 ta buyurtma sotiladi.");

    await user.click(radio("Vali", "Bekor"));
    expect(summary).toHaveTextContent(/Sotiladi\s*2\s*ta/);
    expect(summary).toHaveTextContent("Shundan belgilanmagan: 2 ta");

    const dialog = await finalize(user);
    expect(dialog).toHaveTextContent("2 ta sotilgan deb belgilanadi");
    expect(dialog).toHaveTextContent("1 ta bekor qilinadi");
    expect(dialog).not.toHaveTextContent("pochtasi qabul qilinmagan");
    await confirmDialog(user, dialog);

    await waitFor(() => expect(mocks.bulk).toHaveBeenCalledTimes(2));
    expect(bulkSummary()).toEqual([
      ["cancel", ["11"]],
      ["sold", ["10", "12"]],
    ]);
  });

  it("skan: skan bilan olingan posilka ham belgilanadi (ogohlantirishsiz)", async () => {
    renderWithProviders(<CourierBulkPage />);

    expect(await screen.findByText("Soli")).toBeInTheDocument();
    await scan("tok-12-qr");
    await waitFor(() => expect(within(rowOf("Soli")).queryByText("Belgilanmagan")).not.toBeInTheDocument());
    expect(radio("Soli", "Bekor")).toBeChecked();
    expect(screen.queryByText("Pochta hali qabul qilinmagan")).not.toBeInTheDocument();
    expect(mocks.feedback).not.toHaveBeenCalledWith("error", expect.anything());
  });
});

describe("CourierBulkPage — menejer (LC-04, 2026-11-21: kuryer nomidan sotish)", () => {
  it("⭐ kuryer qo'lidagi buyurtma ham sotiladi (qatorda to'siq izohi yo'q, oynada «kuryer nomidan» izohi); menejer izohlari bilan", async () => {
    respondWith([
      order("20", "Ali", COURIER_HELD),
      order("21", "Vali", COURIER_HELD),
      order("22", "Soli", BRANCH_HELD),
      order("23", "Gani", COURIER_HELD),
    ]);
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />, { preloadedState: asManager(true) });

    expect(await screen.findByText("Ali")).toBeInTheDocument();
    // Kuryer qo'lidagi qatorda endi «kuryerning o'zi sotadi» izohi yo'q.
    expect(screen.queryByTestId("courier-bulk-courier-held")).not.toBeInTheDocument();
    expect(screen.queryByText(/kuryerning o'zi sotadi/)).not.toBeInTheDocument();
    for (const name of ["Ali", "Vali", "Soli", "Gani"]) expectUnmarked(name);
    expect(getActiveScanTarget()?.listNote).toBe("Belgilanmagan 4 ta buyurtma sotiladi.");
    // Vali — kuryer qo'lida, bekor; Ali, Gani — kuryer qo'lida, belgisiz (sotiladi); Soli — filialda, belgisiz.
    await user.click(radio("Vali", "Bekor"));
    expect(screen.queryByTestId("courier-bulk-no-permission")).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Kun yakuni" })).toHaveTextContent(/Sotiladi\s*3\s*ta/);

    const dialog = await finalize(user);
    expect(dialog).toHaveTextContent("3 ta sotilgan deb belgilanadi");
    expect(dialog).toHaveTextContent("Sotilgan holatiga o'tadi — 3 tasi belgilanmagan (skanerlanmagan)");
    expect(dialog).toHaveTextContent("1 ta bekor qilinadi");
    expect(dialog).toHaveTextContent(
      "Kuryer qo'lidagi 2 ta buyurtma kuryer nomidan sotiladi — naqd pul kuryer kassasida (kuryer o'zi sotgandagidek).",
    );
    expect(dialog).not.toHaveTextContent("sotilmaydi");
    expect(dialog).not.toHaveTextContent("kuryerning o'zi sotadi");
    await confirmDialog(user, dialog);

    await waitFor(() => expect(mocks.bulk).toHaveBeenCalledTimes(2));
    expect(bulkCalls()).toEqual([
      {
        action: "cancel",
        orderIds: ["21"],
        comment: "Menejer tezkor amal orqali bekor qildi",
        headers: { "X-Request-Source": "courier-bulk", "Idempotency-Key": expect.stringMatching(RUN_KEY) },
      },
      {
        action: "sold",
        orderIds: ["20", "22", "23"],
        comment: "Menejer tezkor amal orqali sotildi deb yakunladi",
        headers: { "X-Request-Source": "courier-bulk", "Idempotency-Key": expect.stringMatching(RUN_KEY) },
      },
    ]);
    expect(await screen.findByText(/4 ta buyurtma muvaffaqiyatli yakunlandi/)).toBeInTheDocument();
    expect(screen.queryByText(/kuryerning o'zi sotadi/)).not.toBeInTheDocument();
    expect(mocks.sell).not.toHaveBeenCalled();
    expect(mocks.cancel).not.toHaveBeenCalled();
  });

  it("sotish/bekor ruxsati yo'q menejer — ogohlantirish, «Kunni yakunlash» va «Faqat bekorlar» o'chiq", async () => {
    respondWith([order("22", "Soli", BRANCH_HELD)]);
    renderWithProviders(<CourierBulkPage />, { preloadedState: asManager(false) });

    expect(await screen.findByText("Soli")).toBeInTheDocument();
    expect(screen.getByTestId("courier-bulk-no-permission")).toHaveTextContent("Sotish va bekor qilish ruxsati yo'q");
    expect(screen.getByRole("button", { name: /Kunni yakunlash/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Faqat bekorlar/ })).toBeDisabled();
  });

  it("kuryerning o'zi uchun kuryer qo'lidagi buyurtma odatdagidek sotiladi (menejer izohisiz)", async () => {
    respondWith([order("20", "Ali", COURIER_HELD)]);
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);

    expect(await screen.findByText("Ali")).toBeInTheDocument();
    expect(screen.queryByTestId("courier-bulk-courier-held")).not.toBeInTheDocument();
    const dialog = await finalize(user);
    expect(dialog).not.toHaveTextContent("kuryer nomidan");
    await confirmDialog(user, dialog);
    await waitFor(() =>
      expect(mocks.bulk).toHaveBeenCalledWith({
        action: "sold",
        orderIds: ["20"],
        comment: "Kuryer tezkor amal orqali sotildi deb yakunladi",
        headers: { "X-Request-Source": "courier-bulk", "Idempotency-Key": expect.stringMatching(RUN_KEY) },
      }),
    );
  });
});
