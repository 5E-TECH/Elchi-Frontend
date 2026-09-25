import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import SellModal from "./SellModal";
import CancelModal from "./CancelModal";
import { renderWithProviders } from "../../../../../test/test-utils";
import {
  clearPendingExtraCostApproval,
  recordPendingExtraCostApproval,
} from "../../../../../entities/orders/extraCostApproval";

const order = {
  id: "o-1",
  created_at: "2026-09-25T08:00:00.000Z",
  status: "waiting",
  total_price: 120000,
  where_deliver: "center",
  product_quantity: 1,
  market: { name: "BeePost" },
  customer: { name: "Ali Valiyev", phone_number: "+998901234567" },
  district: { name: "Asaka" },
  region: { name: "Andijon" },
  items: [],
};

const renderSell = (props: Partial<Parameters<typeof SellModal>[0]> = {}) =>
  renderWithProviders(
    <SellModal order={order} open onClose={vi.fn()} onSell={vi.fn()} onPartlySell={vi.fn()} {...props} />,
  );

const renderCancel = (props: Partial<Parameters<typeof CancelModal>[0]> = {}) =>
  renderWithProviders(<CancelModal order={order} open onClose={vi.fn()} onCancel={vi.fn()} {...props} />);

const NOTICE = /market tasdig'idan o'tadi/;

describe("SellModal extra cost approval", () => {
  afterEach(() => clearPendingExtraCostApproval("o-1"));

  it("warns up front that an extra cost goes to the market for approval", async () => {
    const user = userEvent.setup();
    renderSell();

    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
    await user.type(screen.getAllByPlaceholderText("0").at(-1)!, "5000");

    expect(screen.getByText(NOTICE)).toBeInTheDocument();
  });

  it("replaces the form with 'Market tasdig'i kutilmoqda' while approval is pending", () => {
    recordPendingExtraCostApproval({ orderId: "o-1", action: "sell", amount: 5000, requestedAt: new Date().toISOString(), orderStatus: "waiting" });
    renderSell({ awaitingApproval: true });

    expect(screen.getByRole("status")).toHaveTextContent("Market tasdig'i kutilmoqda");
    expect(screen.getByRole("status")).toHaveTextContent(/5\D?000 so'm qo'shimcha xarajat marketga tasdiqqa yuborildi/);
    expect(screen.queryByRole("button", { name: /^Sotish$/ })).not.toBeInTheDocument();
    expect(screen.getByText("Yopish", { selector: "button" })).toBeInTheDocument();
  });

  it("reminds about an earlier request but still lets the courier resubmit", () => {
    recordPendingExtraCostApproval({ orderId: "o-1", action: "sell", amount: 5000, requestedAt: new Date().toISOString(), orderStatus: "waiting" });
    renderSell();

    expect(screen.getByText(/qo'shimcha xarajat .* market tasdig'iga yuborilgan/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sotish/ })).toBeEnabled();
  });
});

describe("CancelModal extra cost approval", () => {
  afterEach(() => clearPendingExtraCostApproval("o-1"));

  it("warns up front that an extra cost goes to the market for approval", async () => {
    const user = userEvent.setup();
    renderCancel();

    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
    const [extraCostInput] = screen.getAllByRole("spinbutton");
    await user.clear(extraCostInput);
    await user.type(extraCostInput, "5000");

    expect(screen.getByText(NOTICE)).toBeInTheDocument();
  });

  it("replaces the form with 'Market tasdig'i kutilmoqda' while approval is pending", () => {
    recordPendingExtraCostApproval({ orderId: "o-1", action: "cancel", amount: 5000, requestedAt: new Date().toISOString(), orderStatus: "waiting" });
    renderCancel({ awaitingApproval: true });

    expect(screen.getByRole("status")).toHaveTextContent("Market tasdig'i kutilmoqda");
    expect(screen.queryByRole("button", { name: /Bekor qilish/ })).not.toBeInTheDocument();
    expect(screen.getByText("Yopish", { selector: "button" })).toBeInTheDocument();
  });
});
