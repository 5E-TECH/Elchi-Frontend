/**
 * KURYER BUYURTMALAR RO'YXATI — umumiy model (jadval, telefon kartasi va sahifa uchun).
 *
 * Ro'yxat `GET orders/courier/orders` dan keladi (backend «legacy» shakli, snake_case). Bekor
 * qilingan va pochtaga jo'natilgan buyurtma backendda `status: "cancelled"` +
 * `transport_status: "cancelled (sent)"` bo'lib keladi (`normalizeOrderStatusForDisplay`) —
 * ko'rinishda u «Bekor — jo'natilgan» (chegarali badge).
 */
import type { ServerPendingExtraCostApproval } from "../../../../../../entities/orders/extraCostApproval";

export const Order_status = {
  CREATED: "created",
  NEW: "new",
  RECEIVED: "received",
  ON_THE_ROAD: "on the road",
  WAITING: "waiting",
  SOLD: "sold",
  CANCELLED: "cancelled",
  PAID: "paid",
  PARTLY_PAID: "partly_paid",
  CANCELLED_SENT: "cancelled (sent)",
  CLOSED: "closed",
} as const;
export type Order_status = (typeof Order_status)[keyof typeof Order_status];

type OrderItem = { id: string; quantity: number; product: { name: string; image_url: string | null } };

export type Order = {
  id: string;
  /** Mijozga ko'rinadigan raqam («EL-100081», yorliqdagi) — ro'yxatda shu ko'rsatiladi (rwAy8Qyk). */
  order_number?: string | null;
  created_at: string;
  status: string;
  total_price: number;
  where_deliver: string;
  product_quantity: number;
  market: { name: string; expense_proof_conditions?: string[] | null };
  customer: { name: string; phone_number: string };
  district: { name: string; region?: { name?: string | null } | null };
  region: { name: string };
  items: OrderItem[];
  sell_requires_media?: boolean;
  cancel_requires_media?: boolean;
  transport_status?: string | null;
  holder_type?: string | null;
  parent_order_id?: string | null;
  qr_code_token?: string | null;
  /** Buyurtmaning joriy pochtasi — yo'ldagi buyurtmani qabul qilish (`PATCH post/receive/:post_id`). */
  post_id?: string | number | null;
  /** GykuOz8f: serverdagi kutilayotgan qo'shimcha xarajat so'rovi (`waiting` da) yoki `null`. */
  pending_extra_cost_approval?: ServerPendingExtraCostApproval | null;
  /** SPEC v2: oxirgi qo'shimcha xarajat so'rovi (xom; `readExtraCostRequest`) — «Xarajat kutilmoqda» belgisi. */
  extra_cost_request?: unknown;
  /** Hamkor (tashqi) buyurtma id'si — bor bo'lsa xarajat eski (replay) yo'ldan (`isExtraCostReplayOrder`). */
  external_id?: string | null;
};

/** Ro'yxat tablari (URL `status` paramiga bog'langan). */
export type CourierOrdersTab = "pending" | "all" | "cancelled";

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const toText = (value: unknown) => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return "";
};

/** `ON_THE_ROAD` / `on_the_road` / `canceled` → `on the road` / `cancelled`. */
export const normalizeOrderStatus = (value: unknown) =>
  toText(value).toLowerCase().replaceAll("_", " ").replace("canceled", "cancelled");

const getTransportStatus = (order: Order) => {
  const record = asRecord(order);
  return normalizeOrderStatus(record.transport_status ?? record.transportStatus);
};

/**
 * Ko'rinadigan holat: pochtaga jo'natilgan bekor buyurtma — `cancelled (sent)`, qolgani — xom holat.
 * `partly_paid` pastki chiziq bilan qoladi (registr kaliti shunday).
 */
export const getDisplayStatus = (order: Order): string => {
  if (getTransportStatus(order) === Order_status.CANCELLED_SENT) return Order_status.CANCELLED_SENT;
  return order.status;
};

/** Sotish + Bekor qilish tugmalari ko'rinadigan holatlar. */
const ACTIVE_STATUSES = new Set<string>(["waiting", "on the road", "new", "received"]);
/**
 * Skan-qabul qilinadigan holatlar (2026-11-07, backend `PATCH post/receive/:id` `scan: true` bilan bir) — yo'lda yoki
 * mijoz kutilmoqda. Bunday qatorda «Sotish / Bekor» o'rniga «Qabul qilish» (avval qabul, keyin sotish).
 */
const RECEIVABLE_STATUSES = new Set<string>(["on the road", "waiting customer"]);
/** «Qayta tiklash» ko'rinadigan holatlar — faqat sotilgan va bekor qilingan. */
const ROLLBACK_STATUSES = new Set<string>(["sold", "cancelled"]);

export const isActiveOrder = (order: Order) => ACTIVE_STATUSES.has(normalizeOrderStatus(order.status));

/** Buyurtmaning joriy pochtasi (`post_id`; `'0'` va bo'sh — yo'q). */
export const getOrderPostId = (order: Order): string | null => {
  const record = asRecord(order);
  const id = toText(record.post_id ?? record.postId);
  return id && id !== "0" ? id : null;
};

/**
 * «Qabul qilish» ko'rinadigan qator: kuryerning o'z ro'yxatida (pochtalari) yo'lda yoki mijoz kutilmoqda va pochtasi
 * ma'lum (pochtasiz qabul so'rovi yuborib bo'lmaydi — u holda avvalgidek «Sotish / Bekor»).
 */
export const isReceivableOrder = (order: Order) =>
  RECEIVABLE_STATUSES.has(normalizeOrderStatus(order.status)) && Boolean(getOrderPostId(order));

/**
 * Qayta tiklash mumkinmi: sotilgan yoki bekor qilingan, pochtaga jo'natilmagan. Bekor qilingan
 * buyurtmada qo'shimcha shart (posilka hali shu kuryerda) — sahifadagi `canRestore` (fix3b LC-05).
 */
export const isRollbackCandidate = (order: Order) =>
  ROLLBACK_STATUSES.has(normalizeOrderStatus(order.status)) &&
  getTransportStatus(order) !== Order_status.CANCELLED_SENT;

/**
 * «Bekor qilingan» tabida turadigan buyurtma: bekor qilingan, pochtaga hali jo'natilmagan,
 * filial/HQ qabul qilmagan va qisman sotishdan ajralgan bola buyurtma emas.
 */
export const isUnsentCancelledOrder = (order: Order) => {
  const record = asRecord(order);
  const holderType = toText(record.holder_type ?? record.holderType).toUpperCase();
  const parentOrderId = toText(record.parent_order_id ?? record.parentOrderId);
  if (holderType === "BRANCH" || holderType === "HQ") return false;
  return (
    normalizeOrderStatus(order.status) === Order_status.CANCELLED &&
    getTransportStatus(order) !== Order_status.CANCELLED_SENT &&
    !parentOrderId
  );
};

/** Pochtaga yuborish uchun tanlanadigan buyurtma (skaner ham faqat shularni tanlaydi). */
export const isSelectableCancelledOrder = (order: Order) => isUnsentCancelledOrder(order);

/** Viloyat nomi: buyurtmaning o'zida yoki tuman ichida. */
export const getRegionName = (order: Order) =>
  toText(asRecord(order.region).name) || toText(asRecord(asRecord(order.district).region).name);

/** Saralash (sahifa ichida — backend kuryer ro'yxatini saralamaydi, sukut yangilari tepada). */
export type CourierOrdersSortKey = "createdAt" | "total_price";

const timeOf = (value: unknown) => {
  const time = new Date(String(value ?? "")).getTime();
  return Number.isFinite(time) ? time : 0;
};

export const sortCourierOrders = (
  orders: readonly Order[],
  sort: { key: string; direction: "asc" | "desc" } | null,
): Order[] => {
  if (!sort) return [...orders];
  const sign = sort.direction === "asc" ? 1 : -1;
  const valueOf = (order: Order) =>
    sort.key === "total_price" ? Number(order.total_price) || 0 : timeOf(order.created_at);
  return [...orders].sort((a, b) => (valueOf(a) - valueOf(b)) * sign);
};
