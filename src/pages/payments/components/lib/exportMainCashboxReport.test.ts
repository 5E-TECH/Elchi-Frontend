import { afterEach, describe, expect, it, vi } from "vitest";
import type { PaymentRow } from "../patmentHistoryTable";
import { exportMainCashboxReport, type MainCashboxReportLabels } from "./exportMainCashboxReport";

const labels = new Proxy({} as MainCashboxReportLabels, { get: (_target, key) => String(key) });

/** Yuklab olinadigan `.xls` (HTML) matni — `URL.createObjectURL` ga berilgan Blob'dan. */
const exportHtml = async (rows: PaymentRow[]) => {
  let blob: Blob | null = null;
  vi.spyOn(URL, "createObjectURL").mockImplementation((value) => {
    blob = value as Blob;
    return "blob:report";
  });
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  exportMainCashboxReport({ rows, totalBalance: 0, cashBalance: 0, cardBalance: 0, labels });
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
