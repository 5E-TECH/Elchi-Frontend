import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CashboxShift } from "../../../entities/payments";
import { renderWithProviders } from "../../../test/test-utils";
import ShiftResultDialog from "./ShiftResultDialog";

/**
 * P0 63HO6cBU (ega 2026-11-17): filial kassasi bitta jami — menejerning natija oynasida (`singleTotal`) bitta «Jami»
 * ustuni. Smena migratsiyadan (245) oldin ochilgan bo'lsa karta maydonlari 0 emas bo'lishi mumkin: jami har ko'rsatkichda
 * naqd + karta, farq — `discrepancy_cash + (discrepancy_card ?? 0)`, sanalgan — karta sanalgan bo'lsagina qo'shiladi.
 */

const baseShift: CashboxShift = {
  id: "77",
  opened_by: "42",
  status: "closed",
  opened_at: "2026-11-17T04:00:00.000Z",
  closed_at: "2026-11-17T13:00:00.000Z",
  opening_balance_cash: 900_000,
  opening_balance_card: 100_000,
  total_income_cash: 300_000,
  total_income_card: 50_000,
  total_expense_cash: 100_000,
  total_expense_card: 0,
  expected_balance_cash: 1_100_000,
  expected_balance_card: 150_000,
  closing_balance_cash: 1_200_000,
  closing_balance_card: 140_000,
  discrepancy_cash: 100_000,
  discrepancy_card: -10_000,
};

const open = (shift: CashboxShift) =>
  renderWithProviders(
    <ShiftResultDialog
      open
      onClose={vi.fn()}
      onExport={vi.fn()}
      shift={shift}
      cashboxLabel="Urgut filiali kassasi"
      cardLabel="Karta"
      singleTotal
    />,
  );

/** Jadval qatori (`th` — ko'rsatkich nomi) → «Jami» katagi matni. */
const totalCell = (table: HTMLElement, metric: string) => {
  const row = within(table).getByRole("rowheader", { name: metric }).closest("tr") as HTMLTableRowElement;
  return (row.querySelector("td")?.textContent ?? "").replace(/\s+/g, " ").trim();
};

describe("ShiftResultDialog — singleTotal (filial kassasi bitta jami)", () => {
  it("karta maydonlari 0 emas: jami = naqd + karta, farq = discrepancy_cash + discrepancy_card", () => {
    open(baseShift);
    const table = screen.getByRole("table", { name: "Smena natijasi: kassa jami" });
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent?.trim())).toEqual(["Ko'rsatkich", "Jami"]);
    expect(totalCell(table, "Ochilishda")).toBe("1 000 000 so'm");
    expect(totalCell(table, "Kirim")).toBe("+350 000 so'm");
    expect(totalCell(table, "Chiqim")).toBe("−100 000 so'm");
    expect(totalCell(table, "Kutilgan")).toBe("1 250 000 so'm");
    expect(totalCell(table, "Sanalgan")).toBe("1 340 000 so'm");
    expect(totalCell(table, "Farq")).toMatch(/^\+90 000 so'm/);
    expect(screen.queryByText(/Karta sanalmadi/)).not.toBeInTheDocument();
  });

  it("karta sanalmagan (discrepancy_card null): farq va sanalgan — faqat naqd qismi", () => {
    open({ ...baseShift, closing_balance_card: 0, discrepancy_card: null });
    const table = screen.getByRole("table", { name: "Smena natijasi: kassa jami" });
    expect(totalCell(table, "Sanalgan")).toBe("1 200 000 so'm");
    expect(totalCell(table, "Farq")).toMatch(/^\+100 000 so'm/);
    expect(screen.queryByText(/Karta sanalmadi/)).not.toBeInTheDocument();
  });
});
