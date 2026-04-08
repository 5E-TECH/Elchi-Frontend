import { screen } from "@testing-library/react";
import OrderStatusBadge from "./OrderStatusBadge";
import { renderWithProviders } from "../../../test/test-utils";

describe("OrderStatusBadge", () => {
  it("renders sold status with translated label", () => {
    renderWithProviders(<OrderStatusBadge status="sold" />);

    expect(screen.getByText("Sotilgan")).toBeInTheDocument();
  });

  it("renders cancelled status styles", () => {
    renderWithProviders(<OrderStatusBadge status="cancelled" />);

    expect(screen.getByText("Bekor qilingan")).toHaveClass("text-red-600");
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
