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
      comment: row.comment || row.source_type || "-",
      cash: method === "cash" ? amount : 0,
      card: method === "card" ? amount : 0,
      other: method === "other" ? amount : 0,
    };
  });
};

const sumBy = <T,>(items: T[], getter: (item: T) => number) =>
  items.reduce((total, item) => total + getter(item), 0);

const renderDataRows = (
  rows: Array<{ no: number; name: string; comment: string; cash: number; card: number; other: number }>,
) =>
  rows
    .map(
      (row) => `
        <tr>
          <td class="cell center">${row.no}</td>
          <td class="cell">${escapeHtml(row.name)}</td>
          <td class="cell num">${row.cash ? fmt(row.cash) : ""}</td>
          <td class="cell num">${row.card ? fmt(row.card) : ""}</td>
          <td class="cell num">${row.other ? fmt(row.other) : ""}</td>
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
}: {
  rows: PaymentRow[];
  totalBalance: number;
  cashBalance: number;
  cardBalance: number;
  fromDate?: string;
  toDate?: string;
  labels: MainCashboxReportLabels;
}) => {
  const incomeRows = buildRows(rows, "income");
  const expenseRows = buildRows(rows, "expense");
  const reportLabel = fromDate && toDate
    ? `${formatDateLabel(fromDate, labels)} - ${formatDateLabel(toDate, labels)}`
    : formatDateLabel(fromDate || toDate || new Date().toISOString(), labels);

  const incomeCash = sumBy(incomeRows, (row) => row.cash);
  const incomeCard = sumBy(incomeRows, (row) => row.card);
  const expenseCash = sumBy(expenseRows, (row) => row.cash);
  const expenseCard = sumBy(expenseRows, (row) => row.card);

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
            <td colspan="6" class="cell title">${escapeHtml(reportLabel)}</td>
            <td class="spacer"></td>
            <td colspan="4" class="cell section-title">${escapeHtml(labels.mainCashbox)}</td>
          </tr>
          <tr>
            <td colspan="6" class="cell section-title">${escapeHtml(labels.income)}</td>
            <td class="spacer"></td>
            <td class="cell subhead">${escapeHtml(labels.balance)}</td>
            <td class="cell subhead">${escapeHtml(labels.cash)}</td>
            <td class="cell subhead">${escapeHtml(labels.card)}</td>
            <td class="cell subhead">${escapeHtml(labels.total)}</td>
          </tr>
          <tr>
            <td class="cell subhead">${escapeHtml(labels.no)}</td>
            <td class="cell subhead">${escapeHtml(labels.fromWhere)}</td>
            <td class="cell subhead">${escapeHtml(labels.cash)}</td>
            <td class="cell subhead">${escapeHtml(labels.card)}</td>
            <td class="cell subhead">${escapeHtml(labels.other)}</td>
            <td class="cell subhead">${escapeHtml(labels.comment)}</td>
            <td class="spacer"></td>
            <td class="cell num">${fmt(totalBalance)}</td>
            <td class="cell num">${fmt(cashBalance)}</td>
            <td class="cell num">${fmt(cardBalance)}</td>
            <td class="cell num">${fmt(totalBalance)}</td>
          </tr>
          ${renderDataRows(incomeRows)}
          <tr>
            <td colspan="2" class="cell summary-green">${escapeHtml(labels.summaryIncome)}</td>
            <td class="cell num summary-blue">${fmt(incomeCash)}</td>
            <td class="cell num summary-purple">${fmt(incomeCard)}</td>
            <td class="cell num">${fmt(sumBy(incomeRows, (row) => row.other))}</td>
            <td class="cell"></td>
            <td class="spacer"></td>
            <td colspan="4" class="cell"></td>
          </tr>
          <tr><td colspan="11" class="spacer"></td></tr>
          <tr>
            <td colspan="6" class="cell section-danger">${escapeHtml(labels.expense)} / ${escapeHtml(labels.expenseSection)}</td>
            <td class="spacer"></td>
            <td colspan="4" class="cell section-danger">${escapeHtml(labels.expenseSection)}</td>
          </tr>
          <tr>
            <td class="cell subhead">${escapeHtml(labels.no)}</td>
            <td class="cell subhead">${escapeHtml(labels.toWhere)}</td>
            <td class="cell subhead">${escapeHtml(labels.cash)}</td>
            <td class="cell subhead">${escapeHtml(labels.card)}</td>
            <td class="cell subhead">${escapeHtml(labels.other)}</td>
            <td class="cell subhead">${escapeHtml(labels.comment)}</td>
            <td class="spacer"></td>
            <td class="cell subhead">${escapeHtml(labels.comment)}</td>
            <td class="cell subhead">${escapeHtml(labels.cash)}</td>
            <td class="cell subhead">${escapeHtml(labels.card)}</td>
            <td class="cell subhead">${escapeHtml(labels.other)}</td>
          </tr>
          ${expenseRows
            .map(
              (row) => `
                <tr>
                  <td class="cell center">${row.no}</td>
                  <td class="cell">${escapeHtml(row.name)}</td>
                  <td class="cell num">${row.cash ? fmt(row.cash) : ""}</td>
                  <td class="cell num">${row.card ? fmt(row.card) : ""}</td>
                  <td class="cell num">${row.other ? fmt(row.other) : ""}</td>
                  <td class="cell">${escapeHtml(row.comment)}</td>
                  <td class="spacer"></td>
                  <td class="cell">${escapeHtml(row.comment)}</td>
                  <td class="cell num">${row.cash ? fmt(row.cash) : ""}</td>
                  <td class="cell num">${row.card ? fmt(row.card) : ""}</td>
                  <td class="cell num">${row.other ? fmt(row.other) : ""}</td>
                </tr>
              `,
            )
            .join("")}
          <tr>
            <td colspan="2" class="cell summary-green">${escapeHtml(labels.summaryExpense)}</td>
            <td class="cell num summary-blue">${fmt(expenseCash)}</td>
            <td class="cell num summary-purple">${fmt(expenseCard)}</td>
            <td class="cell num">${fmt(sumBy(expenseRows, (row) => row.other))}</td>
            <td class="cell"></td>
            <td class="spacer"></td>
            <td class="cell summary-green">${escapeHtml(labels.total)}</td>
            <td class="cell num summary-blue">${fmt(expenseCash)}</td>
            <td class="cell num summary-purple">${fmt(expenseCard)}</td>
            <td class="cell num">${fmt(sumBy(expenseRows, (row) => row.other))}</td>
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
