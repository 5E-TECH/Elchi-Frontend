import { loadReceiptFontData } from "./printReceiptFonts";
import { renderReceiptHtml } from "./printReceiptHtml";
import type { ReceiptPage } from "./printReceiptLayout";
import type { ReceiptOrderSource } from "./printReceiptModel";
import { buildOrderReceiptPages, buildPackageReceiptPage, createReceiptMeasure } from "./printReceipts";
import { RECEIPT_PACKAGE_SAMPLES, RECEIPT_SAMPLES } from "./receiptSamples";

/**
 * CHEK NAMUNALARI (`/ops/ui-kit?section=receipts`, TZ qabul 2 / FE-5): maket `tizim-receipts` namunalari chop etish
 * bilan aynan bir yo'ldan — shriftlar → o'lchov → joylash → `renderReceiptHtml` (brauzer chop etishidagi HTML),
 * ekranda maket masshtabida: termal va A4 katagi 1 mm = 5 px (maket 01, 03), A5 — 1 mm = 3 px (maket 02), A4 varaq —
 * kichik nusxa. Dinamik yuklanadi (jsPDF, shriftlar, joylash sahifa bo'lagiga kirmaydi).
 */

export type ReceiptPreviewId =
  | "main"
  | "partial"
  | "paid"
  | "returning"
  | "elNumber"
  | "continuation"
  | "batchThermal"
  | "batchA5"
  | "post"
  | "a4";

export interface ReceiptPreviewPage {
  /** Ekrandagi o'lcham, CSS px. */
  width: number;
  height: number;
  /** Qog'oz o'lchami, mm. */
  widthMm: number;
  heightMm: number;
  /** Shu sahifaning to'liq HTML hujjati (skriptsiz, `iframe` uchun). */
  html: string;
}

export interface ReceiptPreview {
  id: ReceiptPreviewId;
  /** 1 mm = shuncha px. */
  pxPerMm: number;
  pages: ReceiptPreviewPage[];
}

/** Termal / A4 katagi — maket 01 va 03 masshtabi. */
export const RECEIPT_PREVIEW_PX_PER_MM = 5;
/** A5 paket cheki — maket 02 masshtabi. */
export const RECEIPT_PREVIEW_A5_PX_PER_MM = 3;
/** A4 varaq — kichik nusxa (210 × 297 mm → 315 × 446 px). */
export const RECEIPT_PREVIEW_A4_PX_PER_MM = 1.5;

/** A4 varaq (12 katak): maket namunalari navbat bilan; sig'magan davomi (2/2) qo'shni katakka, 13-dan — yangi varaq. */
const A4_ORDERS: ReceiptOrderSource[] = [
  ...(
    ["main", "partial", "longName", "paid", "a", "b", "c", "d", "f", "returning", "elNumber"] as const
  ).map((key) => RECEIPT_SAMPLES[key]),
  { ...RECEIPT_SAMPLES.main, id: "10242", qr_code_token: null },
];

const toPreview = (
  id: ReceiptPreviewId,
  pages: ReadonlyArray<ReceiptPage>,
  pxPerMm: number,
): ReceiptPreview => ({
  id,
  pxPerMm,
  pages: pages.map((page) => ({
    width: Math.round(page.width * pxPerMm),
    height: Math.round(page.height * pxPerMm),
    widthMm: page.width,
    heightMm: page.height,
    html: renderReceiptHtml([page], { title: id, previewPxPerMm: pxPerMm }),
  })),
});

/** Barcha namunalar (tartib — maketdagidek). Xato: `ReceiptFontError` (shrift yuklanmadi) yoki kutilmagan. */
export const buildReceiptPreviews = async (): Promise<ReceiptPreview[]> => {
  const fonts = await loadReceiptFontData();
  const measure = createReceiptMeasure(fonts);
  const thermal = (source: ReceiptOrderSource) => buildOrderReceiptPages([source], measure);
  const px = RECEIPT_PREVIEW_PX_PER_MM;
  return [
    toPreview("main", await thermal(RECEIPT_SAMPLES.main), px),
    toPreview("partial", await thermal(RECEIPT_SAMPLES.partial), px),
    toPreview("paid", await thermal(RECEIPT_SAMPLES.paid), px),
    toPreview("returning", await thermal(RECEIPT_SAMPLES.returning), px),
    toPreview("elNumber", await thermal(RECEIPT_SAMPLES.elNumber), px),
    toPreview("continuation", await thermal(RECEIPT_SAMPLES.e), px),
    toPreview(
      "batchThermal",
      [buildPackageReceiptPage(RECEIPT_PACKAGE_SAMPLES.batch, measure, "thermal")],
      px,
    ),
    toPreview(
      "batchA5",
      [buildPackageReceiptPage(RECEIPT_PACKAGE_SAMPLES.batch, measure, "a5")],
      RECEIPT_PREVIEW_A5_PX_PER_MM,
    ),
    toPreview(
      "post",
      [buildPackageReceiptPage(RECEIPT_PACKAGE_SAMPLES.post, measure, "thermal")],
      px,
    ),
    toPreview(
      "a4",
      await buildOrderReceiptPages(A4_ORDERS, measure, { sheet: "a4" }),
      RECEIPT_PREVIEW_A4_PX_PER_MM,
    ),
  ];
};
