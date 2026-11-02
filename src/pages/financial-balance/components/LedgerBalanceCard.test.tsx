import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import LedgerBalanceCard from "./LedgerBalanceCard";

const query = vi.hoisted(() => ({ current: {} as Record<string, unknown>, ranges: [] as unknown[] }));

vi.mock("../../../entities/payments/financeDaily", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useFinancialBalanceDaily: (range: unknown) => {
    query.ranges.push(range);
    return query.current;
  },
}));
vi.mock("../../payments/components/MainCashboxBalanceChart", () => ({
  default: ({ points }: { points: Array<{ date: string; balance: number }> }) => (
    <ol data-testid="points">
      {points.map((point) => (
        <li key={point.date}>{`${point.date}:${point.balance}`}</li>
      ))}
    </ol>
  ),
}));

const ledgerDay = (closing: number | null) => ({
  openingBalance: 0,
  closingBalance: closing,
  income: 10,
  expense: 5,
  net: 5,
  count: 1,
});
const data = {
  from: "2026-10-01",
  to: "2026-10-03",
  ledger: {
    openingBalance: 7_507_000,
    closingBalance: 8_437_500,
    income: 9_836_500,
    expense: 8_906_000,
    net: 930_500,
    count: 186,
    peak: { date: "2026-10-02", balance: 15_805_000 },
  },
  days: [
    { date: "2026-10-01", snapshot: null, ledger: ledgerDay(8_000_000) },
    { date: "2026-10-02", snapshot: null, ledger: ledgerDay(15_805_000) },
    { date: "2026-10-03", snapshot: null, ledger: ledgerDay(null) },
  ],
};
const refetch = vi.fn();

const renderCard = (generalBalance: number | null = 22_500_000) =>
  renderWithProviders(<LedgerBalanceCard fromDate="2026-10-01" toDate="2026-10-03" generalBalance={generalBalance} />);

beforeEach(() => {
  query.ranges = [];
  query.current = { data, isLoading: false, isError: false, dataUpdatedAt: Date.now(), refetch };
});

describe("LedgerBalanceCard (qzjTMWPb)", () => {
  it("davr boshi, sof o'zgarish, eng yuqori — serverdan; o'tgan davr «Davr oxirida»", () => {
    renderCard();
    expect(query.ranges[0]).toEqual({ from: "2026-10-01", to: "2026-10-03" });
    const card = screen.getByRole("region", { name: "Daftar qoldig'i" });
    expect(card).toHaveTextContent("Davr oxirida");
    expect(card).toHaveTextContent("8 437 500 so'm");
    expect(card).toHaveTextContent("Davr boshida");
    expect(card).toHaveTextContent("7 507 000 so'm");
    expect(card).toHaveTextContent("30.09.2026 oxirida");
    expect(card).toHaveTextContent("+930 500 so'm");
    expect(card).toHaveTextContent("+12,4% · 186 ta yozuv");
    expect(card).toHaveTextContent("15 805 000 so'm");
    expect(card).toHaveTextContent("02.10.2026");
    expect(card).toHaveTextContent("Umumiy balans (22,5 mln so'm)");
  });

  it("grafik davr boshi nuqtasidan boshlanadi, qoldig'i yo'q kun tashlanadi", () => {
    renderCard();
    expect(screen.getByTestId("points").textContent).toBe(
      "2026-09-30:75070002026-10-01:80000002026-10-02:15805000",
    );
  });

  it("403 — karta chizilmaydi", () => {
    query.current = { data: undefined, isLoading: false, isError: true, error: { response: { status: 403 } }, refetch };
    renderCard();
    expect(screen.queryByRole("region", { name: "Daftar qoldig'i" })).not.toBeInTheDocument();
  });

  it("xato — ko'rsatkichlar (0 lar) chizilmaydi", () => {
    query.current = { data: undefined, isLoading: false, isError: true, error: { response: { status: 500 } }, refetch };
    renderCard(null);
    expect(screen.queryByText("Davr boshida")).not.toBeInTheDocument();
    expect(screen.queryByText(/\b0 so'm/)).not.toBeInTheDocument();
  });
});
