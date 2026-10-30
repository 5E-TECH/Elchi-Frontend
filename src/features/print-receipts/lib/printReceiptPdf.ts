import type { jsPDF } from "jspdf";
import { RECEIPT_FACES, splitFaceRuns } from "./printReceiptFonts";
import {
  SCISSORS_LINES,
  splitReceiptKerned,
  type ReceiptOp,
  type ReceiptPage,
  type ReceiptTextOp,
} from "./printReceiptLayout";

/**
 * CHEK PDF RENDERERI (HJ5sLHiz, TZ F9): joylash amallarini (`ReceiptPage[]`) jsPDF'ga chizadi — birlik mm, faqat qora
 * va oq (kulrang termalda nuqtali chiqadi): matn / to'ldirish / chiziq rangi 0 yoki 255. Shriftlar
 * (`registerReceiptFonts`) hujjatga oldin qo'shilgan bo'lishi kerak; jsPDF ishlatilgan glifllarni o'zi qirqib joylaydi.
 */

/** RGB kanal: qora siyoh (0) va oq qog'oz (255). */
const INK = 0;
const PAPER = 255;

/** jsPDF kerning qo'llamaydi: matn kerning joylarida bo'linadi, har bo'lak o'z `x` ida (joylash hisobi bilan bir xil). */
const drawText = (pdf: jsPDF, op: ReceiptTextOp) => {
  const tone = op.paper ? PAPER : INK;
  pdf.setTextColor(tone, tone, tone);
  pdf.setFontSize(op.pt);
  const spacing = op.letterSpacing ?? 0;
  let x = op.x;
  for (const [part, offset] of splitReceiptKerned(op)) {
    for (const run of splitFaceRuns(part, op.weight)) {
      pdf.setFont(RECEIPT_FACES[run.face].pdfName, "normal");
      pdf.text(run.text, x, op.baseline, {
        baseline: "alphabetic",
        ...(spacing ? { charSpace: spacing } : {}),
      });
      x += pdf.getTextWidth(run.text) + spacing * Array.from(run.text).length;
    }
    x += offset;
  }
};

const drawOp = (pdf: jsPDF, op: ReceiptOp) => {
  switch (op.kind) {
    case "text":
      drawText(pdf, op);
      return;
    case "rect":
      pdf.setFillColor(INK, INK, INK);
      if (op.radius) pdf.roundedRect(op.x, op.y, op.w, op.h, op.radius, op.radius, "F");
      else pdf.rect(op.x, op.y, op.w, op.h, "F");
      return;
    case "frame": {
      // Chiziq tashqi chegaradan ichkariga (HTML `border-box` bilan bir xil).
      const inset = op.stroke / 2;
      const radius = Math.max(0, op.radius - inset);
      pdf.setDrawColor(INK, INK, INK);
      pdf.setLineWidth(op.stroke);
      if (radius)
        pdf.roundedRect(
          op.x + inset,
          op.y + inset,
          op.w - op.stroke,
          op.h - op.stroke,
          radius,
          radius,
          "S",
        );
      else pdf.rect(op.x + inset, op.y + inset, op.w - op.stroke, op.h - op.stroke, "S");
      return;
    }
    case "dash":
      pdf.setDrawColor(INK, INK, INK);
      pdf.setLineWidth(op.stroke);
      pdf.setLineDashPattern([op.dash, op.gap], 0);
      pdf.line(op.x1, op.y1, op.x2, op.y2);
      pdf.setLineDashPattern([], 0);
      return;
    case "qr": {
      // Qatordagi qo'shni qora modullar — bitta `rect` (TZ F5).
      pdf.setFillColor(INK, INK, INK);
      const m = op.module;
      for (const [row, col, length] of op.symbol.runs)
        pdf.rect(op.x + col * m, op.y + row * m, length * m, m, "F");
      return;
    }
    case "scissors": {
      // lucide `Scissors` (24 birlik, chiziq 2): ikki halqa va uch chiziq.
      const unit = op.size / 24;
      const at = (value: number, base: number) => base + value * unit;
      pdf.setDrawColor(INK, INK, INK);
      pdf.setLineWidth(2 * unit);
      pdf.setLineCap("round");
      pdf.circle(at(6, op.x), at(6, op.y), 3 * unit, "S");
      pdf.circle(at(6, op.x), at(18, op.y), 3 * unit, "S");
      for (const [x1, y1, x2, y2] of SCISSORS_LINES)
        pdf.line(at(x1, op.x), at(y1, op.y), at(x2, op.x), at(y2, op.y));
      pdf.setLineCap("butt");
      return;
    }
  }
};

const orientationOf = (page: Pick<ReceiptPage, "width" | "height">): "landscape" | "portrait" =>
  page.width > page.height ? "landscape" : "portrait";

/**
 * jsPDF konstruktori parametrlari (birinchi sahifa o'lchamida).
 *
 * `compress: false` — TZ qabul 8 (UI 100 ms dan ortiq qotmaydi): jsPDF siqishni `output()` ichida bitta sinxron blokda
 * qiladi — 200 ta chekda 250–550 ms (`scratchpad/receipts-fix` o'lchovi), uni bo'laklab bo'lmaydi. Siqilmagan fayl
 * ~3 MB (200 ta chek), `output()` ~60 ms; fayl faqat lokal `blob:` oynada ochiladi yoki chop etiladi.
 * `floatPrecision: 3` — koordinatalar 0,001 pt (0,0004 mm) gacha: fayl va `output()` ikki baravar kichik.
 */
export const receiptPdfOptions = (page: Pick<ReceiptPage, "width" | "height">) => ({
  unit: "mm" as const,
  format: [page.width, page.height],
  orientation: orientationOf(page),
  compress: false,
  floatPrecision: 3,
});

/** Bitta sahifani joriy jsPDF sahifasiga chizadi. */
export const drawReceiptPage = (pdf: jsPDF, page: ReceiptPage) => {
  for (const op of page.ops) drawOp(pdf, op);
};

/**
 * Sahifalarni hujjatga chizadi (birinchisi — mavjud sahifaga, qolgani `addPage`). `onPage` — har sahifadan keyin
 * (chaqiruvchi `ReceiptScheduler.checkpoint` bilan vaqt bo'yicha navbat beradi).
 */
export const renderReceiptPdf = async (
  pdf: jsPDF,
  pages: ReadonlyArray<ReceiptPage>,
  onPage?: (index: number) => void | Promise<void>,
) => {
  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    if (index > 0) pdf.addPage([page.width, page.height], orientationOf(page));
    drawReceiptPage(pdf, page);
    await onPage?.(index);
  }
};

/**
 * Tayyor PDF'ni yangi oynada ochadi (`noopener` siz — aks holda `window.open` doim `null` qaytaradi va har safar
 * yuklab olishga tushardi, TzfF0bmQ); oyna bloklansa — fayl sifatida saqlaydi.
 */
export const openReceiptPdf = (pdf: jsPDF, fileName: string): "opened" | "saved" => {
  const url = URL.createObjectURL(pdf.output("blob"));
  const opened = window.open(url, "_blank");
  if (!opened) {
    URL.revokeObjectURL(url);
    pdf.save(fileName);
    return "saved";
  }
  globalThis.setTimeout(() => URL.revokeObjectURL(url), 120_000);
  return "opened";
};
