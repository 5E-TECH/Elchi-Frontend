import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import PaymentHistoryList from "./PaymentHistoryList";
import PaymentHistoryTable, { type PaymentRow } from "./patmentHistoryTable";
import { getExpenseCategoryName } from "./lib/expenseCategory";

/**
 * Elchi Pochta №1 — kassa tarixida xarajat kategoriyasi (`expense_category_name`, yozilgan paytdagi nom):
 * «To'lovlar» jadvali va telefon kartalari, kassa tafsilotidagi ro'yxat. Neytral belgi (`data-expense-category`),
 * ekran o'quvchiga «Kategoriya: …»; kategoriyasiz qatorda belgi yo'q. Asosiy kassa jadvali —
 * `mainCashbox.expenseCategory.test.tsx`, tafsilot oynasi — `FinanceHistoryDetailPopup.test.tsx`.
 */

vi.mock("./FinanceHistoryDetailPopup", () => ({ default: () => null }));

const asRole = (role: string) => ({ role: { id: "1", role, region: null, name: role } }) as never;

const spend = (id: string, overrides: Partial<PaymentRow> = {}): PaymentRow => ({
  id,
  amount: 150_000,
  operation_type: "expense",
  source_type: "manual_expense",
  cashbox_type: "main",
  payment_method: "cash",
  comment: "Benzin, oktabr",
  created_by_user: { id: "7", name: "Shodiyor Ergashev" },
  payment_date: "2026-10-21T09:15:00.000Z",
  ...overrides,
});

const rows: PaymentRow[] = [
  spend("21", { expense_category_id: "2", expense_category_name: "Yoqilg'i" }),
  spend("22", { comment: "Kanselyariya", expense_category_id: null, expense_category_name: null }),
];

const phoneMedia = () => {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: query.includes("max-width"),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
};

let restoreMedia: (() => void) | null = null;
afterEach(() => {
  restoreMedia?.();
  restoreMedia = null;
});

describe("getExpenseCategoryName", () => {
  it("bo'sh, faqat bo'shliq yoki yo'q nom — null", () => {
    expect(getExpenseCategoryName({ expense_category_name: " Yoqilg'i " })).toBe("Yoqilg'i");
    expect(getExpenseCategoryName({ expense_category_name: "  " })).toBeNull();
    expect(getExpenseCategoryName({ expense_category_name: null })).toBeNull();
    expect(getExpenseCategoryName({})).toBeNull();
    expect(getExpenseCategoryName(null)).toBeNull();
  });
});

describe("«To'lovlar» tarixi jadvali", () => {
  const open = () =>
    renderWithProviders(<PaymentHistoryTable data={rows} viewerRole="superadmin" />, {
      preloadedState: asRole("superadmin"),
    });

  it("kategoriyali chiqim — manba nomi yonida neytral belgi, kategoriyasizda yo'q", () => {
    open();
    const table = screen.getByRole("table");
    const [withCategory, without] = within(table).getAllByRole("row").slice(1);
    const badge = withCategory.querySelector("[data-expense-category]") as HTMLElement;
    expect(badge).toHaveTextContent("Kategoriya: Yoqilg'i");
    expect(badge).toHaveAttribute("title", "Yoqilg'i");
    expect(without.querySelector("[data-expense-category]")).toBeNull();
  });

  it("telefon kartasi: belgi va karta nomida kategoriya", () => {
    restoreMedia = phoneMedia();
    open();
    const card = screen.getByRole("button", { name: /· Yoqilg'i/ });
    expect(within(card).getByText("Yoqilg'i")).toBeInTheDocument();
    expect(document.querySelectorAll("[data-expense-category]")).toHaveLength(1);
  });
});

describe("kassa tafsilotidagi operatsiyalar ro'yxati", () => {
  it("belgilar qatorida kategoriya, tugma nomida «Kategoriya: …»", () => {
    renderWithProviders(<PaymentHistoryList data={rows} />, { preloadedState: asRole("superadmin") });
    const button = screen.getByRole("button", { name: /Kategoriya: Yoqilg'i/ });
    expect(within(button).getByText("Yoqilg'i")).toBeInTheDocument();
    expect(document.querySelectorAll("[data-expense-category]")).toHaveLength(1);
  });
});
