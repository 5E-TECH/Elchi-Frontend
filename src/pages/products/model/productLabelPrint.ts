import { qrPath } from "./productCode";

/**
 * MAHSULOT STIKERI — chop etish (taxta `tizim-product-labels`: termal 40×30 va 58×40 mm, Gainscha GS-2408D 203 DPI,
 * faqat qora rang, haqiqiy o'lchamda). Tartib: yuqorida nom (2 qatorgacha, «…»), chapda QR (V1-Q, logosiz, 3 mm tinch
 * zona), o'ngda market (2 qatorgacha) va kod — «ELC-P-» kichik, raqam katta (QR o'qilmasa qo'lda yoziladi).
 */

export type LabelSize = "40x30" | "58x40";

type Box = { x: number; y: number; w?: number };
type LabelSpec = {
  width: number;
  height: number;
  name: Box & { pt: number; lineMm: number };
  qr: Box & { size: number };
  market: Box & { pt: number; lineMm: number };
  prefix: Box & { pt: number };
  number: Box & { pt: number };
};

/** O'lchamlar — millimetr (taxtadagi 1 mm = 5 px chizmadan). */
export const LABEL_SPECS: Record<LabelSize, LabelSpec> = {
  "40x30": {
    width: 40,
    height: 30,
    name: { x: 1.5, y: 1.2, w: 37, pt: 7.5, lineMm: 2.9 },
    qr: { x: 3, y: 10, size: 15.75 },
    market: { x: 21.75, y: 10, w: 16.75, pt: 7, lineMm: 2.8 },
    prefix: { x: 21.75, y: 18.55, w: 16.75, pt: 7 },
    number: { x: 21.75, y: 21.35, w: 16.75, pt: 11 },
  },
  "58x40": {
    width: 58,
    height: 40,
    name: { x: 2, y: 1.6, w: 54, pt: 9, lineMm: 3.6 },
    qr: { x: 4, y: 12.8, size: 21 },
    market: { x: 29, y: 12.8, w: 27, pt: 8, lineMm: 3.2 },
    prefix: { x: 29, y: 25.2, w: 27, pt: 8 },
    number: { x: 29, y: 28.6, w: 27, pt: 14 },
  },
};

export type ProductLabel = { name: string; market: string | null; code: string };

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** `ELC-P-000123` → «ELC-P-» + «000123»; boshqa kod — butunicha raqam qatorida. */
const splitCode = (code: string): [string, string] => {
  const match = /^(ELC-P-?)(\d+)$/i.exec(code.trim());
  return match ? [match[1].toUpperCase(), match[2]] : ["", code.trim()];
};

const box = ({ x, y, w }: Box) => `left:${x}mm;top:${y}mm;${w ? `width:${w}mm;` : ""}`;

/** Bitta stiker (HTML) — chop etish oynasi uchun. */
export const labelHtml = (label: ProductLabel, size: LabelSize): string => {
  const spec = LABEL_SPECS[size];
  const qr = qrPath(label.code);
  const [prefix, digits] = splitCode(label.code);
  const clamp = (lines: number, lineMm: number) =>
    `line-height:${lineMm}mm;max-height:${lines * lineMm}mm;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:${lines};overflow:hidden;overflow-wrap:anywhere;`;
  return `<div class="label">
  <div class="t" style="${box(spec.name)}font-size:${spec.name.pt}pt;font-weight:700;${clamp(2, spec.name.lineMm)}">${escapeHtml(label.name)}</div>
  ${
    qr
      ? `<svg class="qr" style="${box(spec.qr)}width:${spec.qr.size}mm;height:${spec.qr.size}mm" viewBox="0 0 ${qr.size} ${qr.size}" shape-rendering="crispEdges" aria-hidden="true"><path d="${qr.path}"/></svg>`
      : ""
  }
  ${
    label.market
      ? `<div class="t" style="${box(spec.market)}font-size:${spec.market.pt}pt;font-weight:500;${clamp(2, spec.market.lineMm)}">${escapeHtml(label.market)}</div>`
      : ""
  }
  ${prefix ? `<div class="t nw" style="${box(spec.prefix)}font-size:${spec.prefix.pt}pt;font-weight:600">${escapeHtml(prefix)}</div>` : ""}
  <div class="t nw" style="${box(spec.number)}font-size:${spec.number.pt}pt;font-weight:700;letter-spacing:.02em">${escapeHtml(digits)}</div>
</div>`;
};

/** To'liq chop etish hujjati: `copies` ta stiker, har biri alohida sahifa (`@page` — stiker o'lchami). */
export const labelsDocument = (label: ProductLabel, size: LabelSize, copies: number, title: string): string => {
  const spec = LABEL_SPECS[size];
  const count = Math.max(1, Math.min(500, Math.trunc(copies) || 1));
  const one = labelHtml(label, size);
  return `<!doctype html><html lang="uz"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
@page { size: ${spec.width}mm ${spec.height}mm; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: Manrope, Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.label { position: relative; width: ${spec.width}mm; height: ${spec.height}mm; overflow: hidden; page-break-after: always; break-after: page; }
.label:last-child { page-break-after: auto; break-after: auto; }
.t { position: absolute; }
.nw { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.qr { position: absolute; }
</style></head><body>${Array.from({ length: count }, () => one).join("")}
<script>window.addEventListener('load',function(){setTimeout(function(){try{window.focus();window.print();}catch(e){}},200);});window.onafterprint=function(){window.close();};</script>
</body></html>`;
};

/**
 * Stikerlarni chop etish oynasida ochadi (brauzer chop etish dialogi — termal printer va o'lchamni tanlash).
 * Oyna bloklansa — `false` (chaqiruvchi xabar beradi).
 */
export const printProductLabels = (label: ProductLabel, size: LabelSize, copies: number, title: string): boolean => {
  const html = labelsDocument(label, size, copies, title);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  // `noopener` bilan `window.open` doim `null` qaytaradi — bloklanganini bilib bo'lmasdi; blob manzil o'z domenimiz.
  const opened = window.open(url, "_blank", "width=480,height=420");
  globalThis.setTimeout(() => URL.revokeObjectURL(url), 120_000);
  return opened !== null;
};
