import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { jsPDF } from "jspdf";
import {
  createPdfReceiptMeasure,
  loadReceiptFontData,
  RECEIPT_FACES,
  registerReceiptFonts,
  resetReceiptFontCache,
  type ReceiptFontData,
  type ReceiptFontLoader,
  type ReceiptMeasure,
} from "../features/print-receipts/lib/printReceiptFonts";

/**
 * Chek testlari uchun shriftlar: haqiqiy TTF fayllar diskdan (`src/shared/assets/fonts`) — o'lchash brauzer va PDF
 * bilan bir xil (jsPDF `getStringUnitWidth`), maket koordinatalari bilan solishtiriladi.
 */
const FONT_DIR = resolve(__dirname, "../shared/assets/fonts");

export const receiptDiskFontLoader: ReceiptFontLoader = async (face) =>
  new Uint8Array(readFileSync(resolve(FONT_DIR, RECEIPT_FACES[face].file)));

export const loadTestReceiptFonts = async (): Promise<ReceiptFontData> => {
  resetReceiptFontCache();
  const data = await loadReceiptFontData(receiptDiskFontLoader);
  resetReceiptFontCache();
  return data;
};

export const createTestReceiptPdf = (data: ReceiptFontData) => {
  const pdf = new jsPDF({
    unit: "mm",
    format: [100, 60],
    orientation: "landscape",
    compress: false,
  });
  registerReceiptFonts(pdf, data);
  return pdf;
};

export const createTestReceiptMeasure = (data: ReceiptFontData): ReceiptMeasure =>
  createPdfReceiptMeasure(createTestReceiptPdf(data), data);
