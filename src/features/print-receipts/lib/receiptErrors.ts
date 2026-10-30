/**
 * Chek xatolari — alohida yengil modul (HJ5sLHiz): sahifa bo'laklari va `useReceiptPrint` `instanceof` uchun shuni
 * statik import qiladi, shriftlar / jsPDF moduli esa faqat chop etishda dinamik yuklanadi.
 */

/** Shrift yuklanmadi — chop etilmaydi (TZ: `notify.error` + «Qayta urinish», shriftsiz chek yo'q). */
export class ReceiptFontError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ReceiptFontError";
  }
}
