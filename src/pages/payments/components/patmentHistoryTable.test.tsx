import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import PaymentHistoryTable, { type PaymentRow } from "./patmentHistoryTable";
import { renderWithProviders } from "../../../test/test-utils";

vi.mock("../../../entities/payments", () => ({
  useCashBox: () => ({
    useGetFinanceHistoryById: () => ({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() }),
  }),
}));

const asRole = (role: string) => ({ role: { id: "1", role, region: null, name: role } }) as never;

const rows: PaymentRow[] = [
  {
    id: "11",
    amount: 1_850_000,
    operation_type: "income",
    source_type: "courier_payment",
    cashbox_type: "main",
    created_by_user: { id: "7", name: "Shodiyor Ergashev" },
    source_user: { id: "8", name: "Jasur Tursunov" },
    payment_date: "2026-10-06T09:32:00.000Z",
  },
  {
    id: "12",
    amount: 2_400_000,
    operation_type: "expense",
    source_type: "market_payment",
    cashbox_type: "main",
    created_by_user: { id: "7", name: "Shodiyor Ergashev" },
    source_user: { id: "3", name: "Baraka Shop" },
    payment_date: "2026-10-06T08:05:00.000Z",
  },
  {
    id: "13",
    amount: 420_000,
    operation_type: "income",
    source_type: "sell",
    source_id: "10246",
    cashbox_type: "couriers",
    created_by: "",
    comment: "e'tiborga olinmaydi — buyurtma raqami ustun",
    payment_date: "2026-10-06T08:00:00.000Z",
  },
];

const open = (props: Partial<Parameters<typeof PaymentHistoryTable>[0]> = {}, role = "superadmin") =>
  renderWithProviders(
    <PaymentHistoryTable
      data={rows}
      pagination={{ total: 128, page: 1, limit: 10, totalPages: 13 }}
      onPageChange={vi.fn()}
      viewerRole={role}
      {...props}
    />,
    { preloadedState: asRole(role) },
  );

describe("PaymentHistoryTable (v2 «Operatsiyalar tarixi»)", () => {
  it("renders the mockup columns: date, creator, source title + counterparty, cashbox, badge, signed amount", () => {
    open();

    const table = screen.getByRole("table", { name: "Operatsiyalar tarixi" });
    const headers = within(table).getAllByRole("columnheader").map((cell) => cell.textContent);
    expect(headers).toEqual(["Sana", "Yaratgan", "Manba", "Kassa", "Operatsiya", "Summa", "Tafsilot"]);

    const [first, second, third] = within(table).getAllByRole("row").slice(1);
    expect(within(first).getByRole("button", { name: "Kuryer to'lovi" })).toBeInTheDocument();
    expect(within(first).getByText("Jasur Tursunov")).toBeInTheDocument();
    expect(within(first).getAllByText("Shodiyor Ergashev").length).toBeGreaterThan(0);
    expect(within(first).getByText("Asosiy kassa")).toBeInTheDocument();
    expect(within(first).getByText("Kirim")).toBeInTheDocument();
    expect(within(first).getByText("+1 850 000 so'm")).toHaveClass("text-success-fg");

    expect(within(second).getByRole("button", { name: "Market to'lovi" })).toBeInTheDocument();
    expect(within(second).getByText("Chiqim")).toBeInTheDocument();
    expect(within(second).getByText("−2 400 000 so'm")).toHaveClass("text-danger-fg");

    // Buyurtma bo'yicha manba — ostida «Buyurtma №…» (izoh emas); yaratgan noma'lum — «—».
    expect(within(third).getByText("Buyurtma №10246")).toBeInTheDocument();
    expect(within(third).queryByText(/e'tiborga olinmaydi/)).not.toBeInTheDocument();
    expect(within(third).getByText("Kuryer kassasi")).toBeInTheDocument();
  });

  it("footer: «1–10 / 128 ta operatsiya» and page change", async () => {
    const onPageChange = vi.fn();
    open({ onPageChange });

    expect(screen.getByText("1–10 / 128 ta operatsiya")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "2" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("the chevron opens the detail dialog of that row", async () => {
    open();

    await userEvent.setup().click(
      screen.getByRole("button", { name: /^Market to'lovi \(.+\) tafsilotini ochish$/ }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Chiqim operatsiyasi" });
    expect(dialog.querySelector("[data-history-amount]")).toHaveTextContent("−2 400 000so'm");
  });

  it("empty: «Operatsiyalar topilmadi»; with active filters — a clear action", async () => {
    const onClearFilters = vi.fn();
    open({ data: [], pagination: { total: 0, page: 1, limit: 10, totalPages: 1 }, onClearFilters, clearFiltersLabel: "Filtrlarni tozalash" });

    expect(screen.getByText("Operatsiyalar topilmadi")).toBeInTheDocument();
    expect(screen.queryByText(/ta operatsiya$/)).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Filtrlarni tozalash" }));
    expect(onClearFilters).toHaveBeenCalled();
  });

  it("error: «Operatsiyalarni yuklab bo'lmadi» + retry", async () => {
    const onRetry = vi.fn();
    open({ data: undefined, isError: true, error: new Error("500"), onRetry });

    expect(screen.getByText("Operatsiyalarni yuklab bo'lmadi")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("manager: the branch cashbox is the manager's «Asosiy kassa»; courier_payment is «Kuryerdan filialga o'tkazma»", () => {
    open(
      {
        data: [
          {
            id: "21",
            amount: 1_180_000,
            operation_type: "income",
            source_type: "courier_payment",
            cashbox_type: "branch",
            source_user: { id: "2", name: "Sardor Qurbonov" },
          },
        ],
      },
      "manager",
    );

    const row = within(screen.getByRole("table")).getAllByRole("row")[1];
    expect(within(row).getByRole("button", { name: "Kuryerdan filialga o'tkazma" })).toBeInTheDocument();
    expect(within(row).getAllByText("Asosiy kassa").length).toBeGreaterThan(0);
  });
});
