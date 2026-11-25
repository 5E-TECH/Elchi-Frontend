import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { hidesMarketMoney } from "../../../../entities/order/model/marketMoney";
import { renderWithProviders } from "../../../../test/test-utils";
import { normalizeOrderDetail } from "./orderDetailModel";
import { PaymentCard } from "./PaymentCard";

const order = normalizeOrderDetail({ id: "95", total_price: 150000, to_be_paid: 80000, paid_amount: 5000 })!;

/** D5NxxpJW (ega 2026-11-25): «To'lanishi kerak» = jami − market tarifi — filial xodimiga ko'rinmaydi. */
describe("PaymentCard — market puli (D5NxxpJW)", () => {
  it("⭐ filial xodimi — faqat «Jami»", () => {
    renderWithProviders(<PaymentCard order={order} hideMarketMoney />);
    expect(screen.getByText("Jami")).toBeInTheDocument();
    expect(screen.queryByText("To'lanishi kerak")).not.toBeInTheDocument();
    expect(screen.queryByText("To'langan")).not.toBeInTheDocument();
  });

  it("superadmin, admin, market — uchala qator", () => {
    renderWithProviders(<PaymentCard order={order} />);
    expect(screen.getByText("To'lanishi kerak")).toBeInTheDocument();
    expect(screen.getByText("To'langan")).toBeInTheDocument();
  });

  it("rollar: menejer, filial, registrator", () => {
    expect(["manager", "branch", "registrator", "MANAGER"].every(hidesMarketMoney)).toBe(true);
    expect(["superadmin", "admin", "market", "market_operator", "courier", null, undefined].some(hidesMarketMoney)).toBe(false);
  });
});
