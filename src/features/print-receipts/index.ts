/**
 * Chek va yorliq (HJ5sLHiz, maket `tizim-receipts`): buyurtma cheki (termal 100×60 yoki A4 varaq — 12 ta), paket va
 * pochta cheki (termal 100×60 yoki A5) — bitta joylash algoritmi, PDF va brauzer bitta `ReceiptPage[]` dan.
 *
 * BU BARREL YENGIL — sahifa bo'laklari faqat shuni statik import qiladi: undagi statik importlar faqat
 * `receiptContact` (telefon formati), `receiptErrors`, `useReceiptPrint` va `ReceiptQr` (o'zi ham dinamik yuklaydi).
 * Og'ir modullar — jsPDF, shriftlar (`?url` TTF), GPOS kerning, joylash, `qrcode` — faqat birinchi chop etish /
 * namuna / QR chizishda `import()` bilan keladi (entry va sahifa bo'laklariga kirmaydi — `npm run check:bundle`,
 * `index.lazy.test.ts`). Bu yerga `./lib/*` dan qiymat (`export { … } from`) qo'shmang — faqat `export type`.
 *
 * Kirish nuqtalari: «Qabul va yaratish» (`new_orderDetail.tsx`), pochta (`printMode.ts`, `oldMails.tsx`), paket
 * (`BatchDetailPage.tsx`); buyurtma tafsiloti (TzfF0bmQ): `await printOrderReceipts([order], { output: "browser" })`.
 * UI: oldindan `countReceiptsWithoutQr` → `notify.warning`, tugma `loading`, xatoda `notify.error` (`ReceiptFontError`
 * — «Qayta urinish»).
 */
import type {
  PrintOrderReceiptsOptions,
  PrintPackageReceiptOptions,
  ReceiptPrintResult,
} from "./lib/printReceipts";
import type { ReceiptOrderSource } from "./lib/printReceiptModel";
import type { ReceiptPackageSource } from "./lib/printReceiptPackage";

export type {
  PrintOrderReceiptsOptions,
  PrintPackageReceiptOptions,
  ReceiptOutput,
  ReceiptPrintResult,
} from "./lib/printReceipts";
export type {
  ReceiptPackageModel,
  ReceiptPackageSheet,
  ReceiptPackageSource,
  ReceiptPersonSource,
} from "./lib/printReceiptPackage";
export type {
  ReceiptAmount,
  ReceiptOrderItemSource,
  ReceiptOrderModel,
  ReceiptOrderSource,
} from "./lib/printReceiptModel";
export type {
  OrderReceiptSpec,
  ReceiptLabel,
  ReceiptLabelMeta,
  ReceiptOp,
  ReceiptPage,
  ReceiptSheet,
} from "./lib/printReceiptLayout";
export type { ReceiptMeasure } from "./lib/printReceiptFonts";
export type { ReceiptPreview, ReceiptPreviewId, ReceiptPreviewPage } from "./lib/receiptPreview";
export { ReceiptFontError } from "./lib/receiptErrors";
export {
  formatReceiptPerson,
  formatReceiptPhone,
  getReceiptContactPhone,
  getReceiptContactPhones,
} from "./lib/receiptContact";
export type { ReceiptContactSource } from "./lib/receiptContact";

/** QR tokeni yo'q buyurtmalar soni — chop etishdan oldin `notify.warning` «N ta buyurtmada QR yo'q» uchun. */
export const countReceiptsWithoutQr = (
  orders: ReadonlyArray<Pick<ReceiptOrderSource, "qr_code_token">>,
) =>
  orders.filter((order) => !(typeof order.qr_code_token === "string" && order.qr_code_token.trim()))
    .length;

/**
 * Paket / pochta chekida QR tokeni yo'q — `notify.warning` uchun (`useReceiptPrint` → `packageWithoutQr`): `batch` /
 * `post`, token bor — `null`.
 */
export const receiptPackageWithoutQr = (
  source: Pick<ReceiptPackageSource, "kind" | "token">,
): ReceiptPackageSource["kind"] | null =>
  typeof source.token === "string" && source.token.trim() ? null : source.kind;

const loadPrinting = () => import("./lib/printReceipts");

/**
 * Buyurtma cheklarini chop etadi (`sheet`: termal 100×60 yoki A4 — 12 ta): `output: "browser"` — yashirin iframe +
 * chop etish oynasi, `"pdf"` — PDF yangi oynada (bloklansa — yuklab olinadi). `leadingPackage` — avval pochta cheki
 * (termal). Xato: `ReceiptFontError` (shrift yuklanmadi — chop etilmaydi) yoki boshqa — chaqiruvchi `notify.error`.
 */
export const printOrderReceipts = async (
  orders: ReadonlyArray<ReceiptOrderSource>,
  options: PrintOrderReceiptsOptions,
): Promise<ReceiptPrintResult> => (await loadPrinting()).printOrderReceipts(orders, options);

/** Paket yoki pochta chekini chop etadi (`sheet`: termal 100×60 yoki A5). Xatolar — `printOrderReceipts` dagidek. */
export const printPackageReceipt = async (
  source: ReceiptPackageSource,
  options: PrintPackageReceiptOptions,
): Promise<ReceiptPrintResult> => (await loadPrinting()).printPackageReceipt(source, options);

/** Menyu ochilganda oldindan yuklash (jsPDF + shriftlar): chop etish bosilgach kutish qisqaradi. Xato yutiladi. */
export const preloadReceiptPrinting = (): Promise<void> =>
  loadPrinting().then(
    (module) => module.warmUpReceiptPrinting(),
    () => undefined,
  );

/**
 * `/ops/ui-kit?section=receipts` namunalari (maket `tizim-receipts`): chop etishdagi HTML, maket masshtabida. Modul
 * (jsPDF, shriftlar, joylash) shu chaqiruvda yuklanadi.
 */
export const loadReceiptPreviews = async () =>
  (await import("./lib/receiptPreview")).buildReceiptPreviews();

export { useReceiptPrint, type ReceiptPrintTask } from "./model/useReceiptPrint";
export { default as ReceiptQr } from "./ui/ReceiptQr";
