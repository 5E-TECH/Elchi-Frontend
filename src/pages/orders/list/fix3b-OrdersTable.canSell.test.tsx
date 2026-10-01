import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OrdersTable from "./OrdersTable";
import { renderWithProviders } from "../../../test/test-utils";
import { isCourierHeldOrder } from "../../../entities/orders/custody";

/**
 * fix3b LC-04 — `canSellOrder` false bo'lgan qatorda "Sotish" yo'q (jadval
 * va telefon kartasi), "Bekor qilish" esa qoladi.
 */

const row = (id: string, name: string, custody: Record<string, unknown>) => ({
  id,
  customer: { name, phone_number: "+998901234567" },
  district: { name: "Guliston", region: { name: "Sirdaryo" } },
  market: { name: "Yandex" },
  status: "waiting",
  where_deliver: "center",
  total_price: 150000,
  createdAt: "2026-10-01T08:00:00.000Z",
  ...custody,
});

const rows = [
  row("o-1", "Kuryerdagi", { holder_type: "COURIER", holder_courier_id: "289" }),
  row("o-2", "Filialdagi", { holder_type: "BRANCH", holder_courier_id: null }),
];

const renderTable = () =>
  renderWithProviders(
    <OrdersTable
      data={rows as never}
      isLoading={false}
      canUseOrderActions={() => true}
      canSellOrder={(order) => !isCourierHeldOrder(order)}
      onSellOrder={vi.fn()}
      onCancelOrder={vi.fn()}
      onRollbackOrder={vi.fn()}
    />,
  );

describe("OrdersTable — canSellOrder (fix3b LC-04)", () => {
  it("jadvalda faqat filialdagi qatorda 'Sotish'", () => {
    renderTable();

    expect(screen.getAllByRole("button", { name: "Sotish" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Bekor qilish" })).toHaveLength(2);
  });

  describe("telefon kartasi", () => {
    const originalWidth = window.innerWidth;

    beforeEach(() => {
      Object.defineProperty(window, "innerWidth", { value: 375, configurable: true, writable: true });
    });

    afterEach(() => {
      Object.defineProperty(window, "innerWidth", { value: originalWidth, configurable: true, writable: true });
    });

    it("kartada ham kuryerdagi buyurtmada 'Sotish' yo'q", () => {
      renderTable();

      // Karta rejimi: mijoz nomi kartaning sarlavhasi (jadvalda <p>).
      expect(screen.getByRole("heading", { name: "Kuryerdagi" })).toBeInTheDocument();

      expect(screen.getAllByRole("button", { name: "Sotish" })).toHaveLength(1);
      expect(screen.getAllByRole("button", { name: "Bekor qilish" })).toHaveLength(2);
    });
  });

  it("canSellOrder berilmasa — avvalgidek har qatorda", () => {
    renderWithProviders(
      <OrdersTable
        data={rows as never}
        isLoading={false}
        canUseOrderActions={() => true}
        onSellOrder={vi.fn()}
        onCancelOrder={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("button", { name: "Sotish" })).toHaveLength(2);
  });
});
