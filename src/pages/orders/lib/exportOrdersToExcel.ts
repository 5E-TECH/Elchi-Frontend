import type { OrderListItem, OrderStatus } from "../../../entities/order/types/order";

type OrderRecord = OrderListItem & Record<string, any>;

export type OrderExcelLabels = {
  fileName: string;
  headers: string[];
  statuses: Partial<Record<OrderStatus | string, string>>;
};

const COLUMN_WIDTHS = [48, 210, 210, 170, 270, 150, 130, 230, 150, 170];

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatDate = (value?: string | null) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

const getRegionName = (order: OrderRecord) =>
  order.region?.name ??
  order.district?.region?.name ??
  (order.customer as Record<string, any> | undefined)?.region?.name ??
  (order.customer as Record<string, any> | undefined)?.district?.region?.name ??
  "";

const getDistrictName = (order: OrderRecord) =>
  order.district?.name ?? (order.customer as Record<string, any> | undefined)?.district?.name ?? "";

const getProductNames = (order: OrderRecord) => {
  const items = Array.isArray(order.items) ? order.items : [];
  const names = items
    .map((item: Record<string, any>) =>
      item.product?.name ??
      item.product_name ??
      item.name ??
      item.product?.title ??
      "",
    )
    .filter(Boolean);

  if (names.length > 0) {
    return names.join(", ");
  }

  return order.product?.name ?? order.product_name ?? "";
};

const getCourierName = (order: OrderRecord) =>
  order.courier?.name ??
  order.courier?.fullName ??
  order.courier?.full_name ??
  order.courier?.user?.name ??
  order.courier_name ??
  "";

const getStatusLabel = (status: string | null | undefined, labels: OrderExcelLabels) => {
  if (!status) return "";
  return labels.statuses[status] ?? status;
};

const buildRows = (orders: OrderListItem[], labels: OrderExcelLabels) =>
  orders.map((order, index) => {
    const orderRecord = order as OrderRecord;

    return [
      index + 1,
      getRegionName(orderRecord),
      getDistrictName(orderRecord),
      orderRecord.market?.name ?? orderRecord.market_name ?? "",
      getProductNames(orderRecord),
      orderRecord.customer?.phone_number ?? orderRecord.phone_number ?? "",
      orderRecord.total_price ?? 0,
      getCourierName(orderRecord),
      getStatusLabel(orderRecord.status, labels),
      formatDate(orderRecord.createdAt ?? orderRecord.created_at),
    ];
  });

const createExcelHtml = (orders: OrderListItem[], labels: OrderExcelLabels) => {
  const rows = buildRows(orders, labels);

  const colgroup = COLUMN_WIDTHS.map((width) => `<col style="width:${width}px" />`).join("");
  const headerHtml = labels.headers
    .map((header) => `<th>${escapeHtml(header)}</th>`)
    .join("");
  const rowsHtml = rows
    .map((row) => {
      const cells = row
        .map((cell, cellIndex) => {
          const isNumericColumn = cellIndex === 0 || cellIndex === 6;
          const className = isNumericColumn ? "number" : "text";
          return `<td class="${className}">${escapeHtml(cell)}</td>`;
        })
        .join("");

      return `<tr>${cells}</tr>`;
    })
    .join("");

  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>
      table { border-collapse: collapse; font-family: Calibri, Arial, sans-serif; font-size: 12pt; }
      th { background: #ffc000; border: 1px solid #8a8a8a; color: #000; font-weight: 700; padding: 6px 10px; text-align: center; }
      td { border: 1px solid #c9c9c9; color: #000; padding: 4px 10px; vertical-align: middle; }
      td.text { mso-number-format: "\\@"; }
      td.number { mso-number-format: "0"; }
    </style>
  </head>
  <body>
    <table>
      <colgroup>${colgroup}</colgroup>
      <thead><tr>${headerHtml}</tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </body>
</html>`;
};

export const exportOrdersToExcel = (orders: OrderListItem[], labels: OrderExcelLabels) => {
  const html = createExcelHtml(orders, labels);
  const blob = new Blob([html], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const today = new Date().toISOString().slice(0, 10);

  link.href = url;
  link.download = `${labels.fileName}_${today}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
