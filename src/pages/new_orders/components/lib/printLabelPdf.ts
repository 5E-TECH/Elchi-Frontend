import { jsPDF } from "jspdf";
import type { ApiOrder } from "../OrderCard";

const PAGE_WIDTH = 100;
const PAGE_HEIGHT = 60;

const mm = (value: number) => value;

const safeText = (value: string | null | undefined, fallback = "-") => {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || fallback;
};

const formatMoney = (value: number | null | undefined) =>
  new Intl.NumberFormat("uz-UZ").format(Number(value ?? 0));

const formatDate = (value: string | null | undefined) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("uz-UZ");
};

const clampText = (value: string, maxLength: number) => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
};

const getCustomerAddress = (order: ApiOrder) => {
  const region = order.customer?.region?.name ?? order.region?.name ?? "";
  const district = order.customer?.district?.name ?? order.district?.name ?? "";
  const address = safeText(order.address, "");
  const location = [region, district].filter(Boolean).join(" ");
  return [location, address].filter(Boolean).join(", ") || "-";
};

const getProductText = (order: ApiOrder) => {
  if (!order.items.length) return "-";

  return order.items
    .map((item) => `${safeText(item.product?.name, "Mahsulot")} x${item.quantity}`)
    .join(", ");
};

const drawWrappedText = (
  pdf: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 2,
) => {
  const lines = pdf.splitTextToSize(text, maxWidth) as string[];
  lines.slice(0, maxLines).forEach((line, index) => {
    const printableLine =
      index === maxLines - 1 && lines.length > maxLines ? clampText(line, Math.max(8, line.length - 3)) : line;

    pdf.text(printableLine, x, y + index * lineHeight);
  });
};

const drawLabelPage = (pdf: jsPDF, order: ApiOrder) => {
  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, "F");

  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.25);
  pdf.rect(mm(2), mm(2), mm(96), mm(56));

  pdf.line(mm(22), mm(2), mm(22), mm(36));
  pdf.line(mm(2), mm(36), mm(98), mm(36));

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text("ELCHI POCHTA", mm(3), mm(6));

  pdf.setFontSize(12);
  pdf.text("#", mm(6), mm(17));
  pdf.rect(mm(4), mm(8), mm(14), mm(20));

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  pdf.text(formatDate(order.createdAt), mm(4), mm(32));

  pdf.setFontSize(5.5);
  pdf.text(`ID: ${order.id}`, mm(4), mm(35));

  const infoLeft = 22;
  const infoWidth = 76;
  const labelWidth = 16;
  const valueX = infoLeft + labelWidth + 1.5;
  const rows = [
    { label: "F.I.O:", value: safeText(order.customer?.name) },
    { label: "Telefon:", value: safeText(order.customer?.phone_number) },
    { label: "Manzil:", value: getCustomerAddress(order) },
    { label: "Jami:", value: `${formatMoney(order.total_price)} so'm` },
    { label: "To'lov:", value: order.paid_amount > 0 ? `${formatMoney(order.paid_amount)} so'm` : "Naqd emas" },
  ];

  let rowTop = 2;
  rows.forEach((row, index) => {
    const height = index === 2 ? 12 : 7;
    pdf.rect(mm(infoLeft), mm(rowTop), mm(infoWidth), mm(height));
    pdf.line(mm(infoLeft + labelWidth), mm(rowTop), mm(infoLeft + labelWidth), mm(rowTop + height));

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6.5);
    pdf.text(row.label, mm(infoLeft + 1.5), mm(rowTop + 4.5));

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(index === 3 ? 8.5 : 7.5);
    if (index === 2) {
      drawWrappedText(pdf, row.value, mm(valueX), mm(rowTop + 4.5), mm(infoWidth - labelWidth - 3), 3.6, 3);
    } else {
      drawWrappedText(pdf, row.value, mm(valueX), mm(rowTop + 4.5), mm(infoWidth - labelWidth - 3), 3.4, 2);
    }

    rowTop += height;
  });

  const bottomRows = [
    { label: "Mahsulot:", value: getProductText(order), height: 7 },
    { label: "Mo'ljal:", value: "-", height: 6 },
    { label: "Izoh:", value: safeText(order.comment), height: 6 },
    { label: "Logist:", value: "-", height: 5 },
  ];

  let currentTop = 36;
  bottomRows.forEach((row, index) => {
    pdf.rect(mm(2), mm(currentTop), mm(96), mm(row.height));
    pdf.line(mm(16), mm(currentTop), mm(16), mm(currentTop + row.height));

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6);
    pdf.text(row.label, mm(3), mm(currentTop + 4));

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.5);
    drawWrappedText(
      pdf,
      row.value,
      mm(17.5),
      mm(currentTop + 4),
      mm(78),
      3,
      index === 0 ? 2 : 1,
    );

    currentTop += row.height;
  });
};

export const openOrdersLabelPdf = (orders: ApiOrder[]) => {
  if (!orders.length) return;

  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: [PAGE_HEIGHT, PAGE_WIDTH],
    compress: true,
  });

  orders.forEach((order, index) => {
    if (index > 0) {
      pdf.addPage([PAGE_HEIGHT, PAGE_WIDTH], "landscape");
    }

    drawLabelPage(pdf, order);
  });

  const blob = pdf.output("blob");
  const blobUrl = URL.createObjectURL(blob);
  const opened = window.open(blobUrl, "_blank", "noopener,noreferrer");

  if (!opened) {
    pdf.save(`orders-100x60-${Date.now()}.pdf`);
  }

  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
};
