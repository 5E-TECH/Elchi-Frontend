import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import QuickActions from "./QuickActions";

describe("QuickActions — «Tezkor harakatlar»", () => {
  it("market (sukut): «Buyurtmalarni ko'rish» → /new-orders, «Buyurtma yaratish» faqat ruxsat bilan", () => {
    renderWithProviders(<QuickActions canAddOrder />);
    expect(screen.getByRole("link", { name: /Buyurtmalarni ko'rish/ })).toHaveAttribute("href", "/new-orders");
    expect(screen.getByRole("link", { name: /Buyurtma yaratish/ })).toHaveAttribute("href", "/new-orders/create");
  });

  it("market operatori (MO-2): «Buyurtmalarni ko'rish» → /orders (qabul bo'limi yo'q)", () => {
    renderWithProviders(<QuickActions canAddOrder={false} orders="list" />);
    const link = screen.getByRole("link", { name: /Buyurtmalarni ko'rish/ });
    expect(link).toHaveAttribute("href", "/orders");
    expect(link).toHaveTextContent("Market buyurtmalari ro'yxati");
    expect(screen.queryByRole("link", { name: /Buyurtma yaratish/ })).not.toBeInTheDocument();
  });

  it("birorta band qolmasa — karta umuman chizilmaydi", () => {
    renderWithProviders(<QuickActions canAddOrder={false} orders={null} />);
    expect(screen.queryByRole("heading", { name: "Tezkor harakatlar" })).not.toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
