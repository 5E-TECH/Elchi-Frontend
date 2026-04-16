import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import type { ApiOrder } from "../OrderCard";
import pdfLogoUrl from "../../../../shared/assets/pdflogo.svg";
import pdfLogoFallbackUrl from "../../../../shared/assets/logoo.png";

type LabelOrder = ApiOrder & {
  market?: {
    name?: string | null;
    phone_number?: string | null;
  } | null;
  operator?: string | null;
  logist?: {
    name?: string | null;
    phone_number?: string | null;
  } | null;
  courier?: {
    name?: string | null;
    phone_number?: string | null;
  } | null;
  landmark?: string | null;
};

const MM = 2.83465;
const PAGE_W = 100 * MM;
const PAGE_H = 60 * MM;
const M = 2 * MM;
const FULL_W = PAGE_W - 2 * M;
const FULL_H = PAGE_H - 2 * M;
const LEFT_W = 24 * MM;
const RIGHT_X = M + LEFT_W;
const RIGHT_W = FULL_W - LEFT_W;
const LABEL_COL = 14 * MM;
const PAD = 3;

const TOP_SECTION_H = 34 * MM;
const BOTTOM_Y = M + TOP_SECTION_H;
const BOTTOM_SECTION_H = FULL_H - TOP_SECTION_H;

const zoneARows = [
  { label: "F.I.O:", key: "fullName" as const, h: 16 },
  { label: "Telefon:", key: "phone" as const, h: 26 },
  { label: "Manzil:", key: "address" as const, h: 26 },
  { label: "Jami:", key: "total" as const, h: 15 },
  { label: "Jo'natuvchi:", key: "sender" as const, h: 13 },
];

const BOTTOM_ROW_H = BOTTOM_SECTION_H / 4;
const MAHSULOT_H = BOTTOM_ROW_H;
const MOLJAL_H = BOTTOM_ROW_H;
const IZOH_H = BOTTOM_ROW_H;
const LOGIST_H = BOTTOM_ROW_H;

const zoneBRows = [
  { label: "Mahsulot:", key: "product" as const, h: MAHSULOT_H },
  { label: "Mo'ljal:", key: "landmark" as const, h: MOLJAL_H },
  { label: "Izoh:", key: "comment" as const, h: IZOH_H },
  { label: "Logist:", key: "logist" as const, h: LOGIST_H },
];

const safe = (value?: string | null, fallback = "-") =>
  typeof value === "string" && value.trim() ? value.trim() : fallback;

const formatPhoneNumber = (value?: string | null) => {
  const raw = safe(value, "");
  const digits = raw.replace(/\D/g, "");

  if (digits.length === 12 && digits.startsWith("998")) {
    const country = digits.slice(0, 3);
    const area = digits.slice(3, 5);
    const first = digits.slice(5, 8);
    const second = digits.slice(8, 10);
    const third = digits.slice(10, 12);
    return `+${country} (${area}) ${first}-${second}-${third}`;
  }

  if (digits.length === 9) {
    const area = digits.slice(0, 2);
    const first = digits.slice(2, 5);
    const second = digits.slice(5, 7);
    const third = digits.slice(7, 9);
    return `+998 (${area}) ${first}-${second}-${third}`;
  }

  return raw || "-";
};

const formatMoney = (value?: number | null) =>
  new Intl.NumberFormat("uz-UZ").format(Number(value ?? 0));

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const joinParts = (...parts: Array<string | null | undefined>) =>
  parts.map((part) => safe(part, "")).filter(Boolean).join(" ");

const getAddress = (order: LabelOrder) => {
  const region = order.customer?.region?.name ?? order.region?.name ?? "";
  const district = order.customer?.district?.name ?? order.district?.name ?? "";
  const address = safe(order.address, "");
  return [joinParts(region, district), address].filter(Boolean).join(", ") || "-";
};

const getProducts = (order: LabelOrder) =>
  order.items.length
    ? order.items
        .map((item) => `${safe(item.product?.name, "Mahsulot")} x${item.quantity}`)
        .join(", ")
    : "-";

const getDeliveryLabel = (order: LabelOrder) =>
  order.where_deliver === "center" ? "MARKAZGA" : "UYGA";

const getSender = (order: LabelOrder) => {
  const marketName = safe(order.market?.name, "");
  const operator = safe(order.operator, "");
  return [marketName, operator].filter(Boolean).join(" | ") || safe(order.customer?.phone_number);
};

const getLogist = (order: LabelOrder) => {
  const name =
    safe(order.logist?.name, "") ||
    safe(order.courier?.name, "");
  const phone =
    safe(order.logist?.phone_number, "") ||
    safe(order.courier?.phone_number, "");

  if (!name && !phone) return "-";
  return [name, phone].filter(Boolean).join(" | ");
};

const ellipsize = (pdf: jsPDF, text: string, maxWidth: number) => {
  if (pdf.getTextWidth(text) <= maxWidth) return text;

  let result = text.trim();
  while (result.length > 1 && pdf.getTextWidth(`${result}...`) > maxWidth) {
    result = result.slice(0, -1).trimEnd();
  }

  return `${result}...`;
};

const fitFontSize = (
  pdf: jsPDF,
  text: string,
  maxWidth: number,
  preferred: number,
  min = preferred - 1.5,
) => {
  let size = preferred;
  while (size > min) {
    pdf.setFontSize(size);
    if (pdf.getTextWidth(text) <= maxWidth) break;
    size -= 0.2;
  }
  return size;
};

const drawCellText = (
  pdf: jsPDF,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  fontSize: number,
  options?: {
    align?: "left" | "center";
    maxLines?: number;
    bold?: boolean;
    ellipsis?: boolean;
    valign?: "middle" | "top";
    topPadding?: number;
  },
) => {
  const {
    align = "left",
    maxLines = 1,
    bold = false,
    ellipsis = false,
    valign = "middle",
    topPadding = 0,
  } = options ?? {};

  pdf.setFont("helvetica", bold ? "bold" : "normal");
  pdf.setFontSize(fontSize);

  let lines = pdf.splitTextToSize(text, w) as string[];
  lines = lines.slice(0, maxLines);

  if (ellipsis && lines.length > 0) {
    lines[lines.length - 1] = ellipsize(pdf, lines[lines.length - 1], w);
  }

  const lineHeight = fontSize * 1.12;
  const blockHeight = Math.max(fontSize, lines.length * lineHeight);
  const startY =
    valign === "top"
      ? y + topPadding + fontSize * 0.92
      : y + (h - blockHeight) / 2 + fontSize * 0.82;

  lines.forEach((line, index) => {
    pdf.text(line, align === "center" ? x + w / 2 : x, startY + index * lineHeight, { align });
  });
};

const drawLogoBlock = (pdf: jsPDF, logoUrl: string, qrUrl: string, order: LabelOrder) => {
  const panelX = M;
  const panelY = M;
  const panelW = LEFT_W;
  const topInset = 0.2;
  const logoY = panelY + topInset;
  const iconSize = 6.8 * MM;
  const gap = 1.3;
  const brandText = "ELCHI";
  const subText = "POCHTA";

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  const textW = pdf.getTextWidth(brandText);
  const groupW = iconSize + gap + textW;
  const iconX = panelX + (panelW - groupW) / 2;
  const textX = iconX + iconSize + gap;
  const brandY = logoY + iconSize / 2;
  const subY = brandY + 4.5;

  if (logoUrl) {
    pdf.addImage(logoUrl, "PNG", iconX, logoY, iconSize, iconSize, "", "MEDIUM");
    pdf.text(brandText, textX, brandY);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(4.7);
    pdf.text(subText, textX, subY);
  } else {
    pdf.text(brandText, panelX + panelW / 2, logoY + iconSize - 4, { align: "center" });
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(4.7);
    pdf.text(subText, panelX + panelW / 2, logoY + iconSize + 0.8, { align: "center" });
  }

  const qrGap = 1.5;
  const qrSize = 19.8 * MM;
  const qrX = panelX + (panelW - qrSize) / 2;
  const qrY = logoY + iconSize + qrGap;
  pdf.addImage(qrUrl, "PNG", qrX, qrY, qrSize, qrSize, "", "FAST");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9.1);
  const dateY = qrY + qrSize + 12.8;
  pdf.text(formatDate(order.createdAt), panelX + panelW / 2, dateY, {
    align: "center",
  });
};

const drawTopSection = (pdf: jsPDF, order: LabelOrder) => {
  const values = {
    fullName: safe(order.customer?.name),
    phone: formatPhoneNumber(order.customer?.phone_number),
    address: getAddress(order),
    total: `${formatMoney(order.total_price)} so'm`,
    sender: getSender(order),
  };

  pdf.setDrawColor(20, 20, 20);
  pdf.setLineWidth(0.6);
  pdf.line(RIGHT_X, M, RIGHT_X, M + TOP_SECTION_H);
  pdf.line(RIGHT_X + LABEL_COL, M, RIGHT_X + LABEL_COL, M + TOP_SECTION_H);

  let currentY = M;
  zoneARows.forEach((row, index) => {
    const rowHeight = row.h;
    const rowBottom = currentY + rowHeight;
    const isLast = index === zoneARows.length - 1;

    if (!isLast) {
      pdf.setLineWidth(0.35);
      pdf.line(RIGHT_X, rowBottom, M + FULL_W, rowBottom);
    }

    const labelFontSize = 6;
    const labelX = row.key === "sender" ? RIGHT_X + 2.1 : RIGHT_X + PAD;
    const labelW = row.key === "sender" ? LABEL_COL - 4.2 : LABEL_COL - PAD * 2;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(labelFontSize);
    drawCellText(pdf, row.label, labelX, currentY, labelW, rowHeight, labelFontSize, {
      bold: true,
      maxLines: 1,
      valign: "top",
      topPadding: 2.4,
    });

    const valueX = RIGHT_X + LABEL_COL + PAD;
    const valueW = RIGHT_W - LABEL_COL - PAD * 2;

    if (row.key === "total") {
      const totalText = `${values.total} | ${getDeliveryLabel(order)}`;
      const amountSize = fitFontSize(pdf, totalText, valueW, 8.2, 7.8);
      drawCellText(pdf, totalText, valueX, currentY, valueW, rowHeight, amountSize, {
        bold: true,
        maxLines: 1,
        valign: "top",
        topPadding: 2.2,
      });
    } else if (row.key === "sender") {
      const senderText = values.sender;
      drawCellText(pdf, senderText, valueX, currentY, valueW, rowHeight, 7.2, {
        bold: true,
        maxLines: 1,
        ellipsis: true,
        valign: "top",
        topPadding: 2.2,
      });
    } else if (row.key === "address") {
      const addressSize = fitFontSize(pdf, values.address, valueW, 8.2, 7.8);
      drawCellText(pdf, values.address, valueX, currentY, valueW, rowHeight, addressSize, {
        maxLines: 2,
        ellipsis: true,
        bold: true,
        valign: "top",
        topPadding: 2.2,
      });
    } else if (row.key === "phone") {
      const phoneSize = fitFontSize(pdf, values.phone, valueW, 8.2, 7.8);
      drawCellText(pdf, values.phone, valueX, currentY, valueW, rowHeight, phoneSize, {
        bold: true,
        maxLines: 1,
        ellipsis: true,
        valign: "top",
        topPadding: 2.2,
      });
    } else {
      const nameSize = fitFontSize(pdf, values.fullName, valueW, 8.2, 7.8);
      drawCellText(pdf, values.fullName, valueX, currentY, valueW, rowHeight, nameSize, {
        bold: true,
        maxLines: 1,
        ellipsis: true,
        valign: "top",
        topPadding: 2.2,
      });
    }

    currentY = rowBottom;
  });
};

const drawBottomSection = (pdf: jsPDF, order: LabelOrder) => {
  const values = {
    product: getProducts(order),
    landmark: safe(order.landmark),
    comment: safe(order.comment),
    logist: getLogist(order),
  };

  pdf.setLineWidth(0.6);
  pdf.line(M + LABEL_COL, BOTTOM_Y, M + LABEL_COL, M + FULL_H);

  let currentY = BOTTOM_Y;

  zoneBRows.forEach((row, index) => {
    const rowBottom = currentY + row.h;
    const isLast = index === zoneBRows.length - 1;

    if (!isLast) {
      pdf.setLineWidth(0.35);
      pdf.line(M, rowBottom, M + FULL_W, rowBottom);
    }

    drawCellText(pdf, row.label, M + PAD, currentY, LABEL_COL - PAD * 2, row.h, 6, {
      bold: true,
      maxLines: 1,
      valign: "top",
      topPadding: 2.2,
    });

    const valueX = M + LABEL_COL + PAD;
    const valueW = FULL_W - LABEL_COL - PAD * 2;

    drawCellText(pdf, values[row.key], valueX, currentY, valueW, row.h, 7.2, {
      maxLines: row.key === "product" ? 2 : 1,
      ellipsis: true,
      bold: true,
      valign: "top",
      topPadding: 2.2,
    });

    currentY = rowBottom;
  });
};

const drawPage = (pdf: jsPDF, order: LabelOrder, logoUrl: string, qrUrl: string) => {
  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, 0, PAGE_W, PAGE_H, "F");

  pdf.setDrawColor(20, 20, 20);
  pdf.setLineWidth(0.7);
  pdf.rect(M, M, FULL_W, FULL_H);
  pdf.line(M, BOTTOM_Y, M + FULL_W, BOTTOM_Y);

  drawLogoBlock(pdf, logoUrl, qrUrl, order);
  drawTopSection(pdf, order);
  drawBottomSection(pdf, order);
};

const generateQr = (text: string): Promise<string> =>
  QRCode.toDataURL(text, {
    width: 180,
    margin: 0,
    color: { dark: "#000000", light: "#ffffff" },
    errorCorrectionLevel: "M",
  });

const loadImage = (src: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");

      if (!context) {
        reject(new Error("No canvas context"));
        return;
      }

      context.drawImage(image, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = reject;
    image.src = src;
  });

export const openOrdersLabelPdf = async (orders: ApiOrder[]): Promise<void> => {
  if (!orders.length) return;

  const [logoUrl, ...qrUrls] = await Promise.all([
    loadImage(pdfLogoUrl).catch(() => loadImage(pdfLogoFallbackUrl)).catch(() => ""),
    ...orders.map((order) =>
      generateQr(`${window.location.origin}/new-orders/orders/${order.id}`),
    ),
  ]);

  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: [PAGE_H, PAGE_W],
    compress: true,
  });

  orders.forEach((rawOrder, index) => {
    if (index > 0) {
      pdf.addPage([PAGE_H, PAGE_W], "landscape");
    }

    drawPage(pdf, rawOrder as LabelOrder, logoUrl, qrUrls[index]);
  });

  const blob = pdf.output("blob");
  const url = URL.createObjectURL(blob);
  const openedWindow = window.open(url, "_blank", "noopener,noreferrer");

  if (!openedWindow) {
    pdf.save(`elchi-orders-${Date.now()}.pdf`);
  }

  window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
};
