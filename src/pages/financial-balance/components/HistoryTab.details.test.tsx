import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";

const mocks = vi.hoisted(() => ({
  history: {} as unknown,
}));

// qzjTMWPb: kunlik agregatlar bu testda emas — 403 holati: bloklar chizilmaydi, sahifa o'zgarmaydi.
vi.mock("../../../entities/payments/financeDaily", async (importOriginal) => {
  const forbidden = () => ({ isError: true, error: { response: { status: 403 } }, isLoading: false, refetch: vi.fn() });
  return {
    ...(await importOriginal<object>()),
    useFinanceHistoryDaily: forbidden,
    useFinancialBalanceDaily: forbidden,
  };
});

vi.mock("../../../entities/payments/financeCoverage", () => ({
  useFinanceCoverage: () => ({
    useGetFinancialBalanceHistory: () => ({ data: mocks.history, isLoading: false, isError: false, refetch: vi.fn() }),
  }),
}));

import HistoryTab from "./HistoryTab";

/**
 * Balans → Tarix: "Izoh", kim kiritgan, buyurtma havolasi, tafsilot (4WeT0Tv5) — dizayn v2.
 * «Yozuv qo'shish» va Excel endi sahifa sarlavhasida: `FinancialEntryModal.test.tsx`, `index.test.tsx`.
 */

const row = (overrides: Record<string, unknown>) => ({
  id: "65",
  amount: 2,
  balance_before: 1544998,
  balance_after: 1545000,
  source_type: "correction",
  comment: "AUDIT-B rollback - 63/64 neytrallashtirish",
  created_by: "1",
  created_by_user: { id: "1", name: "Dilshod", role: "superadmin" },
  order_id: null,
  createdAt: "2026-09-19T02:18:00.000Z",
  ...overrides,
});

const historyOf = (items: unknown[], total = items.length) => ({
  statusCode: 200,
  data: { items, total, pagination: { total, page: 1, limit: 10, totalPages: Math.ceil(total / 10) } },
});

const open = (route = "/financial-balance?tab=history") => renderWithProviders(<HistoryTab />, { route });

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  mocks.history = historyOf([
    row({}),
    row({ id: "66", source_type: "sell_profit", comment: null, created_by: null, created_by_user: null, order_id: "1001", amount: 15000, balance_before: 1545000, balance_after: 1560000 }),
    row({ id: "67", created_by: "9", created_by_user: null, comment: "Ofis ijarasi", amount: 50000, balance_before: 1560000, balance_after: 1510000 }),
  ]);
});

describe("HistoryTab — Izoh va kim kiritgan (4WeT0Tv5)", () => {
  it("izoh matni jadvalda ko'rinadi, to'liq matn `title` da", () => {
    open();
    const cell = screen.getByText("AUDIT-B rollback - 63/64 neytrallashtirish");
    expect(cell).toHaveAttribute("title", "AUDIT-B rollback - 63/64 neytrallashtirish");
  });

  it("izoh yo'q qatorda \"—\", bo'sh katak emas", () => {
    open();
    const autoRow = screen.getByText("Buyurtma №1001").closest("tr") as HTMLElement;
    expect(within(autoRow).getAllByText("—").length).toBeGreaterThan(0);
  });

  it("kim kiritgan: ism; tizim yozgan — \"Avtomatik\"; ismi topilmagan — #id", () => {
    open();
    expect(screen.getByText("Dilshod")).toBeInTheDocument();
    expect(screen.getByText("Avtomatik")).toBeInTheDocument();
    expect(screen.getByText("#9")).toBeInTheDocument();
  });

  it("order_id bor qator buyurtma sahifasiga havola beradi; qo'lda yozuv — «Qo'lda yozuv»", () => {
    open();
    expect(screen.getByRole("link", { name: "Buyurtma №1001" })).toHaveAttribute("href", "/orders/edit/1001");
    expect(screen.getAllByText("Qo'lda yozuv")).toHaveLength(2);
  });

  it("o'zgarish ishorali va rangli, qoldiq «oldingi → keyingi» (manfiy — haqiqiy minus)", () => {
    open();
    const expenseRow = screen.getByText("Ofis ijarasi").closest("tr") as HTMLElement;
    expect(within(expenseRow).getByText("−50 000 so'm")).toHaveClass("text-danger-fg");
    expect(within(expenseRow).getByText("1 560 000")).toBeInTheDocument();
    expect(within(expenseRow).getByText("1 510 000 so'm")).toBeInTheDocument();
    const autoRow = screen.getByText("Buyurtma №1001").closest("tr") as HTMLElement;
    expect(within(autoRow).getByText("+15 000 so'm")).toHaveClass("text-success-fg");
  });

  it("karta sarlavhasi va jami soni, footer «1–3 / 3 ta yozuv»", () => {
    open();
    expect(screen.getByRole("heading", { name: "Yozuvlar" })).toBeInTheDocument();
    expect(screen.getByText("3 ta")).toBeInTheDocument();
    expect(screen.getByText("1–3 / 3 ta yozuv")).toBeInTheDocument();
  });

  it("qatorga bosilganda to'liq tafsilot oynasi ochiladi", () => {
    open();
    fireEvent.click(screen.getByText("Ofis ijarasi"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("#67")).toBeInTheDocument();
    expect(within(dialog).getByText("Ofis ijarasi")).toBeInTheDocument();
    expect(within(dialog).getByText("#9")).toBeInTheDocument();
    expect(within(dialog).getByText("Qo'lda yozuv")).toBeInTheDocument();
    expect(within(dialog).getByText("Chiqim")).toBeInTheDocument();
    expect(within(dialog).getByText("Bog'lanmagan")).toBeInTheDocument();
  });

  it("«›» tugmasi (klaviatura yo'li) ham tafsilotni ochadi; avtomatik yozuvda buyurtma havolasi", () => {
    open();
    const autoRow = screen.getByText("Buyurtma №1001").closest("tr") as HTMLElement;
    fireEvent.click(within(autoRow).getByRole("button", { name: /Pochta foydasi .* tafsilotini ochish/ }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("#66")).toBeInTheDocument();
    expect(within(dialog).getAllByText("Avtomatik").length).toBeGreaterThan(0);
    expect(within(dialog).getByRole("link", { name: "№1001" })).toHaveAttribute("href", "/orders/edit/1001");
    expect(within(dialog).getByText("Kirim")).toBeInTheDocument();
  });
});

describe("HistoryTab — bo'sh holatlar", () => {
  it("filtr faol va natija yo'q — «Filtrlarni tozalash» URL filtrlarini olib tashlaydi", () => {
    mocks.history = historyOf([]);
    open("/financial-balance?tab=history&financialBalanceHistorySource=salary");
    expect(screen.getByText("Yozuvlar topilmadi")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Filtrlarni tozalash" }));
    // Filtr URL'dan olindi — endi «filtrsiz bo'sh» holat.
    expect(screen.queryByText("Yozuvlar topilmadi")).not.toBeInTheDocument();
    expect(screen.getByText("Hali yozuv yo'q")).toBeInTheDocument();
  });

  it("filtrsiz bo'sh — «Hali yozuv yo'q»", () => {
    mocks.history = historyOf([]);
    open();
    expect(screen.getByText("Hali yozuv yo'q")).toBeInTheDocument();
  });
});
