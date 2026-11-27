import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CourierBulkPage from "./index";
import { renderWithProviders } from "../../test/test-utils";
import { resetScanTargets } from "../../shared/lib/scanner/scanTargets";

/**
 * Audit #4: menejer «Kunni yakunlash» bilan filialdagi BARCHA kuryerlarning buyurtmalarini bir bosishda yakunlaydi
 * (sukut «sotildi», kuryer qo'lidagisi kuryer nomidan — LC-04). Kuryerning «Bekor» skanlari uning telefonida —
 * menejerda ular belgisiz. Ega qarori (2026-11-27): bir bosish qoladi, lekin tasdiq oynasida kuryerlar bo'yicha
 * jadval — kim nomidan nechta sotiladi / bekor / qoladi va kimning kassasiga qancha; kuni tugamagan kuryerni katak
 * bilan chiqarib qo'yish (uning buyurtmalariga so'rov ketmaydi).
 */

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  sell: vi.fn(),
  cancel: vi.fn(),
  bulk: vi.fn(),
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
  playScanFeedback: vi.fn(() => Promise.resolve()),
}));

type BulkCall = { action: "sold" | "cancel"; orderIds: string[] };

const bulkSummary = () =>
  mocks.bulk.mock.calls.map(([call]) => [(call as BulkCall).action, (call as BulkCall).orderIds]);

const bulkBody = ({ action, orderIds }: BulkCall) => ({
  statusCode: 200,
  data: { action, total: orderIds.length, succeeded: orderIds, failed: [] },
});

const ALI = { id: "328", name: "Ali Kuryer", phone_number: "+998900000328" };
const VALI = { id: "329", name: "Vali Kuryer", phone_number: "+998900000329" };

const order = (id: string, name: string, totalPrice: number, over: Record<string, unknown> = {}) => ({
  id,
  status: "waiting",
  total_price: totalPrice,
  createdAt: "2026-11-27T08:00:00.000Z",
  qr_code_token: `tok-${id}-qr`,
  customer: { name, phone_number: "+998901112233" },
  market: { name: "Baraka Shop" },
  ...over,
});

const heldBy = (courier: typeof ALI) => ({
  holder_type: "COURIER",
  holder_courier_id: courier.id,
  courier_id: courier.id,
  courier,
});
const AT_BRANCH = { holder_type: "BRANCH", holder_courier_id: null, courier_id: null, courier: null };

const respondWith = (orders: unknown[]) =>
  mocks.get.mockResolvedValue({ data: { statusCode: 200, data: { data: orders, total: orders.length } } });

const asManager = () =>
  ({
    role: { id: "295", role: "manager", region: null, name: "Jasur Tursunov" },
    user: { user: { id: "295", role: "manager", can_sell_cancel: true } },
  }) as never;

const radio = (name: string, label: "Sotildi" | "Bekor" | "Ertaga") =>
  within(screen.getByRole("radiogroup", { name: `${name}: natija` })).getByRole("radio", { name: label });

const finalize = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: /Kunni yakunlash/ }));
  return screen.findByRole("alertdialog", { name: "Kunni yakunlashni tasdiqlang" });
};

const rowOf = (dialog: HTMLElement, group: string) =>
  within(dialog)
    .getAllByTestId("courier-bulk-breakdown-row")
    .find((row) => row.dataset.group === group) as HTMLElement;

const cells = (row: HTMLElement) => within(row).getAllByRole("cell").map((cell) => cell.textContent);

beforeEach(() => {
  resetScanTargets();
  localStorage.clear();
  mocks.get.mockReset();
  mocks.sell.mockReset();
  mocks.cancel.mockReset();
  mocks.bulk.mockReset();
  mocks.bulk.mockImplementation((call: BulkCall) => Promise.resolve(bulkBody(call)));
});

const MANAGER_ORDERS = [
  order("10", "Aziz", 150000, heldBy(ALI)),
  order("11", "Bobur", 200000, heldBy(ALI)),
  order("12", "Dilshod", 120000, heldBy(ALI)),
  order("20", "Erkin", 300000, heldBy(VALI)),
  order("21", "Farhod", 80000, heldBy(VALI)),
  order("30", "G'ani", 70000, AT_BRANCH),
];

describe("«Kunni yakunlash» — kuryerlar bo'yicha jadval (menejer)", () => {
  it("har kuryer: nechta sotiladi / bekor / qoladi va kimning kassasiga qancha; filial alohida; jami", async () => {
    respondWith(MANAGER_ORDERS);
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />, { preloadedState: asManager() });

    expect(await screen.findByText("Aziz")).toBeInTheDocument();
    await user.click(radio("Dilshod", "Bekor"));
    await user.click(radio("Farhod", "Ertaga"));
    const dialog = await finalize(user);

    const table = within(dialog).getByRole("region", { name: "Kuryerlar bo'yicha" });
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
      "Kuryer",
      "Sotildi",
      "Bekor",
      "Qoladi",
      "Kassaga",
    ]);
    const ali = rowOf(dialog, "courier:328");
    expect(ali).toHaveTextContent("Ali Kuryer");
    expect(ali).toHaveTextContent("kuryer kassasiga");
    expect(cells(ali).slice(1)).toEqual(["2", "1", "0", "350 000 so'm"]);
    expect(cells(rowOf(dialog, "courier:329")).slice(1)).toEqual(["1", "0", "1", "300 000 so'm"]);
    const branch = rowOf(dialog, "branch");
    expect(branch).toHaveTextContent("Filialda turganlar");
    expect(branch).toHaveTextContent("filial kassasiga");
    expect(cells(branch).slice(1)).toEqual(["1", "0", "0", "70 000 so'm"]);
    expect(within(dialog).getByTestId("courier-bulk-breakdown-total")).toHaveTextContent("720 000 so'm");
    // Tartib: kuryerlar ism bo'yicha, filial oxirida.
    expect(
      within(dialog).getAllByTestId("courier-bulk-breakdown-row").map((row) => row.dataset.group),
    ).toEqual(["courier:328", "courier:329", "branch"]);
  });

  it("katagi olib tashlangan kuryerga so'rov ketmaydi; sonlar va xavfsizlik katagi yangilanadi", async () => {
    respondWith(MANAGER_ORDERS);
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />, { preloadedState: asManager() });

    expect(await screen.findByText("Aziz")).toBeInTheDocument();
    const dialog = await finalize(user);
    const acknowledgeAll = within(dialog).getByRole("checkbox", {
      name: "Belgilanmagan 6 ta buyurtma SOTILISHINI tushunaman",
    });
    await user.click(acknowledgeAll);

    // Ali kunini hali yakunlamagan — menejer uni chiqarib qo'yadi.
    await user.click(within(dialog).getByRole("checkbox", { name: "Ali Kuryer — yakunlashga qo'shish" }));
    const ali = rowOf(dialog, "courier:328");
    expect(ali).toHaveAttribute("data-included", "false");
    expect(ali).toHaveTextContent("Tegilmaydi — kutilmoqda qoladi");
    expect(within(dialog).getByTestId("courier-bulk-breakdown-total")).toHaveTextContent("450 000 so'm");
    expect(dialog).toHaveTextContent("3 ta buyurtma: quyidagilar bajariladi");
    expect(dialog).toHaveTextContent("Kuryer qo'lidagi 2 ta buyurtma kuryer nomidan sotiladi");
    // Son o'zgardi — xavfsizlik katagi qaytadan belgilanadi.
    const acknowledge = within(dialog).getByRole("checkbox", {
      name: "Belgilanmagan 3 ta buyurtma SOTILISHINI tushunaman",
    });
    expect(acknowledge).not.toBeChecked();
    expect(within(dialog).getByRole("button", { name: "Tasdiqlash" })).toBeDisabled();

    await user.click(acknowledge);
    await user.click(within(dialog).getByRole("button", { name: "Tasdiqlash" }));

    expect(await screen.findByText(/Tanlanmagan kuryerlarning 3 ta buyurtmasiga tegilmadi\./)).toBeInTheDocument();
    expect(bulkSummary()).toEqual([["sold", ["20", "21", "30"]]]);
    expect(mocks.sell).not.toHaveBeenCalled();
    expect(mocks.cancel).not.toHaveBeenCalled();
  });

  it("oxirgi tanlangan kuryerni olib bo'lmaydi (bo'sh yakunlash o'rniga — «Orqaga»)", async () => {
    respondWith([order("10", "Aziz", 150000, heldBy(ALI)), order("20", "Erkin", 300000, heldBy(VALI))]);
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />, { preloadedState: asManager() });

    expect(await screen.findByText("Aziz")).toBeInTheDocument();
    const dialog = await finalize(user);
    await user.click(within(dialog).getByRole("checkbox", { name: "Ali Kuryer — yakunlashga qo'shish" }));
    expect(within(dialog).getByRole("checkbox", { name: "Vali Kuryer — yakunlashga qo'shish" })).toBeDisabled();
    // Qayta qo'shilsa — ikkalasi yana faol.
    await user.click(within(dialog).getByRole("checkbox", { name: "Ali Kuryer — yakunlashga qo'shish" }));
    expect(within(dialog).getByRole("checkbox", { name: "Vali Kuryer — yakunlashga qo'shish" })).toBeEnabled();
  });

  it("bitta kuryer — jadval bor, katak yo'q", async () => {
    respondWith([order("10", "Aziz", 150000, heldBy(ALI)), order("11", "Bobur", 50000, heldBy(ALI))]);
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />, { preloadedState: asManager() });

    expect(await screen.findByText("Aziz")).toBeInTheDocument();
    const dialog = await finalize(user);
    expect(cells(rowOf(dialog, "courier:328")).slice(1)).toEqual(["2", "0", "0", "200 000 so'm"]);
    expect(within(dialog).queryByRole("checkbox", { name: /yakunlashga qo'shish/ })).not.toBeInTheDocument();
    expect(within(dialog).queryByTestId("courier-bulk-breakdown-total")).not.toBeInTheDocument();
  });
});

describe("«Kunni yakunlash» — kuryerning o'z sahifasi", () => {
  it("bitta qator: o'z buyurtmalari, kassasiga qancha; katak yo'q", async () => {
    respondWith([order("10", "Aziz", 150000, heldBy(ALI)), order("11", "Bobur", 200000, heldBy(ALI))]);
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);

    expect(await screen.findByText("Aziz")).toBeInTheDocument();
    await user.click(radio("Bobur", "Bekor"));
    const dialog = await finalize(user);
    const self = rowOf(dialog, "self");
    expect(self).toHaveTextContent("Mening buyurtmalarim");
    expect(self).toHaveTextContent("kassangizga");
    expect(cells(self).slice(1)).toEqual(["1", "1", "0", "150 000 so'm"]);
    expect(within(dialog).queryByRole("checkbox", { name: /yakunlashga qo'shish/ })).not.toBeInTheDocument();
  });
});
