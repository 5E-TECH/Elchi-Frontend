import type { MailDetailPost, PostOrder } from "../../../../entities/mails";
import {
  printOrderReceipts,
  printPackageReceipt,
  type ReceiptPackageSource,
  type ReceiptPrintResult,
} from "../../../../features/print-receipts";

/**
 * Pochta tafsilotidagi chop etish usullari (menyu — `ui/printOptions.tsx`), hammasi `features/print-receipts` orqali
 * (HJ5sLHiz, maket `tizim-receipts`, TZ F10):
 *   `browser`      — buyurtma cheklari, termal 100×60, brauzer chop etish oynasi;
 *   `pdf_100x60`   — o'shalar PDF'da (yangi oyna, bloklansa — yuklab olinadi);
 *   `a4`           — A4 varaq, 12 tadan (ofis printeri);
 *   `post_receipt` — pochta cheki (qop uchun, termal 100×60) — buyurtmalar emas, pochtaning o'zi.
 * `PostOrder` chek modeliga to'g'ridan-to'g'ri beriladi: mahsulot nomi yo'q bo'lsa model o'zi «Mahsulot» deydi,
 * `order_number` (BE-1) kelsa «№EL-…», kelmasa «№{id}».
 */
export type PrintMode = "browser" | "pdf_100x60" | "a4" | "post_receipt";
export type OrderPrintMode = Exclude<PrintMode, "post_receipt">;

export const printOrders = (
  mode: OrderPrintMode,
  orders: ReadonlyArray<PostOrder>,
): Promise<ReceiptPrintResult> =>
  printOrderReceipts(orders, {
    sheet: mode === "a4" ? "a4" : "thermal",
    output: mode === "pdf_100x60" ? "pdf" : "browser",
  });

/** Pochta javobidagi jami (`homeOrders` + `centerOrders`). */
export interface PostTotals {
  homeOrders?: { homeOrdersTotalPrice?: number | null } | null;
  centerOrders?: { centerOrdersTotalPrice?: number | null } | null;
}

const totalOf = (totals?: PostTotals | null): number | null => {
  const home = totals?.homeOrders?.homeOrdersTotalPrice;
  const center = totals?.centerOrders?.centerOrdersTotalPrice;
  if (home == null && center == null) return null;
  return (Number(home) || 0) + (Number(center) || 0);
};

/**
 * Pochta → pochta cheki manbasi (TZ F8): №{post.id}, vaqt, «Qayerdan» — `post.branch` (BE-2, kelmasa qator yo'q),
 * «Qayerga» — pochta viloyati, «Buyurtmalar» — pochtadagi qatorlar soni, «Jami summa» — `homeOrders` + `centerOrders`,
 * kuryer, QR — `post.qr_code_token`.
 */
export const toPostReceiptSource = (input: {
  postId: string;
  post?: MailDetailPost | null;
  orders: ReadonlyArray<PostOrder>;
  totals?: PostTotals | null;
  /** Zaxiralar (eski backendda `post` meta'si yo'q): ro'yxat qatoridagi viloyat, sana, kuryer. */
  regionName?: string | null;
  createdAt?: string | null;
  courier?: { name?: string | null; phone_number?: string | null } | null;
}): ReceiptPackageSource => {
  const { post, orders } = input;
  return {
    kind: "post",
    id: post?.id ?? input.postId,
    token: post?.qr_code_token ?? null,
    createdAt: post?.createdAt ?? input.createdAt ?? null,
    from: post?.branch?.name ?? null,
    to:
      post?.region?.name ??
      input.regionName ??
      orders[0]?.district?.region?.name ??
      orders[0]?.region?.name ??
      null,
    ordersCount: orders.length,
    totalPrice: totalOf(input.totals),
    courier: post?.courier ?? input.courier ?? null,
  };
};

/** «Pochta cheki» menyu bandi: faqat pochta cheki (termal 100×60, brauzer). */
export const printPostReceipt = (source: ReceiptPackageSource): Promise<ReceiptPrintResult> =>
  printPackageReceipt(source, { sheet: "thermal", output: "browser" });

/**
 * Eski pochtada «Chekni qayta chop etish» (ega qarori 5): avval pochta cheki, keyin buyurtma cheklari — bitta chop
 * etish ishida (termal 100×60, brauzer).
 */
export const printPostWithOrders = (
  source: ReceiptPackageSource,
  orders: ReadonlyArray<PostOrder>,
): Promise<ReceiptPrintResult> =>
  printOrderReceipts(orders, { sheet: "thermal", output: "browser", leadingPackage: source });
