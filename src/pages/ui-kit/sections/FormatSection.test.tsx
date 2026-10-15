import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { FormatSection } from "./FormatSection";

/**
 * «Formatlash» bo'limi — maket `Main` → «Format standarti»: har qator uz | ru | en ustunlarida
 * formatlovchining HAQIQIY natijasi (aniq til bilan), «hozir» qotirilgan (08.10.2026).
 */

const renderSection = (route = "/ops/ui-kit?section=format") => renderWithProviders(<FormatSection />, { route });

/** Jadval qatorining `td` kataklari: [qoida, uz, ru, en] (sarlavha — `th`). */
const rowCells = (table: HTMLElement, title: string) => {
  // Qator sarlavhasi (`th scope="row"`) ichidagi nom — aniq matn bo'yicha («Sana» ≠ «Sana va vaqt»).
  const row = within(table).getByText(title, { selector: 'th[scope="row"] > span' }).closest("tr");
  if (!row) throw new Error(`qator topilmadi: ${title}`);
  return Array.from(row.querySelectorAll("td")).map((cell) => ({
    text: cell.textContent,
    lang: cell.getAttribute("lang"),
    className: cell.className,
  }));
};

describe("FormatSection", () => {
  it("kunduzgi va tungi panelda bittadan jadval, maketdagi ustunlar", () => {
    renderSection();
    const tables = screen.getAllByRole("table", { name: "Format namunalari" });
    expect(tables).toHaveLength(2);
    const headers = within(tables[0]).getAllByRole("columnheader").map((th) => th.textContent);
    expect(headers).toEqual(["Tur", "Qoida", "O'zbekcha", "Ruscha", "Inglizcha"]);
  });

  it.each([
    ["Pul", ["185 000 so'm", "185 000 сум", "185,000 UZS"]],
    ["Kirim", ["+120 000 so'm", "+120 000 сум", "+120,000 UZS"]],
    // Haqiqiy minus U+2212 (maketdagi «−240 000 so'm»), chiziqcha `-` emas.
    ["Qarz, chiqim", ["\u2212240 000 so'm", "\u2212240 000 сум", "\u2212240,000 UZS"]],
    ["Ixcham · ming", ["185 ming so'm", "185 тыс. сум", "185K UZS"]],
    ["Ixcham · million", ["12,4 mln so'm", "12,4 млн сум", "12.4M UZS"]],
    ["Ixcham · milliard", ["1,2 mlrd so'm", "1,2 млрд сум", "1.2B UZS"]],
    // Ruscha — son va `%` orasida bo'linmas bo'sh joy (maketda «8,2 %»).
    ["Foiz", ["8,2%", "8,2\u00a0%", "8.2%"]],
    ["Telefon", ["+998 90 123 45 67", "+998 90 123 45 67", "+998 90 123 45 67"]],
    ["Sana", ["08.10.2026", "08.10.2026", "08.10.2026"]],
    ["Sana va vaqt", ["06.10.2026, 19:05", "06.10.2026, 19:05", "06.10.2026, 19:05"]],
    [
      "Nisbiy sana",
      ["Bugun, 14:15 · Kecha, 18:04", "Сегодня, 14:15 · Вчера, 18:04", "Today, 14:15 · Yesterday, 18:04"],
    ],
  ])("%s — uz | ru | en (lang atributi bilan)", (title, expected) => {
    renderSection();
    const [table] = screen.getAllByRole("table", { name: "Format namunalari" });
    const cells = rowCells(table, title);
    // 0 — qoida ustuni; 1..3 — tillar.
    expect(cells.slice(1).map((cell) => cell.text)).toEqual(expected);
    expect(cells.slice(1).map((cell) => cell.lang)).toEqual(["uz", "ru", "en"]);
  });

  it("kirim — success-fg, qarz — danger-fg, qolgan qiymatlar oddiy matn rangi (bitta rang klassi)", () => {
    renderSection();
    const [table] = screen.getAllByRole("table", { name: "Format namunalari" });
    const valueClasses = (title: string) => rowCells(table, title).slice(1).map((cell) => cell.className);
    for (const className of valueClasses("Kirim")) {
      expect(className).toContain("text-success-fg");
      expect(className).not.toMatch(/\btext-text\b/);
    }
    for (const className of valueClasses("Qarz, chiqim")) {
      expect(className).toContain("text-danger-fg");
      expect(className).not.toMatch(/\btext-text\b/);
    }
    for (const className of valueClasses("Pul")) {
      expect(className).toMatch(/\btext-text\b/);
      expect(className).not.toMatch(/text-(success|danger)-fg/);
    }
    // Qoida katagi faqat kulrang (`text-text` bilan to'qnashmaydi).
    const [rule] = rowCells(table, "Pul");
    expect(rule.className).toContain("text-text-muted");
    expect(rule.className).not.toMatch(/\btext-text(?!-)/);
    // Telefon ro'yxati ham rangni oladi.
    const [list] = screen.getAllByRole("list", { name: "Format namunalari" });
    expect(within(list).getAllByText("\u2212240 000 so'm")[0].closest("dd")).toHaveClass("text-danger-fg");
  });

  it("panellar har doim ustma-ust (layout=stack), klass bilan bosib o'tilmaydi", () => {
    const { container } = renderSection();
    const pair = container.querySelector('[data-kit-layout]');
    expect(pair).toHaveAttribute("data-kit-layout", "stack");
    expect(pair?.className).toContain("grid-cols-1");
    expect(pair?.className).not.toContain("grid-cols-2");
    expect(pair?.className).not.toContain("!");
  });

  it("qoidalar maketdagi matn bilan; valyuta birliklari formatMoney'dan", () => {
    renderSection();
    const [table] = screen.getAllByRole("table", { name: "Format namunalari" });
    expect(rowCells(table, "Pul")[0].text).toBe("Minglik — bo'sh joy (inglizchada vergul); birlik: so'm, сум, UZS");
    expect(rowCells(table, "Nisbiy sana")[0].text).toBe(
      "Jadval va ro'yxatlarda: bugun va kecha; eskisi — 06.10.2026, 19:05",
    );
    expect(rowCells(table, "Kirim")[0].text).toBe("Plyus belgisi, yashil");
    expect(rowCells(table, "Qarz, chiqim")[0].text).toBe("Haqiqiy minus (\u2212), qizil");
  });

  it("tor konteyner uchun ro'yxat ko'rinishi ham bor (telefon: jadval → kartalar)", () => {
    renderSection();
    const lists = screen.getAllByRole("list", { name: "Format namunalari" });
    expect(lists).toHaveLength(2);
    expect(within(lists[0]).getAllByRole("listitem")).toHaveLength(11);
    expect(within(lists[0]).getAllByText("Today, 14:15")).toHaveLength(1);
  });

  it("?theme-pair=0 — bitta panel", () => {
    renderSection("/ops/ui-kit?section=format&theme-pair=0");
    expect(screen.getAllByRole("table", { name: "Format namunalari" })).toHaveLength(1);
  });
});
