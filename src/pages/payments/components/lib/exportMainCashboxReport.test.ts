import { afterEach, describe, expect, it, vi } from "vitest";
import type { PaymentRow } from "../patmentHistoryTable";
import { exportMainCashboxReport, type MainCashboxReportLabels } from "./exportMainCashboxReport";

const labels = new Proxy({} as MainCashboxReportLabels, { get: (_target, key) => String(key) });

/** Yuklab olinadigan `.xls` (HTML) matni — `URL.createObjectURL` ga berilgan Blob'dan. */
const exportHtml = async (rows: PaymentRow[], options: { singleTotal?: boolean; totalBalance?: number } = {}) => {
  let blob: Blob | null = null;
  vi.spyOn(URL, "createObjectURL").mockImplementation((value) => {
    blob = value as Blob;
    return "blob:report";
  });
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  exportMainCashboxReport({
    rows,
    totalBalance: options.totalBalance ?? 0,
    cashBalance: 0,
    cardBalance: 0,
    labels,
    singleTotal: options.singleTotal,
  });
  expect(blob).not.toBeNull();
  // jsdom Blob'ida `.text()` yo'q — FileReader bilan o'qiladi.
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob as unknown as Blob);
  });
};

const expense = (over: Partial<PaymentRow>): PaymentRow =>
  ({
    id: "1",
    amount: 150_000,
    operation_type: "expense",
    source_type: "manual_expense",
    payment_method: "cash",
    created_by: "Nilufar Rashidova",
    ...over,
  }) as PaymentRow;

afterEach(() => vi.restoreAllMocks());

describe("exportMainCashboxReport — «Izoh» ustuni", () => {
  it("izoh bo'lsa — izoh; izohsiz chiqimda — kategoriya nomi; ikkalasi ham bo'lmasa — avvalgidek manba turi", async () => {
    const html = await exportHtml([
      expense({ id: "1", comment: "Benzin, oktabr", expense_category_name: "Yoqilg'i" }),
      expense({ id: "2", comment: "", expense_category_name: "Ovqatlanish" }),
      expense({ id: "3", comment: undefined, expense_category_name: null }),
    ]);
    expect(html).toContain('<td class="cell">Benzin, oktabr</td>');
    expect(html).toContain('<td class="cell">Ovqatlanish</td>');
    expect(html).toContain('<td class="cell">manual_expense</td>');
  });
});

describe("exportMainCashboxReport — P0 63HO6cBU: filial kassasi (menejer) bitta «Summa»", () => {
  it("singleTotal: naqd / karta / boshqa ustunlari yo'q — bitta summa (usulsiz qator ham), balans — jami", async () => {
    const html = await exportHtml(
      [
        expense({ id: "1", amount: 150_000, payment_method: "cash" }),
        expense({ id: "2", amount: 70_000, payment_method: undefined }),
        { ...expense({ id: "3", amount: 90_000, payment_method: "click" }), operation_type: "income" } as PaymentRow,
      ],
      { singleTotal: true, totalBalance: 3_785_000 },
    );
    expect(html).not.toContain('<td class="cell subhead">cash</td>');
    expect(html).not.toContain('<td class="cell subhead">card</td>');
    expect(html).not.toContain('<td class="cell subhead">other</td>');
    expect(html).toContain('<td class="cell subhead">amount</td>');
    expect(html).toContain('colspan="4" class="cell title"');
    // Chiqim jami 220 000 (usulsiz qator ham kiradi), kirim 90 000.
    expect(html).toMatch(/summary-blue">220\D000</);
    expect(html).toMatch(/summary-blue">90\D000</);
    expect(html).toMatch(/3\D785\D000/);
    expect(html).not.toContain('class="cell num summary-purple"');
  });

  it("sukut (asosiy kassa): naqd · karta · boshqa ustunlari o'zgarmagan", async () => {
    const html = await exportHtml([expense({ id: "1" })]);
    expect(html).toContain('<td class="cell subhead">cash</td>');
    expect(html).toContain('<td class="cell subhead">card</td>');
    expect(html).toContain('<td class="cell subhead">other</td>');
    expect(html).toContain('colspan="6" class="cell title"');
    expect(html).toContain('class="cell num summary-purple"');
  });
});
