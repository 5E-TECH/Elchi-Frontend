import i18n from "../../../../../i18n";
import { notify } from "../../../../../shared/lib/notify";

/**
 * BUYURTMA AMALLARI OYNALARI (sotish, qisman sotish, bekor qilish, qaytarish) — umumiy model.
 *
 * Oynalar uch joyda ochiladi: kuryer ro'yxati, menejer ro'yxati va buyurtma tafsiloti. Har joy
 * buyurtmani o'z shaklida beradi (kuryer qatorida `product` obyekti bor, admin qatorida faqat
 * `product_id`, hamkor posilkasida ikkalasi ham `null`), shuning uchun tur — faqat oyna o'qiydigan
 * maydonlar, hammasi ixtiyoriy (kelmasa «—»).
 */

/**
 * Maket varianti: `courier` — `courier-orders-*-dialog` (bosh harfli avatar, yashil «Sotish»,
 * qisman sotishda ikki ustun 780 px); `manager` — `manager-orders-*-dialog` (ikonkali mijoz bloki,
 * ko'k «Sotish», bitta ustun 560 px, sarlavha «Buyurtmani sotish»).
 */
export type OrderActionVariant = "courier" | "manager";

export type ActionOrderItem = {
  id: string;
  quantity: number;
  /**
   * Katalogdagi mahsulot. Ro'yxat javoblari har xil keladi: kuryer ro'yxatida
   * `product` obyekti bor, admin ro'yxatida faqat `product_id`, hamkor
   * (BeePost) posilkalarida esa ikkalasi ham `null` — nom `product_name` da.
   */
  product?: { name?: string | null; image_url?: string | null; id?: string | null } | null;
  product_id?: string | null;
  product_name?: string | null;
};

export type ActionOrder = {
  id: string;
  status?: string | null;
  total_price?: number | string | null;
  where_deliver?: string | null;
  market?: { name?: string | null; expense_proof_conditions?: string[] | null } | null;
  customer?: { name?: string | null; phone_number?: string | null } | null;
  district?: { name?: string | null } | null;
  /** Ro'yxat qatoridan keladi; oynada o'qilmaydi (qisman sotish `items` bo'yicha hisoblaydi). */
  region?: { name?: string | null } | null;
  created_at?: string | null;
  product_quantity?: number | null;
  items?: ActionOrderItem[] | null;
  sell_requires_media?: boolean;
  cancel_requires_media?: boolean;
  /** Marketga to'lanishi kerak bo'lgan summa — «Marketga to'langan summa» chegarasi uchun. */
  to_be_paid?: number | string | null;
  /** Hamkor (BeePost/API) buyurtmasi — marketga to'lov maydoni ko'rsatilmaydi. */
  external_id?: string | number | null;
};

export const MAX_PROOF_SIZE_MB = 10;
const MAX_PROOF_SIZE_BYTES = MAX_PROOF_SIZE_MB * 1024 * 1024;

/** Dalil fayli hajmi chegarasida-mi (backend 10 MB dan kattasini rad etadi). */
export const isProofFileTooLarge = (file: File) => file.size > MAX_PROOF_SIZE_BYTES;

/** Faqat raqamlar (pul maydoni qiymati) → son; bo'sh — 0. */
export const toAmount = (digits: string) => Number(digits) || 0;

/** Yetkazish turi yorlig'i kaliti (`orders` ns): «Uygacha» / «Markazgacha»; noma'lum — `null`. */
export const getDeliveryLabelKey = (whereDeliver: unknown): string | null => {
  const value = typeof whereDeliver === "string" ? whereDeliver.trim() : "";
  if (value === "address") return "deliveryToHome";
  if (value === "center") return "deliveryToCenter";
  return null;
};

/** Mijoz ismining bosh harflari (avatar): «Laylo Hasanova» → «LH». */
export const getInitials = (name?: string | null) =>
  (name ?? "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "—";

export type OrderActionKind = "sell" | "partly_sell" | "cancel" | "rollback";

const DONE_TITLE_KEYS: Record<OrderActionKind, string> = {
  sell: "orderSoldTitle",
  partly_sell: "orderPartlySoldTitle",
  cancel: "orderCancelledTitle",
  rollback: "orderRestoredTitle",
};

/**
 * Amal bajarildi — qisqa xabar (`tizim-feedback` 01: sarlavha — nima bo'ldi, izoh — qaysi
 * buyurtma). Market tasdig'iga tushgan amal bu yerga kelmaydi: u oynada «Market tasdig'i
 * kutilmoqda» bo'lib qoladi.
 */
export const notifyOrderActionDone = (
  kind: OrderActionKind,
  order: { id: string; customer?: { name?: string | null } | null } | null | undefined,
) => {
  if (!order) return;
  const name = order.customer?.name?.trim();
  notify.success(i18n.t(`orders:${DONE_TITLE_KEYS[kind]}`), {
    description: name
      ? i18n.t("orders:orderActionDoneDescription", { id: order.id, name })
      : i18n.t("orders:orderNumberShort", { id: order.id }),
  });
};
