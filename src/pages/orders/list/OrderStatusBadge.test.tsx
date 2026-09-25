import { screen, waitFor } from "@testing-library/react";
import OrderStatusBadge from "./OrderStatusBadge";
import { renderWithProviders } from "../../../test/test-utils";
import {
  clearPendingExtraCostApproval,
  recordPendingExtraCostApproval,
} from "../../../entities/orders/extraCostApproval";

describe("OrderStatusBadge extra cost approval marker", () => {
  afterEach(() => clearPendingExtraCostApproval("o-1"));

  it("marks an order whose extra cost was sent for market approval", () => {
    recordPendingExtraCostApproval({
      orderId: "o-1",
      action: "sell",
      amount: 5000,
      requestedAt: new Date().toISOString(),
      orderStatus: "waiting",
    });

    renderWithProviders(<OrderStatusBadge orderId="o-1" status="waiting" />);

    expect(screen.getByText("Tasdiqqa yuborilgan")).toBeInTheDocument();
    expect(screen.getByLabelText(/5\D?000 so'm qo'shimcha xarajat .* market tasdig'iga yuborilgan/)).toBeInTheDocument();
  });

  it("drops the marker once the order moved on (market approved and the action ran)", async () => {
    recordPendingExtraCostApproval({
      orderId: "o-1",
      action: "sell",
      amount: 5000,
      requestedAt: new Date().toISOString(),
      orderStatus: "waiting",
    });

    renderWithProviders(<OrderStatusBadge orderId="o-1" status="sold" />);

    expect(screen.queryByText("Tasdiqqa yuborilgan")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(JSON.parse(window.localStorage.getItem("extra_cost_pending_approvals") ?? "{}")["o-1"]).toBeUndefined(),
    );
  });

  it("shows no marker for orders without a pending request", () => {
    renderWithProviders(<OrderStatusBadge orderId="o-1" status="waiting" />);

    expect(screen.queryByText("Tasdiqqa yuborilgan")).not.toBeInTheDocument();
  });
});

describe("OrderStatusBadge", () => {
  it("renders sold status with translated label", () => {
    renderWithProviders(<OrderStatusBadge status="sold" />);

    expect(screen.getByText("Sotilgan")).toBeInTheDocument();
  });

  it("renders cancelled status styles", () => {
    renderWithProviders(<OrderStatusBadge status="cancelled" />);

    expect(screen.getByText("Bekor qilingan")).toHaveClass("text-red-700");
  });

  it("renders the distinct cancelled sent translation with cancelled styles", () => {
    renderWithProviders(<OrderStatusBadge status="cancelled (sent)" />);

    expect(screen.getByText("Bekor qilingan — jo'natilgan")).toHaveClass("text-red-700");
  });

  it("renders paid status label", () => {
    renderWithProviders(<OrderStatusBadge status="paid" />);

    expect(screen.getByText("To'langan")).toBeInTheDocument();
  });

  it("falls back safely for known created status", () => {
    renderWithProviders(<OrderStatusBadge status="created" />);

    expect(screen.getByText("Qabul qilingan")).toBeInTheDocument();
  });
});
