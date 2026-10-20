import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import CourierOrders from "./index";
import { renderWithProviders } from "../../../../test/test-utils";
import {
  EXTRA_COST_APPROVAL_POLL_MS,
  clearPendingExtraCostApproval,
} from "../../../../entities/orders/extraCostApproval";
import { ORDERS_REFRESH_INTERVAL_MS } from "../useOrdersRefresh";

const waitingOrder = {
  id: "1251165",
  created_at: "2026-09-25T08:00:00.000Z",
  status: "waiting",
  total_price: 250000,
  where_deliver: "center",
  product_quantity: 1,
  market: { name: "BeePost" },
  customer: { name: "TEST-E2E-AND-4", phone_number: "+998900000014" },
  district: { name: "Andijon shahri" },
  region: { name: "Andijon" },
  items: [],
};

const approvalResponse = {
  statusCode: 202,
  message: "Market tasdig'i kutilmoqda",
  data: { approval_required: true, approval: { id: "a-9", action: "cancel", amount: 5000, status: "pending" } },
};

type MutateOptions = { onSuccess?: (response: unknown) => void };
const sellMutate = vi.fn();
const cancelMutate = vi.fn();
const idle = { mutate: vi.fn(), isPending: false };
let courierRefetchInterval: ((data: unknown) => number | false) | undefined;
const listResponse = { data: [waitingOrder], total: 1, page: 1, limit: 10 };

vi.mock("../../../../entities/orders", () => ({
  useOrders: () => ({
    useGetOrderCourier: (_params: unknown, refetchInterval?: (data: unknown) => number | false) => {
      courierRefetchInterval = refetchInterval;
      return { data: listResponse, isLoading: false };
    },
    useGetCourierOrderCounts: () => ({ data: undefined }),
    SellOrder: { mutate: sellMutate, isPending: false },
    PartlySellOrder: idle,
    RollbackOrder: idle,
    CancelOrder: { mutate: cancelMutate, isPending: false },
    SendToPost: idle,
  }),
}));

/**
 * Oyna ichidagi tugma. Dizayn v2 `Dialog` `#ui-portal` ga chiziladi; u testlar orasida saqlanadi va
 * keyingi testning konteyneridan OLDIN turadi — `getAllByRole(…).at(-1)` endi qatordagi tugmani olardi.
 * «Yopish» — oxirgisi (sarlavhadagi × ham «Yopish»).
 */
const dialogButton = (name: RegExp | string) => within(screen.getByRole("dialog")).getAllByRole("button", { name }).at(-1)!;

const renderPage = () => renderWithProviders(<CourierOrders />, { route: "/orders?status=waiting" });

const openModal = async (user: ReturnType<typeof userEvent.setup>, buttonName: RegExp) => {
  const buttons = screen.getAllByRole("button", { name: buttonName });
  await user.click(buttons[0]);
};

describe("Courier orders — extra cost approval flow", () => {
  beforeEach(() => {
    sellMutate.mockReset();
    cancelMutate.mockReset();
  });
  afterEach(() => clearPendingExtraCostApproval(waitingOrder.id));

  it("keeps the cancel modal open with 'Market tasdig'i kutilmoqda' when extraCost=5000 needs approval", async () => {
    const user = userEvent.setup();
    cancelMutate.mockImplementation((_vars, options: MutateOptions) => options.onSuccess?.(approvalResponse));
    renderPage();

    // Qator tugmasi nomi maketdagidek: «№1251165 ni bekor qilish» (ko'rinadigan matn «Bekor qilish»).
    await openModal(user, /ni bekor qilish$/);
    const extraCostInput = screen.getByLabelText("Qo'shimcha xarajat");
    await user.clear(extraCostInput);
    await user.type(extraCostInput, "5000");
    // Sabab — `Select` (combobox): ochib, variantni bosish.
    await user.click(screen.getByRole("combobox", { name: /^Sabab/ }));
    await user.click(await screen.findByRole("option", { name: "Mijoz rad etdi" }));
    await user.click(dialogButton(/^Bekor qilish$/));

    expect(cancelMutate).toHaveBeenCalledWith(
      { orderId: "1251165", data: expect.objectContaining({ extraCost: 5000, reason: "CUSTOMER_REFUSED" }) },
      expect.any(Object),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Market tasdig'i kutilmoqda");
  });

  it("marks the order in the list and polls the list until the market decides", async () => {
    const user = userEvent.setup();
    cancelMutate.mockImplementation((_vars, options: MutateOptions) => options.onSuccess?.(approvalResponse));
    renderPage();

    // Oyna yopiq — avtomatik yangilanish (OR-1, 60 s).
    expect(courierRefetchInterval?.(listResponse)).toBe(ORDERS_REFRESH_INTERVAL_MS);

    // Qator tugmasi nomi maketdagidek: «№1251165 ni bekor qilish» (ko'rinadigan matn «Bekor qilish»).
    await openModal(user, /ni bekor qilish$/);
    const extraCostInput = screen.getByLabelText("Qo'shimcha xarajat");
    await user.clear(extraCostInput);
    await user.type(extraCostInput, "5000");
    // Sabab — `Select` (combobox): ochib, variantni bosish.
    await user.click(screen.getByRole("combobox", { name: /^Sabab/ }));
    await user.click(await screen.findByRole("option", { name: "Mijoz rad etdi" }));
    await user.click(dialogButton(/^Bekor qilish$/));
    await user.click(dialogButton("Yopish"));

    const row = screen.getByText("TEST-E2E-AND-4").closest("tr") as HTMLElement;
    // Kuryer maketi (`courier-orders-action-approval-pending`): «Tasdiq kutilmoqda» belgisi.
    expect(within(row).getByText("Tasdiq kutilmoqda")).toBeInTheDocument();
    expect(courierRefetchInterval?.(listResponse)).toBe(EXTRA_COST_APPROVAL_POLL_MS);
    // Market tasdiqladi → buyurtma holati o'zgardi → 30 s lik polling tugaydi, oddiy avtomatik yangilanish
    // (OR-1, 60 s) qoladi.
    expect(courierRefetchInterval?.({ data: [{ ...waitingOrder, status: "cancelled" }] })).toBe(ORDERS_REFRESH_INTERVAL_MS);
  });

  it("closes the sell modal as before when there is no extra cost (regression)", async () => {
    const user = userEvent.setup();
    sellMutate.mockImplementation((_vars, options: MutateOptions) =>
      options.onSuccess?.({ statusCode: 200, data: { id: "1251165", status: "sold" } }),
    );
    renderPage();

    await openModal(user, /ni sotish$/);
    await user.click(dialogButton(/^Sotish$/));

    expect(sellMutate).toHaveBeenCalledWith(
      { orderId: "1251165", data: expect.objectContaining({ extraCost: 0 }) },
      expect.any(Object),
    );
    // Tasdiq so'ralmadi — oyna yopildi, «Market tasdig'i kutilmoqda» holati yo'q; amal bajarilgani xabar bilan.
    expect(screen.queryByText("Market tasdig'i kutilmoqda")).not.toBeInTheDocument();
    expect(await screen.findByText("Buyurtma sotildi")).toBeInTheDocument();
    expect(screen.queryByText("Qo'shimcha to'lov")).not.toBeInTheDocument();
  });
});
