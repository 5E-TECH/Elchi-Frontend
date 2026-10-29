import { jsPDF } from "jspdf";
import {
  createPdfReceiptMeasure,
  loadReceiptFontData,
  registerReceiptFonts,
  type ReceiptFontData,
  type ReceiptMeasure,
} from "./printReceiptFonts";
import { printReceiptHtml, renderReceiptHtmlSliced } from "./printReceiptHtml";
import {
  A4_SHEET,
  composeReceiptPages,
  layoutOrderReceipt,
  ORDER_RECEIPT_SPECS,
  type ReceiptLabel,
  type ReceiptPage,
  type ReceiptSheet,
} from "./printReceiptLayout";
import {
  layoutPackageReceipt,
  PACKAGE_RECEIPT_SPECS,
  toReceiptPackageModel,
  type ReceiptPackageSheet,
  type ReceiptPackageSource,
} from "./printReceiptPackage";
import {
  toReceiptOrderModel,
  type ReceiptOrderModel,
  type ReceiptOrderSource,
} from "./printReceiptModel";
import { openReceiptPdf, receiptPdfOptions, renderReceiptPdf } from "./printReceiptPdf";
import { createReceiptScheduler, type ReceiptScheduler } from "./receiptScheduler";

/**
 * CHEK CHOP ETISH YO'LI (HJ5sLHiz, TZ F9) — dinamik yuklanadi (`index.ts`): jsPDF va shriftlar faqat chop etishda.
 * Shriftlar → bitta jsPDF hujjati (o'lchash ham, PDF ham shu) → model → joylash → bitta `ReceiptPage[]` → PDF yoki
 * brauzer (yashirin iframe). Ish vaqt bo'yicha bo'laklanadi (`ReceiptScheduler`, 32 ms): joylash, PDF chizish va HTML
 * yig'ish har birlikdan keyin navbat beradi — 200 ta chekda UI 100 ms dan ortiq qotmaydi (TZ qabul 8). 200 dan ko'p
 * buyurtma — 200 taliklab alohida ish (backend chegarasi bilan bir xil; davomi yorliqlari hisobga kirmaydi).
 */

/** Bitta chop etish ishi (PDF / brauzer oynasi) dagi buyurtmalar. */
export const RECEIPT_JOB_LIMIT = 200;

export type ReceiptOutput = "browser" | "pdf";

export interface PrintOrderReceiptsOptions {
  /** Termal 100×60 (sukut) yoki A4 varaq (12 ta). */
  sheet?: ReceiptSheet;
  output: ReceiptOutput;
  /**
   * Buyurtma yorliqlaridan keyin qo'shiladigan yorliqlar (T8 / 0OUcHZ7R — kategoriya yorlig'i). O'sha `measure` bilan,
   * varaq katagi o'lchamida (`ORDER_RECEIPT_SPECS[sheet]`) joylanadi.
   */
  labelsAfterOrder?: (
    order: ReceiptOrderSource,
    model: ReceiptOrderModel,
    measure: ReceiptMeasure,
    sheet: ReceiptSheet,
  ) => ReceiptLabel[];
  /**
   * Buyurtma cheklaridan oldin bitta chop etish ishida — pochta cheki (ega qarori 5: eski pochtada «Chekni qayta chop
   * etish»). Faqat termal varaqda (sahifa o'lchami bir xil).
   */
  leadingPackage?: ReceiptPackageSource;
  /** PDF yuklab olinganda fayl nomi (kengaytmasiz). */
  fileName?: string;
  /** Ishni bo'laklash (sukut — yangi `createReceiptScheduler()`; testda soxta soat bilan). */
  scheduler?: ReceiptScheduler;
}

export interface PrintPackageReceiptOptions {
  /** Termal 100×60 (sukut) yoki A5 varaq (ofis printeri). */
  sheet?: ReceiptPackageSheet;
  output: ReceiptOutput;
  fileName?: string;
}

export interface ReceiptPrintResult {
  orders: number;
  pages: number;
  /** Chop etish ishlari soni (200 taliklab). */
  jobs: number;
  /** QR tokeni yo'q buyurtmalar (chekda «QR yo'q» ramkasi). */
  withoutQr: number;
  /** PDF: oynada ochildi yoki (oyna bloklangan) yuklab olindi; brauzer — `printed`. */
  delivery: Array<"opened" | "saved" | "printed">;
}

/** Shriftlarni oldindan yuklaydi (xato yutiladi — chop etishda qayta urinib, xabar beriladi). */
export const warmUpReceiptPrinting = () =>
  loadReceiptFontData().then(
    () => undefined,
    () => undefined,
  );

/** Varaq (birinchi sahifa) o'lchami — PDF hujjati joylashdan oldin shu bilan yaratiladi. */
const sheetSize = (sheet: ReceiptSheet) =>
  sheet === "a4"
    ? { width: A4_SHEET.width, height: A4_SHEET.height }
    : { width: ORDER_RECEIPT_SPECS.thermal.width, height: ORDER_RECEIPT_SPECS.thermal.height };

/** Shriftlar qo'shilgan jsPDF hujjati: o'lchash ham, PDF ham shu (ikkinchi hujjat va shriftlarni qayta o'qish yo'q). */
const createReceiptDocument = (
  fonts: ReceiptFontData,
  size: { width: number; height: number } = sheetSize("thermal"),
) => {
  const pdf = new jsPDF(receiptPdfOptions(size));
  registerReceiptFonts(pdf, fonts);
  return pdf;
};

/** Shriftlar qo'shilgan o'lchov hujjati (o'lchash jsPDF metrikasi bilan — PDF va brauzer bir xil). */
export const createReceiptMeasure = (fonts: ReceiptFontData): ReceiptMeasure =>
  createPdfReceiptMeasure(createReceiptDocument(fonts), fonts);

/** Buyurtmalar → sahifalar (`ReceiptPage[]`) — ikkala renderer uchun bitta manba. Har buyurtmadan keyin navbat. */
export const buildOrderReceiptPages = async (
  orders: ReadonlyArray<ReceiptOrderSource>,
  measure: ReceiptMeasure,
  options: Pick<PrintOrderReceiptsOptions, "sheet" | "labelsAfterOrder" | "scheduler"> = {},
): Promise<ReceiptPage[]> => {
  const sheet = options.sheet ?? "thermal";
  const spec = ORDER_RECEIPT_SPECS[sheet];
  const scheduler = options.scheduler ?? createReceiptScheduler();
  const labels: ReceiptLabel[] = [];
  for (const order of orders) {
    const model = toReceiptOrderModel(order);
    labels.push(...layoutOrderReceipt(model, { measure }, spec));
    labels.push(...(options.labelsAfterOrder?.(order, model, measure, sheet) ?? []));
    await scheduler.checkpoint();
  }
  return composeReceiptPages(labels, sheet);
};

/** Paket / pochta cheki → bitta sahifa (termal 100×60 yoki A5). */
export const buildPackageReceiptPage = (
  source: ReceiptPackageSource,
  measure: ReceiptMeasure,
  sheet: ReceiptPackageSheet = "thermal",
): ReceiptPage => {
  const { width, height, ops } = layoutPackageReceipt(
    toReceiptPackageModel(source),
    { measure },
    sheet,
  );
  return { width, height, ops };
};

const chunk = <T>(items: ReadonlyArray<T>, size: number): T[][] => {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size)
    out.push(items.slice(index, index + size));
  return out;
};

/**
 * Tayyor sahifalarni chiqaradi: PDF (yangi oyna / yuklab olish) yoki brauzer (yashirin iframe). `pdf` — sahifalar
 * chiziladigan hujjat (birinchi sahifasi varaq o'lchamida, bo'sh).
 */
const deliverPages = async (
  pages: ReceiptPage[],
  pdf: () => jsPDF,
  output: ReceiptOutput,
  fileName: string,
  scheduler: ReceiptScheduler,
): Promise<"opened" | "saved" | "printed"> => {
  if (output === "pdf") {
    const doc = pdf();
    await renderReceiptPdf(doc, pages, () => scheduler.checkpoint());
    await scheduler.checkpoint();
    return openReceiptPdf(doc, `${fileName}.pdf`);
  }
  const html = await renderReceiptHtmlSliced(pages, scheduler);
  await printReceiptHtml(html);
  return "printed";
};

/**
 * Buyurtma cheklarini chop etadi. Xatolar chaqiruvchiga (UI — `notify.error`): `ReceiptFontError` — shrift yuklanmadi
 * (chop etilmaydi, «Qayta urinish»), boshqasi — kutilmagan xato.
 */
export const printOrderReceipts = async (
  orders: ReadonlyArray<ReceiptOrderSource>,
  options: PrintOrderReceiptsOptions,
): Promise<ReceiptPrintResult> => {
  const sheet = options.sheet ?? "thermal";
  if (options.leadingPackage && sheet !== "thermal") {
    throw new Error("Pochta cheki buyurtma cheklari bilan faqat termal varaqda chop etiladi");
  }
  const result: ReceiptPrintResult = {
    orders: orders.length,
    pages: 0,
    jobs: 0,
    withoutQr: orders.filter((order) => !order.qr_code_token?.trim()).length,
    delivery: [],
  };
  if (orders.length === 0 && !options.leadingPackage) return result;

  const scheduler = options.scheduler ?? createReceiptScheduler();
  const fonts = await loadReceiptFontData();
  // Birinchi ishning hujjati: o'lchash shu bilan, PDF bo'lsa — sahifalar ham shunga chiziladi.
  const first = createReceiptDocument(fonts, sheetSize(sheet));
  const measure = createPdfReceiptMeasure(first, fonts);
  await scheduler.checkpoint();
  const jobs = orders.length ? chunk(orders, RECEIPT_JOB_LIMIT) : [[]];
  for (let job = 0; job < jobs.length; job += 1) {
    const pages = await buildOrderReceiptPages(jobs[job], measure, {
      ...options,
      sheet,
      scheduler,
    });
    if (job === 0 && options.leadingPackage) {
      pages.unshift(buildPackageReceiptPage(options.leadingPackage, measure, "thermal"));
    }
    if (pages.length === 0) continue;
    result.pages += pages.length;
    result.jobs += 1;
    const suffix = jobs.length > 1 ? `-${job + 1}` : "";
    result.delivery.push(
      await deliverPages(
        pages,
        () => (job === 0 ? first : createReceiptDocument(fonts, sheetSize(sheet))),
        options.output,
        `${options.fileName ?? "elchi-cheklar"}${suffix}`,
        scheduler,
      ),
    );
  }
  return result;
};

/** Paket yoki pochta chekini chop etadi (bitta sahifa). Xatolar — `printOrderReceipts` dagidek. */
export const printPackageReceipt = async (
  source: ReceiptPackageSource,
  options: PrintPackageReceiptOptions,
): Promise<ReceiptPrintResult> => {
  const sheet = options.sheet ?? "thermal";
  const fonts = await loadReceiptFontData();
  const pdf = createReceiptDocument(fonts, PACKAGE_RECEIPT_SPECS[sheet]);
  const page = buildPackageReceiptPage(source, createPdfReceiptMeasure(pdf, fonts), sheet);
  const delivery = await deliverPages(
    [page],
    () => pdf,
    options.output,
    options.fileName ?? "elchi-paket",
    createReceiptScheduler(),
  );
  return {
    orders: 0,
    pages: 1,
    jobs: 1,
    withoutQr: source.token?.trim() ? 0 : 1,
    delivery: [delivery],
  };
};
