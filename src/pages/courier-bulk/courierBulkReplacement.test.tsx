import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CourierBulkPage from "./index";
import { renderWithProviders } from "../../test/test-utils";
import { resetScanTargets } from "../../shared/lib/scanner/scanTargets";
import {
  getCourierBulkCounts,
  getCourierBulkFinalizeTasks,
  getCourierBulkReplacementHeld,
  getCourierBulkUnmarkedCount,
  isCourierBulkSellBlocked,
} from "./model/courierBulk";

/**
 * lQjt6sKP — «Tezkor amal»da almashtirish buyurtmasi: eski mahsulot olinmaguncha backend «Eski mahsulotni oldim»
 * tasdig'isiz sotishni rad etadi (400). Ommaviy yopishda tasdiq yo'q — bunday buyurtma «sotildi» bo'lib
 * yuborilmaydi (kutilmoqda qoladi), tasdiq oynasi va qator buni aytadi; bekor qilish — odatdagidek.
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

  it("eski mahsulot olinmagan almashtirish «sotildi» vazifasiga kirmaydi; bekor qilish — kiradi", () => {
    expect(getCourierBulkFinalizeTasks(orders, { "3": "cancel" })).toEqual([
      { order: { id: "1" }, action: "sold" },
      { order: orders[2], action: "cancel" },
      { order: orders[3], action: "sold" },
    ]);
  });

  it("ushlab qolinganlar — faqat «sotildi» (aniq yoki sukut) belgisidagilar", () => {
    expect(getCourierBulkReplacementHeld(orders, { "3": "cancel" }).map((item) => item.id)).toEqual(["2"]);
    expect(getCourierBulkReplacementHeld(orders, { "2": "tomorrow" }).map((item) => item.id)).toEqual(["3"]);
  });

  it("«Sotiladi» soni va «belgilanmagan» izohi ushlab qolinganni hisoblamaydi (yakunlash vazifalari bilan mos)", () => {
    // "1" va "4" sotiladi; "2" va "3" ushlab qolinadi — «Kutilayotgan» (total) da qoladi.
    expect(getCourierBulkCounts(orders, {})).toEqual({ cancel: 0, sold: 2, tomorrow: 0, total: 4 });
    expect(getCourierBulkUnmarkedCount(orders, {})).toBe(2);
    // Aniq «sotildi» belgisi ham sotib yubormaydi; bekor / ertaga — odatdagidek hisoblanadi.
    expect(getCourierBulkCounts(orders, { "2": "sold", "3": "cancel", "4": "tomorrow" })).toEqual({
      cancel: 1,
      sold: 1,
      tomorrow: 1,
      total: 4,
    });
    expect(getCourierBulkUnmarkedCount(orders, { "3": "cancel" })).toBe(2);
    const soldTasks = getCourierBulkFinalizeTasks(orders, {}).filter((task) => task.action === "sold");
    expect(soldTasks).toHaveLength(getCourierBulkCounts(orders, {}).sold);
  });

  it("isCourierBulkSellBlocked — `old_collected` / oddiy buyurtma bloklanmaydi", () => {
    expect(isCourierBulkSellBlocked(orders[1])).toBe(true);
    expect(isCourierBulkSellBlocked(orders[3])).toBe(false);
    expect(isCourierBulkSellBlocked(orders[0])).toBe(false);
  });
});

describe("CourierBulkPage — almashtirish buyurtmasi", () => {
  beforeEach(() => {
    resetScanTargets();
    mocks.get.mockReset();
    mocks.sell.mockReset();
    mocks.cancel.mockReset();
    respondWith([order("10", "Ali"), order("11", "Vali", AWAITING)]);
    mocks.sell.mockResolvedValue({});
    mocks.cancel.mockResolvedValue({});
  });

  it("⭐ qatorda belgi va izoh; tasdiq oynasi «1 ta almashtirish buyurtmasi sotilmaydi»; so'rov faqat oddiyiga", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);

    expect(await screen.findByText("Vali")).toBeInTheDocument();
    const note = screen.getByTestId("courier-bulk-replacement");
    expect(within(note).getByTestId("replacement-badge")).toHaveTextContent("Almashtirish");
    expect(note).toHaveTextContent("«Buyurtmalar»dan «Eski mahsulotni oldim» bilan soting");

    // Xulosa: «Kutilayotgan 2», lekin «Sotiladi 1» (ushlab qolingan almashtirish sotiladiganlar soniga kirmaydi).
    const summary = screen.getByRole("group", { name: "Kun yakuni" });
    expect(summary).toHaveTextContent(/Kutilayotgan\s*2/);
    expect(summary).toHaveTextContent(/Sotiladi\s*1/);
    expect(summary).toHaveTextContent("1 tasi belgilanmagan, sukut bo'yicha");

    await user.click(screen.getByRole("button", { name: /Kunni yakunlash/ }));
    const dialog = await screen.findByRole("alertdialog", { name: "Kunni yakunlashni tasdiqlang" });
    expect(dialog).toHaveTextContent("1 ta sotilgan deb belgilanadi");
    expect(dialog).toHaveTextContent("1 tasi belgilanmagan, sukut bo'yicha");
    expect(dialog).toHaveTextContent("1 ta almashtirish buyurtmasi sotilmaydi");
    expect(dialog).not.toHaveTextContent("ertaga qoladi");

    await user.click(within(dialog).getByRole("button", { name: "Tasdiqlash" }));
    await waitFor(() => expect(mocks.sell).toHaveBeenCalledTimes(1));
    expect(mocks.sell).toHaveBeenCalledWith(expect.objectContaining({ orderId: "10" }));
    expect(await screen.findByText(/1 ta almashtirish buyurtmasi «Buyurtmalar»dan sotiladi\./)).toBeInTheDocument();
  });
});
