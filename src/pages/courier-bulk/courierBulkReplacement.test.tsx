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
 * Sukut natija YO'Q (ega 2026-11-05): belgilanmagan qator (almashtirish ham) so'rovsiz kutilmoqda qoladi — u
 * «almashtirish» emas, «belgilanmagan» deb hisoblanadi; almashtirish izohi faqat aniq «Sotildi» belgisida.
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

  const allSold = { "1": "sold", "2": "sold", "3": "sold", "4": "sold" } as const;

  it("eski mahsulot olinmagan almashtirish «sotildi» vazifasiga kirmaydi; bekor qilish — kiradi", () => {
    expect(getCourierBulkFinalizeTasks(orders, { "1": "sold", "2": "sold", "3": "cancel", "4": "sold" })).toEqual([
      { order: { id: "1" }, action: "sold" },
      { order: orders[2], action: "cancel" },
      { order: orders[3], action: "sold" },
    ]);
    // Sukut natija yo'q: belgilanmaganlar ("1", "2", "4") uchun vazifa yo'q — faqat aniq «bekor».
    expect(getCourierBulkFinalizeTasks(orders, { "3": "cancel" })).toEqual([{ order: orders[2], action: "cancel" }]);
    expect(getCourierBulkFinalizeTasks(orders, {})).toEqual([]);
  });

  it("ushlab qolinganlar — faqat aniq «sotildi» belgisidagilar; belgilanmagan almashtirish — «belgilanmagan»", () => {
    expect(getCourierBulkReplacementHeld(orders, { "2": "sold", "3": "cancel" }).map((item) => item.id)).toEqual(["2"]);
    expect(getCourierBulkReplacementHeld(orders, { "2": "tomorrow", "3": "sold" }).map((item) => item.id)).toEqual([
      "3",
    ]);
    // Belgilanmagan almashtirish «sotildi» emas — ushlab qolinganlarga kirmaydi, «belgilanmagan» guruhida qoladi.
    expect(getCourierBulkReplacementHeld(orders, { "3": "cancel" })).toEqual([]);
    expect(getCourierBulkReplacementHeld(orders, {})).toEqual([]);
    const kept = getCourierBulkKept(orders, { "3": "cancel" });
    expect(kept.unmarked.map((item) => item.id)).toEqual(["1", "2", "4"]);
    expect(kept.replacement).toEqual([]);
    expect(kept.tomorrow).toEqual([]);
  });

  it("«Sotiladi» soni ushlab qolinganni hisoblamaydi; «belgilanmagan» — belgi qo'yilmaganlarning hammasi (yakunlash vazifalari bilan mos)", () => {
    // Hammasi aniq «Sotildi»: "1" va "4" sotiladi; "2" va "3" ushlab qolinadi — «Kutilayotgan» (total) da qoladi.
    expect(getCourierBulkCounts(orders, allSold)).toEqual({ cancel: 0, sold: 2, tomorrow: 0, total: 4 });
    expect(getCourierBulkUnmarkedCount(orders, allSold)).toBe(0);
    // Sukut natija yo'q: hech biri belgilanmagan — «Sotiladi» 0, to'rttalasi ham (almashtirish ham) belgilanmagan.
    expect(getCourierBulkCounts(orders, {})).toEqual({ cancel: 0, sold: 0, tomorrow: 0, total: 4 });
    expect(getCourierBulkUnmarkedCount(orders, {})).toBe(4);
    // Aniq «sotildi» belgisi ham almashtirishni sotib yubormaydi; bekor / ertaga — odatdagidek hisoblanadi.
    expect(getCourierBulkCounts(orders, { "1": "sold", "2": "sold", "3": "cancel", "4": "tomorrow" })).toEqual({
      cancel: 1,
      sold: 1,
      tomorrow: 1,
      total: 4,
    });
    // "1" belgilanmagan — «Sotiladi»ga kirmaydi (sukut «sotildi» yo'q).
    expect(getCourierBulkCounts(orders, { "2": "sold", "3": "cancel", "4": "tomorrow" })).toEqual({
      cancel: 1,
      sold: 0,
      tomorrow: 1,
      total: 4,
    });
    // Belgilanmagan almashtirish ("2") ham sanaladi — u ham yakunlashda o'zgarmaydi.
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

const RESULT_LABELS = ["Sotildi", "Bekor", "Ertaga"] as const;

const radio = (name: string, label: (typeof RESULT_LABELS)[number]) =>
  within(screen.getByRole("radiogroup", { name: `${name}: natija` })).getByRole("radio", { name: label });

const rowOf = (name: string) =>
  screen.getByRole("radiogroup", { name: `${name}: natija` }).closest("tr") as HTMLElement;

/** Sukut natija yo'q: qatorda hech qaysi variant («Sotildi» ham) tanlanmagan. */
const expectNoResultChecked = (name: string) => {
  RESULT_LABELS.forEach((label) => expect(radio(name, label)).not.toBeChecked());
};

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

  it("⭐ qatorda belgi va izoh; ikkalasi «Sotildi» — tasdiq oynasi «1 ta almashtirish buyurtmasi sotilmaydi»; so'rov faqat oddiyiga", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);

    expect(await screen.findByText("Vali")).toBeInTheDocument();
    const note = screen.getByTestId("courier-bulk-replacement");
    expect(within(note).getByTestId("replacement-badge")).toHaveTextContent("Almashtirish");
    expect(note).toHaveTextContent("«Buyurtmalar»dan «Eski mahsulotni oldim» bilan soting");

    // Sukut natija yo'q: belgilanmaguncha hech qaysi variant tanlanmagan, «Sotiladi 0», ikkalasi belgilanmagan —
    // almashtirish qatorida ham «Belgilanmagan» belgisi bor (u ham yakunlashda o'zgarmaydi).
    const summary = screen.getByRole("group", { name: "Kun yakuni" });
    expectNoResultChecked("Ali");
    expectNoResultChecked("Vali");
    expect(within(rowOf("Ali")).getByText("Belgilanmagan")).toBeInTheDocument();
    expect(within(rowOf("Vali")).getByText("Belgilanmagan")).toBeInTheDocument();
    expect(summary).toHaveTextContent(/Kutilayotgan\s*2/);
    expect(summary).toHaveTextContent(/Sotiladi\s*0/);
    expect(summary).toHaveTextContent("Belgilanmagan: 2 ta — o'zgarmaydi");

    await user.click(radio("Ali", "Sotildi"));
    await user.click(radio("Vali", "Sotildi"));
    expect(radio("Ali", "Sotildi")).toBeChecked();
    expect(radio("Vali", "Sotildi")).toBeChecked();
    expect(within(rowOf("Ali")).queryByText("Belgilanmagan")).not.toBeInTheDocument();
    expect(within(rowOf("Vali")).queryByText("Belgilanmagan")).not.toBeInTheDocument();

    // Xulosa: «Kutilayotgan 2», lekin «Sotiladi 1» (ushlab qolingan almashtirish sotiladiganlar soniga kirmaydi).
    expect(summary).toHaveTextContent(/Kutilayotgan\s*2/);
    expect(summary).toHaveTextContent(/Sotiladi\s*1/);
    expect(summary).toHaveTextContent("Belgilanmagan: 0 ta — o'zgarmaydi");

    await user.click(screen.getByRole("button", { name: /Kunni yakunlash/ }));
    const dialog = await screen.findByRole("alertdialog", { name: "Kunni yakunlashni tasdiqlang" });
    expect(dialog).toHaveTextContent("1 ta sotilgan deb belgilanadi");
    expect(dialog).toHaveTextContent("Sotilgan holatiga o'tadi");
    expect(dialog).toHaveTextContent("1 ta almashtirish buyurtmasi sotilmaydi");
    expect(dialog).not.toHaveTextContent("ertaga qoladi");
    expect(dialog).not.toHaveTextContent("belgilanmagan");

    await user.click(within(dialog).getByRole("button", { name: "Tasdiqlash" }));
    await waitFor(() => expect(mocks.sell).toHaveBeenCalledTimes(1));
    expect(mocks.sell).toHaveBeenCalledWith(expect.objectContaining({ orderId: "10" }));
    expect(await screen.findByText(/1 ta almashtirish buyurtmasi «Buyurtmalar»dan sotiladi\./)).toBeInTheDocument();
    expect(screen.queryByText(/belgilanmagan buyurtma o'zgarmadi/)).not.toBeInTheDocument();
    // Yakunlash tugagach ham so'rov soni o'zgarmagan: almashtirishga sotish ham, bekor qilish ham ketmagan.
    expect(mocks.sell).toHaveBeenCalledTimes(1);
    expect(mocks.cancel).not.toHaveBeenCalled();
  });

  it("belgilanmagan almashtirish — «almashtirish» emas, «belgilanmagan»: so'rovsiz qoladi, faqat «Sotildi» belgilangan oddiyiga so'rov", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);

    expect(await screen.findByText("Vali")).toBeInTheDocument();
    await user.click(radio("Ali", "Sotildi"));
    expect(radio("Ali", "Sotildi")).toBeChecked();
    expectNoResultChecked("Vali");
    expect(within(rowOf("Ali")).queryByText("Belgilanmagan")).not.toBeInTheDocument();
    expect(within(rowOf("Vali")).getByText("Belgilanmagan")).toBeInTheDocument();

    const summary = screen.getByRole("group", { name: "Kun yakuni" });
    expect(summary).toHaveTextContent(/Sotiladi\s*1/);
    expect(summary).toHaveTextContent("Belgilanmagan: 1 ta — o'zgarmaydi");

    await user.click(screen.getByRole("button", { name: /Kunni yakunlash/ }));
    const dialog = await screen.findByRole("alertdialog", { name: "Kunni yakunlashni tasdiqlang" });
    expect(dialog).toHaveTextContent("1 ta sotilgan deb belgilanadi");
    expect(dialog).toHaveTextContent("Sotilgan holatiga o'tadi");
    expect(dialog).toHaveTextContent("1 tasi belgilanmagan — o'zgarmaydi");
    expect(dialog).toHaveTextContent("Kutilmoqda holatida qoladi");
    expect(dialog).not.toHaveTextContent("almashtirish buyurtmasi sotilmaydi");
    expect(dialog).not.toHaveTextContent("ertaga qoladi");

    await user.click(within(dialog).getByRole("button", { name: "Tasdiqlash" }));
    await waitFor(() => expect(mocks.sell).toHaveBeenCalledTimes(1));
    expect(mocks.sell).toHaveBeenCalledWith(expect.objectContaining({ orderId: "10" }));
    expect(await screen.findByText(/1 ta belgilanmagan buyurtma o'zgarmadi\./)).toBeInTheDocument();
    expect(screen.queryByText(/almashtirish buyurtmasi «Buyurtmalar»dan sotiladi/)).not.toBeInTheDocument();
    // Yakunlash tugagach: belgilanmagan "11" ga so'rov ketmagan.
    expect(mocks.sell).toHaveBeenCalledTimes(1);
    expect(mocks.sell).not.toHaveBeenCalledWith(expect.objectContaining({ orderId: "11" }));
    expect(mocks.cancel).not.toHaveBeenCalled();
  });

  it("hech narsa belgilanmagan — so'rov ham, tasdiq oynasi ham yo'q; izoh «2 ta belgilanmagan buyurtma o'zgarmadi»", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);

    expect(await screen.findByText("Vali")).toBeInTheDocument();
    expectNoResultChecked("Ali");
    expectNoResultChecked("Vali");
    await user.click(screen.getByRole("button", { name: /Kunni yakunlash/ }));

    expect(
      await screen.findByText(/Yakunlanadigan buyurtma yo'q\. 2 ta belgilanmagan buyurtma o'zgarmadi\./),
    ).toBeInTheDocument();
    // Belgilanmagan almashtirish «almashtirish» izohiga tushmaydi — u ham «belgilanmagan».
    expect(screen.queryByText(/almashtirish buyurtmasi «Buyurtmalar»dan sotiladi/)).not.toBeInTheDocument();
    expect(screen.queryByRole("alertdialog", { name: "Kunni yakunlashni tasdiqlang" })).not.toBeInTheDocument();
    expect(mocks.sell).not.toHaveBeenCalled();
    expect(mocks.cancel).not.toHaveBeenCalled();
  });
});
