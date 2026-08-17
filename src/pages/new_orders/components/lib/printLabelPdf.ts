import { jsPDF } from "jspdf";
import type { ApiOrder } from "../OrderCard";
import pdfLogoUrl from "../../../../shared/assets/pdflogo.svg";
import pdfLogoFallbackUrl from "../../../../shared/assets/logoo.png";
import i18n from "../../../../i18n";

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
  { labelKey: "labelFullName", key: "fullName" as const, h: 16 },
  { labelKey: "labelPhone", key: "phone" as const, h: 26 },
  { labelKey: "labelAddress", key: "address" as const, h: 26 },
  { labelKey: "labelTotal", key: "total" as const, h: 15 },
  { labelKey: "labelSender", key: "sender" as const, h: 13 },
];

const BOTTOM_ROW_H = BOTTOM_SECTION_H / 4;
const MAHSULOT_H = BOTTOM_ROW_H;
const MOLJAL_H = BOTTOM_ROW_H;
const IZOH_H = BOTTOM_ROW_H;
const LOGIST_H = BOTTOM_ROW_H;

const zoneBRows = [
  { labelKey: "labelProduct", key: "product" as const, h: MAHSULOT_H },
  { labelKey: "labelLandmark", key: "landmark" as const, h: MOLJAL_H },
  { labelKey: "labelComment", key: "comment" as const, h: IZOH_H },
  { labelKey: "labelLogist", key: "logist" as const, h: LOGIST_H },
];

const tLabel = (key: string) => i18n.t(`newOrders:${key}`);

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
  return joinParts(region, district) || "-";
};

const getLandmark = (order: LabelOrder) => {
  const landmark = safe(order.landmark, "");
  const address = safe(order.address, "");
  return landmark || address || "-";
};

const getProducts = (order: LabelOrder) =>
  order.items.length
    ? order.items
      .map((item) => `${safe(item.product?.name, tLabel("productFallback"))} x${item.quantity}`)
      .join(", ")
    : "-";

const getDeliveryLabel = (order: LabelOrder) =>
  order.where_deliver === "center" ? tLabel("deliveryCenterUpper") : tLabel("deliveryHomeUpper");

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
  // Binary search — O(log n) vs O(n) linear loop
  let lo = min;
  let hi = preferred;
  let best = min;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    pdf.setFontSize(mid);
    if (pdf.getTextWidth(text) <= maxWidth) {
      best = mid;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  pdf.setFontSize(best);
  return best;
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
  pdf.setCharSpace(0.24);
  pdf.setFontSize(11.4);
  const dateY = qrY + qrSize + 12.8;
  pdf.text(formatDate(order.createdAt), panelX + panelW / 2, dateY, {
    align: "center",
  });
  pdf.setCharSpace(0);
};

const drawTopSection = (pdf: jsPDF, order: LabelOrder) => {
  const values = {
    fullName: safe(order.customer?.name),
    phone: formatPhoneNumber(order.customer?.phone_number),
    address: getAddress(order),
    total: `${formatMoney(order.total_price)} ${i18n.t("orders:currency")}`,
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
      pdf.setLineWidth(0.45);
      pdf.line(RIGHT_X, rowBottom, M + FULL_W, rowBottom);
    }

    const labelFontSize = 6.8;
    const labelX = row.key === "sender" ? RIGHT_X + 2.1 : RIGHT_X + PAD;
    const labelW = row.key === "sender" ? LABEL_COL - 4.2 : LABEL_COL - PAD * 2;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(labelFontSize);
    drawCellText(pdf, tLabel(row.labelKey), labelX, currentY, labelW, rowHeight, labelFontSize, {
      bold: true,
      maxLines: 1,
      valign: "top",
      topPadding: 2.4,
    });

    const valueX = RIGHT_X + LABEL_COL + PAD;
    const valueW = RIGHT_W - LABEL_COL - PAD * 2;

    if (row.key === "total") {
      const totalText = `${values.total} | ${getDeliveryLabel(order)}`;
      const amountSize = fitFontSize(pdf, totalText, valueW, 9.9, 9.1);
      drawCellText(pdf, totalText, valueX, currentY, valueW, rowHeight, amountSize, {
        bold: true,
        maxLines: 1,
        valign: "top",
        topPadding: 2.2,
      });
    } else if (row.key === "sender") {
      const senderText = values.sender;
      drawCellText(pdf, senderText, valueX, currentY, valueW, rowHeight, 8.9, {
        bold: true,
        maxLines: 1,
        ellipsis: true,
        valign: "top",
        topPadding: 2.2,
      });
    } else if (row.key === "address") {
      const addressSize = fitFontSize(pdf, values.address, valueW, 9.8, 9);
      drawCellText(pdf, values.address, valueX, currentY, valueW, rowHeight, addressSize, {
        maxLines: 2,
        ellipsis: true,
        bold: true,
        valign: "top",
        topPadding: 2.2,
      });
    } else if (row.key === "phone") {
      const phoneSize = fitFontSize(pdf, values.phone, valueW, 9.8, 9.1);
      drawCellText(pdf, values.phone, valueX, currentY, valueW, rowHeight, phoneSize, {
        bold: true,
        maxLines: 1,
        ellipsis: true,
        valign: "top",
        topPadding: 2.2,
      });
    } else {
      const nameSize = fitFontSize(pdf, values.fullName, valueW, 9.8, 9.1);
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
    landmark: getLandmark(order),
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
      pdf.setLineWidth(0.45);
      pdf.line(M, rowBottom, M + FULL_W, rowBottom);
    }

    drawCellText(pdf, tLabel(row.labelKey), M + PAD, currentY, LABEL_COL - PAD * 2, row.h, 6.8, {
      bold: true,
      maxLines: 1,
      valign: "top",
      topPadding: 2.2,
    });

    const valueX = M + LABEL_COL + PAD;
    const valueW = FULL_W - LABEL_COL - PAD * 2;

    drawCellText(pdf, values[row.key], valueX, currentY, valueW, row.h, 8.8, {
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
  pdf.setLineDashPattern([], 0);
  pdf.setLineWidth(0.7);
  pdf.rect(M, M, FULL_W, FULL_H);
  pdf.line(M, BOTTOM_Y, M + FULL_W, BOTTOM_Y);

  drawLogoBlock(pdf, logoUrl, qrUrl, order);
  drawTopSection(pdf, order);
  drawBottomSection(pdf, order);
};

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
      const dataUrl = canvas.toDataURL("image/png");
      // Canvas'ni bo'shatish — GC tezroq ishlaydi
      canvas.width = 0;
      canvas.height = 0;
      resolve(dataUrl);
    };
    image.onerror = (ev) => reject(new Error(`Image load failed: ${src}`, { cause: ev }));
    image.src = src;
  });

const generateQr = async (text: string): Promise<string> => {
  // 150x150 — print uchun yetarli, kamroq bandwidth
  const qrSource = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&margin=2&data=${encodeURIComponent(text)}&ecc=M`;
  return loadImage(qrSource);
};

const toAbsoluteAssetUrl = (src: string) => new URL(src, window.location.origin).toString();

const getQrPayload = (order: ApiOrder | LabelOrder) => {
  const qrId = (order as { qr_code_token?: string | null }).qr_code_token?.trim() || order.id;
  return String(qrId);
};

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const openBrowserLabelPrintWindow = (orders: LabelOrder[]) => {
  const logoSrc = toAbsoluteAssetUrl(pdfLogoUrl);
  const logoFallbackSrc = toAbsoluteAssetUrl(pdfLogoFallbackUrl);

  const sheets = orders
    .map((order) => {
      const fullName = escapeHtml(safe(order.customer?.name));
      const phone = escapeHtml(formatPhoneNumber(order.customer?.phone_number));
      const address = escapeHtml(getAddress(order));
      const total = escapeHtml(`${formatMoney(order.total_price)} ${i18n.t("orders:currency")} | ${getDeliveryLabel(order)}`);
      const sender = escapeHtml(getSender(order));
      const product = escapeHtml(getProducts(order));
      const landmark = escapeHtml(getLandmark(order));
      const comment = escapeHtml(safe(order.comment));
      const logist = escapeHtml(getLogist(order));
      const date = escapeHtml(formatDate(order.createdAt));
      const qrText = encodeURIComponent(getQrPayload(order));
      const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=0&data=${qrText}`;

      return `
        <section class="sheet">
          <div class="label">
            <div class="left">
              <div class="brand">
                <img class="brand-icon" src="${logoSrc}" alt="Elchi" onerror="this.onerror=null;this.src='${logoFallbackSrc}'" />
                <div class="brand-text">
                  <div class="brand-name">ELCHI</div>
                  <div class="brand-sub">POCHTA</div>
                </div>
              </div>
              <img class="qr" src="${qrSrc}" alt="QR" />
              <div class="date">${date}</div>
            </div>

            <div class="right">
              <table class="top-table">
                <tr><td class="k">${escapeHtml(tLabel("labelFullName"))}</td><td class="v">${fullName}</td></tr>
                <tr><td class="k">${escapeHtml(tLabel("labelPhone"))}</td><td class="v">${phone}</td></tr>
                <tr><td class="k">${escapeHtml(tLabel("labelAddress"))}</td><td class="v">${address}</td></tr>
                <tr><td class="k">${escapeHtml(tLabel("labelTotal"))}</td><td class="v">${total}</td></tr>
                <tr><td class="k">${escapeHtml(tLabel("labelSender"))}</td><td class="v">${sender}</td></tr>
              </table>
            </div>
          </div>

          <table class="bottom-table">
            <tr><td class="k">${escapeHtml(tLabel("labelProduct"))}</td><td class="v">${product}</td></tr>
            <tr><td class="k">${escapeHtml(tLabel("labelLandmark"))}</td><td class="v">${landmark}</td></tr>
            <tr><td class="k">${escapeHtml(tLabel("labelComment"))}</td><td class="v">${comment}</td></tr>
            <tr><td class="k">${escapeHtml(tLabel("labelLogist"))}</td><td class="v">${logist}</td></tr>
          </table>
        </section>
      `;
    })
    .join("");

  const html = `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Elchi Label Print</title>
      <style>
        @page { size: 100mm 60mm; margin: 0; }
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background: #fff; font-family: Arial, sans-serif; }
        body { color: #000; }
        #printBtn {
          position: fixed;
          top: 8px;
          right: 8px;
          z-index: 9999;
          padding: 8px 10px;
          border-radius: 10px;
          border: 1px solid rgba(0,0,0,.15);
          background: #111827;
          color: #fff;
          font-weight: 700;
          font-size: 12px;
          cursor: pointer;
        }
        .sheet {
          width: 100mm;
          height: 60mm;
          padding: 2mm;
          page-break-after: always;
        }
        .label {
          width: 100%;
          height: 34mm;
          display: grid;
          grid-template-columns: 24mm 1fr;
          border: 0.22mm solid #111;
          border-bottom: none;
        }
        .left {
          border-right: 0.22mm solid #111;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0.6mm 1mm 0.8mm;
        }
        .brand {
          width: 100%;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          gap: 1.2mm;
          margin-bottom: 1.2mm;
        }
        .brand-icon {
          width: 7mm;
          height: 7mm;
          object-fit: contain;
        }
        .brand-name {
          font-size: 8pt;
          font-weight: 800;
          letter-spacing: .18pt;
          line-height: 1;
        }
        .brand-sub {
          font-size: 4.7pt;
          font-weight: 800;
          line-height: 1.05;
        }
        .qr {
          width: 19.8mm;
          height: 19.8mm;
          display: block;
          image-rendering: pixelated;
        }
        .date {
          margin-top: 2.2mm;
          font-size: 11.2pt;
          font-weight: 800;
          letter-spacing: .24pt;
          line-height: 1;
        }
        .right { min-width: 0; }
        table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        .top-table { height: 100%; }
        .top-table td,
        .bottom-table td {
          border-bottom: 0.16mm solid #111;
          vertical-align: top;
          padding: 0.85mm 1.1mm;
          color: #000;
        }
        .top-table tr:last-child td,
        .bottom-table tr:last-child td {
          border-bottom: none;
        }
        .top-table .k,
        .bottom-table .k {
          width: 14mm;
          font-size: 6.8pt;
          font-weight: 800;
          border-right: 0.16mm solid #111;
          white-space: nowrap;
        }
        .top-table .v {
          font-size: 9.3pt;
          font-weight: 900;
          line-height: 1.14;
          word-break: break-word;
        }
        .bottom-table {
          width: 100%;
          height: 22mm;
          border: 0.22mm solid #111;
        }
        .bottom-table .v {
          font-size: 8.5pt;
          font-weight: 900;
          line-height: 1.14;
          word-break: break-word;
        }
        @media print {
          #printBtn { display: none; }
          html, body { width: 100mm; height: 60mm; overflow: hidden; }
        }
      </style>
    </head>
    <body>
      <button id="printBtn" type="button">${escapeHtml(tLabel("printButton"))}</button>
      ${sheets}
      <script>
        const triggerPrint = () => {
          try { window.focus(); } catch {}
          try { window.print(); } catch {}
        };
        window.addEventListener('load', () => setTimeout(triggerPrint, 250));
        document.getElementById('printBtn')?.addEventListener('click', triggerPrint);
        window.onafterprint = () => window.close();
      </script>
    </body>
  </html>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const blobUrl = URL.createObjectURL(blob);
  const printWindow = window.open(blobUrl, "_blank", "noopener,noreferrer,width=960,height=720");

  if (!printWindow) {
    URL.revokeObjectURL(blobUrl);
    return;
  }

  // Oyna yopilgandan keyin yoki 2 daqiqa o'tgach blobUrl'ni tozalash
  globalThis.setTimeout(() => URL.revokeObjectURL(blobUrl), 120_000);
};

export const openOrdersLabelPdf = async (orders: ApiOrder[]): Promise<void> => {
  if (!orders.length) return;

  const [logoUrl, ...qrUrls] = await Promise.all([
    loadImage(pdfLogoUrl).catch(() => loadImage(pdfLogoFallbackUrl)).catch(() => ""),
    ...orders.map((order) =>
      generateQr(getQrPayload(order)),
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
    // Popup bloklangan bo'lsa — to'g'ridan-to'g'ri yuklab olish
    pdf.save(`elchi-orders-${Date.now()}.pdf`);
    URL.revokeObjectURL(url);
    return;
  }

  globalThis.setTimeout(() => URL.revokeObjectURL(url), 120_000);
};

export const openOrdersLabelBrowserPrint = (orders: ApiOrder[]): void => {
  if (!orders.length) return;
  openBrowserLabelPrintWindow(orders as LabelOrder[]);
};
