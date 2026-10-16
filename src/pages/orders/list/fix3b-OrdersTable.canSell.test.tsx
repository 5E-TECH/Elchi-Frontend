import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import OrdersTable from "./OrdersTable";
import { renderWithProviders } from "../../../test/test-utils";
import { isCourierHeldOrder } from "../../../entities/orders/custody";

/**
 * fix3b LC-04 — `canSellOrder` false bo'lgan qatorda "Sotish" ishlamaydi (jadval
 * va telefon kartasi), "Bekor qilish" esa qoladi. Dizayn v2 (maket
 * `manager-orders-list-pending`): tugma yashirilmaydi — o'chiq turadi va
 * sababi nomida, maslahatda (telefonda — matn bilan) aytiladi.
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
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("jadvalda faqat filialdagi qatorda 'Sotish' ishlaydi, kuryerdagisida o'chiq va sababi aytiladi", () => {
    renderTable();

    expect(screen.getByRole("button", { name: "№o-2 ni sotish" })).toBeEnabled();
    const blocked = screen.getByRole("button", { name: "№o-1 ni sotib bo'lmaydi: buyurtma kuryer qo'lida" });
    expect(blocked).toBeDisabled();
    expect(blocked).toHaveAttribute("title", "Kuryer qo'lidagi buyurtmani kuryerning o'zi sotadi");
    expect(screen.queryByRole("button", { name: "№o-1 ni sotish" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /ni bekor qilish$/ })).toHaveLength(2);
  });

  describe("telefon kartasi", () => {
    it("kartada ham kuryerdagi buyurtmada 'Sotish' o'chiq, sababi matnda", () => {
      vi.spyOn(window, "matchMedia").mockImplementation(
        (query: string) =>
          ({
            matches: query === "(max-width: 767px)",
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
          }) as unknown as MediaQueryList,
      );
      renderTable();

      // Karta rejimi: jadval yo'q, har buyurtma — ro'yxat bandi.
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
      const [courierCard, branchCard] = screen.getAllByRole("listitem");

      expect(within(courierCard).getByRole("button", { name: "№o-1 ni sotib bo'lmaydi: buyurtma kuryer qo'lida" })).toBeDisabled();
      expect(within(courierCard).getByText("Sotib bo'lmaydi: kuryer qo'lida — kuryer o'zi sotadi")).toBeInTheDocument();
      expect(within(courierCard).getByRole("button", { name: "№o-1 ni bekor qilish" })).toBeEnabled();

      expect(within(branchCard).getByRole("button", { name: "№o-2 ni sotish" })).toBeEnabled();
      expect(within(branchCard).queryByText(/Sotib bo'lmaydi/)).not.toBeInTheDocument();
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

    expect(screen.getByRole("button", { name: "№o-1 ni sotish" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "№o-2 ni sotish" })).toBeEnabled();
  });
});
