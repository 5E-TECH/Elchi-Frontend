import type { PaymentRow } from "../patmentHistoryTable";

const fmt = (value: number) =>
  value.toLocaleString("uz-UZ", { maximumFractionDigits: 0 });

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const normalizeMethod = (value?: string) => {
  const method = String(value ?? "").toLowerCase();
  if (["cash", "naqd"].includes(method)) return "cash";
  if (["card", "click", "payme", "transfer", "karta"].includes(method)) return "card";
  return "other";
};

export type MainCashboxReportLabels = {
  defaultReportTitle: string;
  mainCashbox: string;
  income: string;
  expense: string;
  expenseSection: string;
  balance: string;
  cash: string;
  card: string;
  total: string;
  no: string;
  fromWhere: string;
  toWhere: string;
  other: string;
  comment: string;
  summaryIncome: string;
  summaryExpense: string;
};

/** Qator summasi ustunlari (to'lov turi bo'yicha): naqd · karta · boshqa. */
type AmountColumn = "cash" | "card" | "other";

const COLUMNS: readonly AmountColumn[] = ["cash", "card", "other"];

const formatDateLabel = (date: string | undefined, labels: MainCashboxReportLabels) => {
  if (!date) return labels.defaultReportTitle;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
};

const buildRows = (rows: PaymentRow[], type: "income" | "expense") => {
  const filtered = rows.filter((row) => row.operation_type === type);

  return filtered.map((row, index) => {
    const amount = Math.abs(Number(row.amount ?? 0));
    const method = normalizeMethod(row.payment_method);

    return {
      no: index + 1,
      name: row.created_by || row.source_id || row.source_type || "-",
      // Izohsiz chiqim (izoh ixtiyoriy, kategoriya majburiy — 2026-10-22) — «Izoh» ustunida kategoriya nomi.
      comment: row.comment || row.expense_category_name || row.source_type || "-",
      cash: method === "cash" ? amount : 0,
      card: method === "card" ? amount : 0,
      other: method === "other" ? amount : 0,
    };
  });
};

const sumBy = <T,>(items: T[], getter: (item: T) => number) =>
  items.reduce((total, item) => total + getter(item), 0);

type ReportRow = ReturnType<typeof buildRows>[number];

/** Qator summa kataklari (bo'sh — 0). */
const amountCells = (row: ReportRow, columns: readonly AmountColumn[], indent: string) =>
  columns.map((column) => `<td class="cell num">${row[column] ? fmt(row[column]) : ""}</td>`).join(`\n${indent}`);

const renderDataRows = (rows: ReportRow[], columns: readonly AmountColumn[]) =>
  rows
    .map(
      (row) => `
        <tr>
          <td class="cell center">${row.no}</td>
          <td class="cell">${escapeHtml(row.name)}</td>
          ${amountCells(row, columns, "          ")}
          <td class="cell">${escapeHtml(row.comment)}</td>
        </tr>
      `,
    )
    .join("");

export const exportMainCashboxReport = ({
  rows,
  totalBalance,
  cashBalance,
  cardBalance,
  fromDate,
  toDate,
  labels,
  singleTotal = false,
}: {
  rows: PaymentRow[];
  totalBalance: number;
  cashBalance: number;
  cardBalance: number;
  fromDate?: string;
  toDate?: string;
  labels: MainCashboxReportLabels;
  /**
   * P0 63HO6cBU (ega 2026-11-17): FILIAL kassasi naqd/kartaga bo'linmaydi — menejer hisobotida balans bitta jami
   * (naqd / karta qoldig'i yo'q; sarlavha — chaqiruvchi `labels.mainCashbox` o'rniga filial kassasi nomini beradi).
   * Operatsiyalar jadvalida to'lov turi ustunlari (naqd · karta · boshqa) qoladi — ega qarori Q2: «Usul menejerga ham
   * ko'rinsin». Asosiy kassa (SA/A) hisoboti o'zgarmagan.
   */
  singleTotal?: boolean;
}) => {
  const columns = COLUMNS;
  const columnLabel = (column: AmountColumn) => labels[column];
  // Chap jadval: № · qayerdan · summalar · izoh; o'ng: balans (+ naqd · karta) · jami / izoh · summalar.
  const leftSpan = columns.length + 3;
  const rightSpan = columns.length + 1;
  const subheads = (indent: string) =>
    columns.map((column) => `<td class="cell subhead">${escapeHtml(columnLabel(column))}</td>`).join(`\n${indent}`);
  // Bitta jami — balans bir marta (o'ng blokni to'liq egallaydi; «Balans» va «jami» da bir xil son takrorlanmaydi).
  const balanceHeads = singleTotal
    ? `<td colspan="${rightSpan}" class="cell subhead">${escapeHtml(labels.balance)}</td>`
    : `<td class="cell subhead">${escapeHtml(labels.balance)}</td>
            <td class="cell subhead">${escapeHtml(labels.cash)}</td>
            <td class="cell subhead">${escapeHtml(labels.card)}</td>
            <td class="cell subhead">${escapeHtml(labels.total)}</td>`;
  const balanceValues = singleTotal
    ? `<td colspan="${rightSpan}" class="cell num">${fmt(totalBalance)}</td>`
    : `<td class="cell num">${fmt(totalBalance)}</td>
            <td class="cell num">${fmt(cashBalance)}</td>
            <td class="cell num">${fmt(cardBalance)}</td>
            <td class="cell num">${fmt(totalBalance)}</td>`;
  const summaryCells = (items: ReportRow[]) =>
    `<td class="cell num summary-blue">${fmt(sumBy(items, (row) => row.cash))}</td>
            <td class="cell num summary-purple">${fmt(sumBy(items, (row) => row.card))}</td>
            <td class="cell num">${fmt(sumBy(items, (row) => row.other))}</td>`;
  const incomeRows = buildRows(rows, "income");
  const expenseRows = buildRows(rows, "expense");
  const reportLabel = fromDate && toDate
    ? `${formatDateLabel(fromDate, labels)} - ${formatDateLabel(toDate, labels)}`
    : formatDateLabel(fromDate || toDate || new Date().toISOString(), labels);

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head>
        <meta charset="UTF-8" />
        <meta name="ProgId" content="Excel.Sheet" />
        <meta name="Generator" content="OpenAI Codex" />
        <style>
          body { font-family: Calibri, Arial, sans-serif; }
          table { border-collapse: collapse; }
          .sheet { width: 100%; }
          .title { background: #1e88e5; color: #ffffff; font-size: 18px; font-weight: 700; text-align: center; }
          .section-title { background: #8ee08a; font-weight: 700; text-align: center; }
          .section-danger { background: #ff6f52; color: #ffffff; font-weight: 700; text-align: center; }
          .subhead { background: #f3f7fb; font-weight: 700; text-align: center; }
          .cell { border: 1px solid #222222; padding: 6px 8px; }
          .num { text-align: right; }
          .center { text-align: center; }
          .summary-blue { background: #18b7f6; color: #ffffff; font-weight: 700; }
          .summary-purple { background: #d36cf5; color: #ffffff; font-weight: 700; }
          .summary-green { background: #8ee08a; font-weight: 700; }
          .spacer { border: none; width: 24px; }
        </style>
      </head>
      <body>
        <table class="sheet">
          <tr>
            <td colspan="${leftSpan}" class="cell title">${escapeHtml(reportLabel)}</td>
            <td class="spacer"></td>
            <td colspan="${rightSpan}" class="cell section-title">${escapeHtml(labels.mainCashbox)}</td>
          </tr>
          <tr>
            <td colspan="${leftSpan}" class="cell section-title">${escapeHtml(labels.income)}</td>
            <td class="spacer"></td>
            ${balanceHeads}
          </tr>
          <tr>
            <td class="cell subhead">${escapeHtml(labels.no)}</td>
            <td class="cell subhead">${escapeHtml(labels.fromWhere)}</td>
            ${subheads("            ")}
            <td class="cell subhead">${escapeHtml(labels.comment)}</td>
            <td class="spacer"></td>
            ${balanceValues}
          </tr>
          ${renderDataRows(incomeRows, columns)}
          <tr>
            <td colspan="2" class="cell summary-green">${escapeHtml(labels.summaryIncome)}</td>
            ${summaryCells(incomeRows)}
            <td class="cell"></td>
            <td class="spacer"></td>
            <td colspan="${rightSpan}" class="cell"></td>
          </tr>
          <tr><td colspan="${leftSpan + 1 + rightSpan}" class="spacer"></td></tr>
          <tr>
            <td colspan="${leftSpan}" class="cell section-danger">${escapeHtml(labels.expense)} / ${escapeHtml(labels.expenseSection)}</td>
            <td class="spacer"></td>
            <td colspan="${rightSpan}" class="cell section-danger">${escapeHtml(labels.expenseSection)}</td>
          </tr>
          <tr>
            <td class="cell subhead">${escapeHtml(labels.no)}</td>
            <td class="cell subhead">${escapeHtml(labels.toWhere)}</td>
            ${subheads("            ")}
            <td class="cell subhead">${escapeHtml(labels.comment)}</td>
            <td class="spacer"></td>
            <td class="cell subhead">${escapeHtml(labels.comment)}</td>
            ${subheads("            ")}
          </tr>
          ${expenseRows
            .map(
              (row) => `
                <tr>
                  <td class="cell center">${row.no}</td>
                  <td class="cell">${escapeHtml(row.name)}</td>
                  ${amountCells(row, columns, "                  ")}
                  <td class="cell">${escapeHtml(row.comment)}</td>
                  <td class="spacer"></td>
                  <td class="cell">${escapeHtml(row.comment)}</td>
                  ${amountCells(row, columns, "                  ")}
                </tr>
              `,
            )
            .join("")}
          <tr>
            <td colspan="2" class="cell summary-green">${escapeHtml(labels.summaryExpense)}</td>
            ${summaryCells(expenseRows)}
            <td class="cell"></td>
            <td class="spacer"></td>
            <td class="cell summary-green">${escapeHtml(labels.total)}</td>
            ${summaryCells(expenseRows)}
          </tr>
        </table>
      </body>
    </html>
  `;

  const blob = new Blob([`\ufeff${html}`], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });

  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  const filename = `cashbox-${reportLabel.replaceAll(" ", "_")}.xls`;

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
