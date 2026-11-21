import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CourierBulkPage from "./index";
import { renderWithProviders } from "../../test/test-utils";
import { resetScanTargets } from "../../shared/lib/scanner/scanTargets";
import {
  getCourierBulkCounts,
  getCourierBulkFinalizeTasks,
  getCourierBulkKept,
  getCourierBulkReplacementHeld,
  getCourierBulkUnmarkedCount,
  isCourierBulkSellBlocked,
} from "./model/courierBulk";

/**
 * lQjt6sKP — «Tezkor amal»da almashtirish buyurtmasi: eski mahsulot olinmaguncha backend «Eski mahsulotni oldim»
 * tasdig'isiz sotishni rad etadi (400). Ommaviy yopishda tasdiq yo'q — bunday buyurtma «sotildi» bo'lib
 * yuborilmaydi (kutilmoqda qoladi), tasdiq oynasi va qator buni aytadi; bekor qilish — odatdagidek.
 *
 * BeePost modeli (ega 2026-11-21): belgilanmagan qator — sukut «sotildi». Belgilanmagan almashtirish ham «sotildi»
 * natijasida, lekin sotib bo'lmaydi — u ham «almashtirish» guruhida (so'rovsiz kutilmoqda qoladi), «Belgilanmagan»
 * belgisi esa qatorda turadi (qo'lda / skan bilan belgilanmagan).
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

const bulkCalls = () => mocks.bulk.mock.calls.map(([call]) => call as BulkCall);

const AWAITING = { replacement_of_order_id: "81", replacement_state: "awaiting_old_pickup" };

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

const respondWith = (orders: unknown[]) =>
  mocks.get.mockResolvedValue({ data: { statusCode: 200, data: { data: orders, total: orders.length } } });

describe("courierBulk model — almashtirish", () => {
  const orders = [{ id: "1" }, { id: "2", ...AWAITING }, { id: "3", ...AWAITING }, { id: "4", ...AWAITING, replacement_state: "old_collected" }];

  const allSold = { "1": "sold", "2": "sold", "3": "sold", "4": "sold" } as const;

  it("eski mahsulot olinmagan almashtirish «sotildi» vazifasiga kirmaydi (belgisiz ham); bekor qilish — kiradi", () => {
    expect(getCourierBulkFinalizeTasks(orders, { "1": "sold", "2": "sold", "3": "cancel", "4": "sold" })).toEqual([
      { order: { id: "1" }, action: "sold" },
      { order: orders[2], action: "cancel" },
      { order: orders[3], action: "sold" },
    ]);
    // Sukut «sotildi»: belgilanmagan "1" va "4" (`old_collected`) sotiladi, belgilanmagan "2" — almashtirish, yo'q.
    expect(getCourierBulkFinalizeTasks(orders, { "3": "cancel" })).toEqual([
      { order: { id: "1" }, action: "sold" },
      { order: orders[2], action: "cancel" },
      { order: orders[3], action: "sold" },
    ]);
    expect(getCourierBulkFinalizeTasks(orders, {})).toEqual([
      { order: { id: "1" }, action: "sold" },
      { order: orders[3], action: "sold" },
    ]);
  });

  it("ushlab qolinganlar — «sotildi» natijasidagi almashtirishlar (aniq belgi yoki sukut); bekor / ertaga — yo'q", () => {
    expect(getCourierBulkReplacementHeld(orders, { "2": "sold", "3": "cancel" }).map((item) => item.id)).toEqual(["2"]);
    expect(getCourierBulkReplacementHeld(orders, { "2": "tomorrow", "3": "sold" }).map((item) => item.id)).toEqual([
      "3",
    ]);
    // Belgilanmagan almashtirish ham sukut «sotildi» — ushlab qolinadi (bu yerdan sotilmaydi).
    expect(getCourierBulkReplacementHeld(orders, { "3": "cancel" }).map((item) => item.id)).toEqual(["2"]);
    expect(getCourierBulkReplacementHeld(orders, {}).map((item) => item.id)).toEqual(["2", "3"]);
    expect(getCourierBulkKept(orders, { "3": "cancel" })).toEqual({ tomorrow: [], replacement: [orders[1]] });
  });

  it("«Sotiladi» soni ushlab qolinganni hisoblamaydi; «belgilanmagan» — belgi qo'yilmaganlarning hammasi (yakunlash vazifalari bilan mos)", () => {
    // Hammasi aniq «Sotildi»: "1" va "4" sotiladi; "2" va "3" ushlab qolinadi — «Kutilayotgan» (total) da qoladi.
    expect(getCourierBulkCounts(orders, allSold)).toEqual({ cancel: 0, sold: 2, tomorrow: 0, total: 4 });
    expect(getCourierBulkUnmarkedCount(orders, allSold)).toBe(0);
    // Hech biri belgilanmagan — natija xuddi hammasi «Sotildi»dagidek (sukut), faqat to'rttalasi «belgilanmagan».
    expect(getCourierBulkCounts(orders, {})).toEqual({ cancel: 0, sold: 2, tomorrow: 0, total: 4 });
    expect(getCourierBulkUnmarkedCount(orders, {})).toBe(4);
    // Aniq «sotildi» belgisi ham almashtirishni sotib yubormaydi; bekor / ertaga — odatdagidek hisoblanadi.
    expect(getCourierBulkCounts(orders, { "1": "sold", "2": "sold", "3": "cancel", "4": "tomorrow" })).toEqual({
      cancel: 1,
      sold: 1,
      tomorrow: 1,
      total: 4,
    });
    // "1" belgilanmagan — sukut «sotildi», «Sotiladi»ga kiradi.
    expect(getCourierBulkCounts(orders, { "2": "sold", "3": "cancel", "4": "tomorrow" })).toEqual({
      cancel: 1,
      sold: 1,
      tomorrow: 1,
      total: 4,
    });
    // Belgilanmagan almashtirish ("2") ham «belgilanmagan» sanaladi (lekin u sotilmaydi — ushlab qolinadi).
    expect(getCourierBulkUnmarkedCount(orders, { "3": "cancel" })).toBe(3);
    const soldTasks = getCourierBulkFinalizeTasks(orders, allSold).filter((task) => task.action === "sold");
    expect(soldTasks).toHaveLength(getCourierBulkCounts(orders, allSold).sold);
    expect(getCourierBulkFinalizeTasks(orders, {})).toHaveLength(getCourierBulkCounts(orders, {}).sold);
  });

  it("isCourierBulkSellBlocked — `old_collected` / oddiy buyurtma bloklanmaydi", () => {
    expect(isCourierBulkSellBlocked(orders[1])).toBe(true);
    expect(isCourierBulkSellBlocked(orders[3])).toBe(false);
    expect(isCourierBulkSellBlocked(orders[0])).toBe(false);
  });
});

type ResultLabel = "Sotildi" | "Bekor" | "Ertaga";

const radio = (name: string, label: ResultLabel) =>
  within(screen.getByRole("radiogroup", { name: `${name}: natija` })).getByRole("radio", { name: label });

const rowOf = (name: string) =>
  screen.getByRole("radiogroup", { name: `${name}: natija` }).closest("tr") as HTMLElement;

/** Belgilanmagan qator: sukut «Sotildi» tanlangan ko'rinadi, qatorda «Belgilanmagan» belgisi. */
const expectUnmarkedSold = (name: string) => {
  expect(radio(name, "Sotildi")).toBeChecked();
  expect(radio(name, "Bekor")).not.toBeChecked();
  expect(radio(name, "Ertaga")).not.toBeChecked();
  expect(within(rowOf(name)).getByText("Belgilanmagan")).toBeInTheDocument();
};

describe("CourierBulkPage — almashtirish buyurtmasi", () => {
  beforeEach(() => {
    resetScanTargets();
    localStorage.clear();
    mocks.get.mockReset();
    mocks.sell.mockReset();
    mocks.cancel.mockReset();
    mocks.bulk.mockReset();
    respondWith([order("10", "Ali"), order("11", "Vali", AWAITING)]);
    mocks.sell.mockResolvedValue({});
    mocks.cancel.mockResolvedValue({});
    mocks.bulk.mockImplementation(({ action, orderIds }: BulkCall) =>
      Promise.resolve({ statusCode: 200, data: { action, total: orderIds.length, succeeded: [...orderIds], failed: [] } }),
    );
  });

  it("⭐ qatorda belgi va izoh; belgisiz almashtirish — tasdiq oynasi «1 ta almashtirish buyurtmasi sotilmaydi»; so'rov faqat oddiyiga", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);

    expect(await screen.findByText("Vali")).toBeInTheDocument();
    const note = screen.getByTestId("courier-bulk-replacement");
    expect(within(note).getByTestId("replacement-badge")).toHaveTextContent("Almashtirish");
    expect(note).toHaveTextContent("«Buyurtmalar»dan «Eski mahsulotni oldim» bilan soting");

    // Sukut «Sotildi»: ikkala qatorda «Sotildi» tanlangan ko'rinadi va «Belgilanmagan» belgisi bor.
    expectUnmarkedSold("Ali");
    expectUnmarkedSold("Vali");

    // Xulosa: «Kutilayotgan 2», lekin «Sotiladi 1» (ushlab qolingan almashtirish sotiladiganlar soniga kirmaydi).
    const summary = screen.getByRole("group", { name: "Kun yakuni" });
    expect(summary).toHaveTextContent(/Kutilayotgan\s*2/);
    expect(summary).toHaveTextContent(/Sotiladi\s*1/);
    expect(summary).toHaveTextContent("Shundan belgilanmagan: 2 ta");

    await user.click(screen.getByRole("button", { name: /Kunni yakunlash/ }));
    const dialog = await screen.findByRole("alertdialog", { name: "Kunni yakunlashni tasdiqlang" });
    expect(dialog).toHaveTextContent("1 ta sotilgan deb belgilanadi");
    // Belgilash katagi faqat haqiqatan sotiladigan belgisizlarni sanaydi (almashtirish — yo'q).
    expect(dialog).toHaveTextContent("Sotilgan holatiga o'tadi — 1 tasi belgilanmagan (skanerlanmagan)");
    expect(dialog).toHaveTextContent("1 ta almashtirish buyurtmasi sotilmaydi");
    expect(dialog).not.toHaveTextContent("ertaga qoladi");
    const confirmButton = within(dialog).getByRole("button", { name: "Tasdiqlash" });
    expect(confirmButton).toBeDisabled();
    await user.click(within(dialog).getByRole("checkbox", { name: "Belgilanmagan 1 ta buyurtma SOTILISHINI tushunaman" }));
    expect(confirmButton).toBeEnabled();

    await user.click(confirmButton);
    await waitFor(() => expect(mocks.bulk).toHaveBeenCalledTimes(1));
    expect(bulkCalls()[0]).toEqual(expect.objectContaining({ action: "sold", orderIds: ["10"] }));
    expect(await screen.findByText(/1 ta almashtirish buyurtmasi «Buyurtmalar»dan sotiladi\./)).toBeInTheDocument();
    expect(screen.queryByText(/belgilanmagan buyurtma o'zgarmadi/)).not.toBeInTheDocument();
    // Yakunlash tugagach ham so'rov soni o'zgarmagan: almashtirishga sotish ham, bekor qilish ham ketmagan.
    expect(mocks.bulk).toHaveBeenCalledTimes(1);
    expect(mocks.sell).not.toHaveBeenCalled();
    expect(mocks.cancel).not.toHaveBeenCalled();
  });

  it("almashtirish «Bekor» belgilansa — odatdagidek bekor qilinadi; belgisiz oddiy qator sukut bo'yicha sotiladi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);

    expect(await screen.findByText("Vali")).toBeInTheDocument();
    await user.click(radio("Vali", "Bekor"));
    expect(radio("Vali", "Bekor")).toBeChecked();
    expect(within(rowOf("Vali")).queryByText("Belgilanmagan")).not.toBeInTheDocument();
    expectUnmarkedSold("Ali");

    const summary = screen.getByRole("group", { name: "Kun yakuni" });
    expect(summary).toHaveTextContent(/Sotiladi\s*1/);
    expect(summary).toHaveTextContent("Shundan belgilanmagan: 1 ta");

    await user.click(screen.getByRole("button", { name: /Kunni yakunlash/ }));
    const dialog = await screen.findByRole("alertdialog", { name: "Kunni yakunlashni tasdiqlang" });
    expect(dialog).toHaveTextContent("1 ta sotilgan deb belgilanadi");
    expect(dialog).toHaveTextContent("Sotilgan holatiga o'tadi — 1 tasi belgilanmagan (skanerlanmagan)");
    expect(dialog).toHaveTextContent("1 ta bekor qilinadi");
    expect(dialog).toHaveTextContent("№11 · Vali — bekor qilingan holatiga o'tadi");
    expect(dialog).not.toHaveTextContent("almashtirish buyurtmasi sotilmaydi");
    expect(dialog).not.toHaveTextContent("ertaga qoladi");

    await user.click(within(dialog).getByRole("checkbox", { name: "Belgilanmagan 1 ta buyurtma SOTILISHINI tushunaman" }));
    await user.click(within(dialog).getByRole("button", { name: "Tasdiqlash" }));
    await waitFor(() => expect(mocks.bulk).toHaveBeenCalledTimes(2));
    // BeePost tartibi: avval bekorlar, keyin sotuvlar.
    expect(bulkCalls().map(({ action, orderIds }) => [action, orderIds])).toEqual([
      ["cancel", ["11"]],
      ["sold", ["10"]],
    ]);
    expect(await screen.findByText(/2 ta buyurtma muvaffaqiyatli yakunlandi/)).toBeInTheDocument();
    expect(screen.queryByText(/almashtirish buyurtmasi «Buyurtmalar»dan sotiladi/)).not.toBeInTheDocument();
    expect(mocks.sell).not.toHaveBeenCalled();
    expect(mocks.cancel).not.toHaveBeenCalled();
  });

  it("yuboriladigan yo'q (oddiysi «Ertaga», almashtirish belgisiz) — so'rov ham, tasdiq oynasi ham yo'q; izohda sababi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);

    expect(await screen.findByText("Vali")).toBeInTheDocument();
    await user.click(radio("Ali", "Ertaga"));
    expectUnmarkedSold("Vali");
    await user.click(screen.getByRole("button", { name: /Kunni yakunlash/ }));

    expect(
      await screen.findByText(
        /Yakunlanadigan buyurtma yo'q — ertaga qoldirilganlar kutilmoqda holatida qoladi\. 1 ta almashtirish buyurtmasi «Buyurtmalar»dan sotiladi\./,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog", { name: "Kunni yakunlashni tasdiqlang" })).not.toBeInTheDocument();
    expect(mocks.bulk).not.toHaveBeenCalled();
    expect(mocks.sell).not.toHaveBeenCalled();
    expect(mocks.cancel).not.toHaveBeenCalled();
  });
});
