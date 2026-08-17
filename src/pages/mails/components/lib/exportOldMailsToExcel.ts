export type OldMailExportRow = {
  id: string;
  region: string;
  courier: string;
  status: string;
  orders: number;
  amount: number;
  createdAt: string;
};

export type OldMailsExportLabels = {
  title: string;
  generatedAt: string;
  no: string;
  mailId: string;
  region: string;
  courier: string;
  status: string;
  orders: string;
  amount: string;
  date: string;
  totalMails: string;
  totalOrders: string;
  totalAmount: string;
  currency: string;
};

const escapeHtml = (value: unknown) => {
  const text = String(value ?? "");
  const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;

  return safeText
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
};

const formatAmount = (value: number) =>
  Number(value || 0).toLocaleString("uz-UZ", { maximumFractionDigits: 0 });

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "-";

  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const buildOldMailsWorkbook = (
  rows: OldMailExportRow[],
  labels: OldMailsExportLabels,
) => {
  const totalOrders = rows.reduce((sum, row) => sum + Number(row.orders || 0), 0);
  const totalAmount = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const generatedAt = formatDate(new Date().toISOString());
  const dataRows = rows.map((row, index) => `
    <tr>
      <td class="cell center">${index + 1}</td>
      <td class="cell">${escapeHtml(row.id)}</td>
      <td class="cell">${escapeHtml(row.region)}</td>
      <td class="cell">${escapeHtml(row.courier || "-")}</td>
      <td class="cell">${escapeHtml(row.status)}</td>
      <td class="cell num">${formatAmount(row.orders)}</td>
      <td class="cell num">${formatAmount(row.amount)} ${escapeHtml(labels.currency)}</td>
      <td class="cell">${escapeHtml(formatDate(row.createdAt))}</td>
    </tr>
  `).join("");

  return `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head>
        <meta charset="UTF-8" />
        <meta name="ProgId" content="Excel.Sheet" />
        <style>
          body { font-family: Calibri, Arial, sans-serif; }
          table { border-collapse: collapse; width: 100%; }
          .title { background: #ff7a00; color: #ffffff; font-size: 18px; font-weight: 700; text-align: center; }
          .subhead { background: #fff1df; color: #4a2a00; font-weight: 700; text-align: center; }
          .summary { background: #f4f6fb; font-weight: 700; }
          .cell { border: 1px solid #b8bdc9; padding: 7px 9px; }
          .center { text-align: center; }
          .num { text-align: right; }
        </style>
      </head>
      <body>
        <table>
          <tr><td colspan="8" class="cell title">${escapeHtml(labels.title)}</td></tr>
          <tr><td colspan="8" class="cell">${escapeHtml(labels.generatedAt)}: ${escapeHtml(generatedAt)}</td></tr>
          <tr>
            <td class="cell subhead">${escapeHtml(labels.no)}</td>
            <td class="cell subhead">${escapeHtml(labels.mailId)}</td>
            <td class="cell subhead">${escapeHtml(labels.region)}</td>
            <td class="cell subhead">${escapeHtml(labels.courier)}</td>
            <td class="cell subhead">${escapeHtml(labels.status)}</td>
            <td class="cell subhead">${escapeHtml(labels.orders)}</td>
            <td class="cell subhead">${escapeHtml(labels.amount)}</td>
            <td class="cell subhead">${escapeHtml(labels.date)}</td>
          </tr>
          ${dataRows}
          <tr>
            <td colspan="4" class="cell summary">${escapeHtml(labels.totalMails)}: ${rows.length}</td>
            <td colspan="2" class="cell summary">${escapeHtml(labels.totalOrders)}: ${formatAmount(totalOrders)}</td>
            <td colspan="2" class="cell summary">${escapeHtml(labels.totalAmount)}: ${formatAmount(totalAmount)} ${escapeHtml(labels.currency)}</td>
          </tr>
        </table>
      </body>
    </html>
  `;
};

export const exportOldMailsToExcel = ({
  rows,
  labels,
}: {
  rows: OldMailExportRow[];
  labels: OldMailsExportLabels;
}) => {
  const blob = new Blob([`\ufeff${buildOldMailsWorkbook(rows, labels)}`], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.href = url;
  link.download = `old-mails-${new Date().toISOString().slice(0, 10)}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
