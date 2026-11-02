import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import CashFlowCard from "./CashFlowCard";

const query = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock("../../../entities/payments/financeDaily", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useFinanceHistoryDaily: () => query.current,
}));

const days = [
  { date: "2026-10-07", income: 920_000, expense: 1_650_000, net: -730_000, incomeCount: 2, expenseCount: 3, openingBalance: 100, closingBalance: 200 },
  { date: "2026-10-08", income: 6_970_000, expense: 2_400_000, net: 4_570_000, incomeCount: 9, expenseCount: 3, openingBalance: 200, closingBalance: 300 },
];
const data = {
  from: "2026-10-07",
  to: "2026-10-08",
  filtered: false,
  balanceStatus: "ok",
  openingBalance: 100,
  closingBalance: 300,
  totals: { income: 7_890_000, expense: 4_050_000, net: 3_840_000, incomeCount: 11, expenseCount: 6 },
  days,
};
const refetch = vi.fn();

const renderCard = (variant: "staff" | "manager" = "staff") =>
  renderWithProviders(<CashFlowCard variant={variant} params={{}} cashboxLabel="Asosiy kassa" />);

beforeEach(() => {
  query.current = { data, isLoading: false, isError: false, refetch };
});

describe("CashFlowCard (qzjTMWPb)", () => {
  it("«Pul oqimi»: davr jami serverdan, sarlavhada davr va kassa", () => {
    renderCard();
    const card = screen.getByRole("region", { name: "Pul oqimi" });
    expect(card).toHaveTextContent("07.10 – 08.10.2026 · Asosiy kassa");
    expect(card).toHaveTextContent("+7 890 000 so'm");
    expect(card).toHaveTextContent("−4 050 000 so'm");
    expect(card).toHaveTextContent("+3 840 000 so'm");
    expect(card).toHaveTextContent("11 ta operatsiya");
    expect(card).toHaveTextContent("kirimning 48,7%i kassada qoldi");
    expect(within(card).getByRole("img", { name: /Asosiy kassa pul oqimi/ })).toBeInTheDocument();
  });

  it("«Jadval» — har kun alohida qator, yangisi tepada", async () => {
    renderCard();
    await userEvent.click(screen.getByRole("radio", { name: "Jadval" }));
    const rows = within(screen.getByRole("table", { name: "Pul oqimi" })).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("08.10.2026");
    expect(rows[1]).toHaveTextContent("+4 570 000 so'm");
    expect(rows[2]).toHaveTextContent("−730 000 so'm");
  });

  it("«Kassa oqimi» (menejer): kun soni yorliqda, sof oqim izohi yo'q", () => {
    renderCard("manager");
    const card = screen.getByRole("region", { name: "Kassa oqimi" });
    expect(card).toHaveTextContent("Kirim · 2 kun");
    expect(card).toHaveTextContent("Chiqim · 2 kun");
    expect(card).toHaveTextContent("Sof o'zgarish");
    expect(card).toHaveTextContent("Bekor qilish va xarajatlar chiqimga kiradi");
  });

  it("oqim yo'q davr — bo'sh holat, grafik chizilmaydi", () => {
    query.current = {
      ...query.current,
      data: { ...data, totals: { income: 0, expense: 0, net: 0, incomeCount: 0, expenseCount: 0 }, days: days.map((day) => ({ ...day, income: 0, expense: 0, net: 0 })) },
    };
    renderCard();
    expect(screen.getByText("Bu davrda kirim va chiqim yo'q")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /pul oqimi/ })).not.toBeInTheDocument();
  });

  it("xato — «Qayta urinish», summalar o'rnida yolg'on 0 yo'q", async () => {
    query.current = { data: undefined, isLoading: false, isError: true, error: { response: { status: 500 } }, refetch };
    renderCard();
    expect(screen.getByText("Kunlik ma'lumotni yuklab bo'lmadi")).toBeInTheDocument();
    expect(screen.queryByText(/0 so'm/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("403 — karta butunlay yashirinadi", () => {
    query.current = { data: undefined, isLoading: false, isError: true, error: { response: { status: 403 } }, refetch };
    renderCard();
    expect(screen.queryByRole("region", { name: "Pul oqimi" })).not.toBeInTheDocument();
  });

  it("yuklanishda summalar yo'q (skelet)", () => {
    query.current = { data: undefined, isLoading: true, isError: false, refetch };
    renderCard();
    expect(screen.getByRole("status", { name: "Grafik yuklanmoqda" })).toBeInTheDocument();
    expect(screen.queryByText(/so'm/)).not.toBeInTheDocument();
  });
});
