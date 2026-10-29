import { jsPDF } from "jspdf";
import {
  createPdfReceiptMeasure,
  loadReceiptFontData,
  registerReceiptFonts,
  type ReceiptFontData,
  type ReceiptMeasure,
} from "./printReceiptFonts";
import { printReceiptHtml, renderReceiptHtml } from "./printReceiptHtml";
import {
  composeReceiptPages,
  layoutOrderReceipt,
  ORDER_RECEIPT_SPECS,
  type ReceiptLabel,
  type ReceiptPage,
  type ReceiptSheet,
} from "./printReceiptLayout";
import {
  layoutPackageReceipt,
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

/**
 * CHEK CHOP ETISH YO'LI (HJ5sLHiz, TZ F9) — dinamik yuklanadi (`index.ts`): jsPDF va shriftlar faqat chop etishda.
 * Shriftlar → o'lchovchi → model → joylash (25 taliklab `await`, UI qotmaydi) → bitta `ReceiptPage[]` → PDF yoki
 * brauzer (yashirin iframe). 200 dan ko'p buyurtma — 200 taliklab alohida ish (backend chegarasi bilan bir xil;
 * davomi yorliqlari hisobga kirmaydi).
 */

/** Bir `await` oralig'idagi buyurtmalar. */
export const RECEIPT_CHUNK = 25;
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

const yieldToMain = () => new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0));

/** Shriftlar qo'shilgan o'lchov hujjati (o'lchash jsPDF metrikasi bilan — PDF va brauzer bir xil). */
export const createReceiptMeasure = (fonts: ReceiptFontData): ReceiptMeasure => {
  const pdf = new jsPDF({ unit: "mm", format: [100, 60], orientation: "landscape" });
  registerReceiptFonts(pdf, fonts);
  return createPdfReceiptMeasure(pdf, fonts);
};

/** Buyurtmalar → sahifalar (`ReceiptPage[]`) — ikkala renderer uchun bitta manba. */
export const buildOrderReceiptPages = async (
  orders: ReadonlyArray<ReceiptOrderSource>,
  measure: ReceiptMeasure,
  options: Pick<PrintOrderReceiptsOptions, "sheet" | "labelsAfterOrder"> = {},
): Promise<ReceiptPage[]> => {
  const sheet = options.sheet ?? "thermal";
  const spec = ORDER_RECEIPT_SPECS[sheet];
  const labels: ReceiptLabel[] = [];
  for (let index = 0; index < orders.length; index += 1) {
    if (index > 0 && index % RECEIPT_CHUNK === 0) await yieldToMain();
    const order = orders[index];
    const model = toReceiptOrderModel(order);
    labels.push(...layoutOrderReceipt(model, { measure }, spec));
    labels.push(...(options.labelsAfterOrder?.(order, model, measure, sheet) ?? []));
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

/** Tayyor sahifalarni chiqaradi: PDF (yangi oyna / yuklab olish) yoki brauzer (yashirin iframe). */
const deliverPages = async (
  pages: ReceiptPage[],
  fonts: ReceiptFontData,
  output: ReceiptOutput,
  fileName: string,
): Promise<"opened" | "saved" | "printed"> => {
  if (output === "pdf") {
    const pdf = new jsPDF(receiptPdfOptions(pages[0]));
    registerReceiptFonts(pdf, fonts);
    await renderReceiptPdf(pdf, pages, (index) =>
      index > 0 && index % RECEIPT_CHUNK === 0 ? yieldToMain() : undefined,
    );
    return openReceiptPdf(pdf, `${fileName}.pdf`);
  }
  await printReceiptHtml(renderReceiptHtml(pages));
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

  const fonts = await loadReceiptFontData();
  const measure = createReceiptMeasure(fonts);
  const jobs = orders.length ? chunk(orders, RECEIPT_JOB_LIMIT) : [[]];
  for (let job = 0; job < jobs.length; job += 1) {
    const pages = await buildOrderReceiptPages(jobs[job], measure, { ...options, sheet });
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
        fonts,
        options.output,
        `${options.fileName ?? "elchi-cheklar"}${suffix}`,
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
  const fonts = await loadReceiptFontData();
  const page = buildPackageReceiptPage(
    source,
    createReceiptMeasure(fonts),
    options.sheet ?? "thermal",
  );
  const delivery = await deliverPages(
    [page],
    fonts,
    options.output,
    options.fileName ?? "elchi-paket",
  );
  return {
    orders: 0,
    pages: 1,
    jobs: 1,
    withoutQr: source.token?.trim() ? 0 : 1,
    delivery: [delivery],
  };
};
