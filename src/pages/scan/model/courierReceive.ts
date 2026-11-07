import type { ReceivePostResponse } from "../../../entities/mails";
import { getCourierTakeState } from "./scanOrderView";

/**
 * KURYER SKAN-QABULI (2026-11-07, BeePost `/scan` kuryer qabul sikli) — sof qoidalar (testlanadi).
 *
 * Kuryer «O'zimga olish» bilan olgan buyurtma uning pochtasida YO'LDA turadi (`on_the_road`); sotish / bekor
 * qilishdan oldin uni qabul qilishi kerak: `PATCH post/receive/:post_id { order_ids: [id], scan: true }` — faqat shu
 * buyurtma «kutilmoqda»ga o'tadi, pochtadagi qolgan yo'ldagilarga tegilmaydi. Qoidalar backend skan yo'li bilan bir:
 *   - qabul qilinadi — yo'lda (`on_the_road`) yoki mijoz kutilmoqda (`waiting_customer`);
 *   - `waiting` — allaqachon qabul qilingan (sotish / bekor sahifasi);
 *   - boshqa holat (sotilgan, bekor, yopilgan …) — qabul qilib bo'lmaydi.
 * Kim: `courier_id` yoki `holder_courier_id` shu kuryer (`'0'` — tayinlanmagan pochta sentineli, kuryer emas).
 */

type OrderLike = {
  status?: unknown;
  courier_id?: unknown;
  courierId?: unknown;
  holder_courier_id?: unknown;
  holderCourierId?: unknown;
  post_id?: unknown;
  postId?: unknown;
} | null | undefined;

const idText = (value: unknown) => {
  const id = typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
  return id === "0" ? "" : id;
};

/** `ON_THE_ROAD` / `on_the_road` / `waiting_customer` → `on the road` / `waiting customer`. */
export const normalizeReceiveStatus = (value: unknown) =>
  (typeof value === "string" ? value : "").trim().toLowerCase().replaceAll("_", " ");

const RECEIVABLE_STATUSES = new Set(["on the road", "waiting customer"]);

/** Skan bilan qabul qilinadigan holat (yo'lda yoki mijoz kutilmoqda). */
export const isCourierReceivableStatus = (status: unknown) => RECEIVABLE_STATUSES.has(normalizeReceiveStatus(status));

/** Buyurtmaning joriy pochtasi (`post_id`); yo'q — `null`. */
export const readOrderPostId = (order: OrderLike): string | null => idText(order?.post_id ?? order?.postId) || null;

/**
 * Buyurtma shu kuryerdami: `courier_id` yoki `holder_courier_id` = men, va ularning hech biri boshqa kuryer emas
 * (backend `scanAssignOrder` ham ikkalasini tekshiradi).
 */
export const isOwnCourierOrder = (order: OrderLike, currentUserId: string | number | null | undefined) => {
  const me = idText(currentUserId);
  if (!me) return false;
  const ids = [idText(order?.courier_id ?? order?.courierId), idText(order?.holder_courier_id ?? order?.holderCourierId)].filter(
    Boolean,
  );
  return ids.length > 0 && ids.every((id) => id === me);
};

/**
 * Kuryer skan natijasidagi asosiy amal (`/scan/:token`):
 *   - `receive` — o'ziniki, yo'lda (yoki mijoz kutilmoqda) va pochtasi bor → «Qabul qilish»;
 *   - `sell` — o'ziniki va «kutilmoqda» (qabul qilingan) → «Sotish» + «Bekor qilish»;
 *   - `take` — qolgan hammasi: «O'zimga olish» (avvalgidek — bo'sh buyurtma faol, o'ziniki yoki boshqa kuryerniki
 *     `getCourierTakeState` bo'yicha faol emas).
 */
export type CourierScanAction = "take" | "receive" | "sell";

export const getCourierScanAction = (
  order: OrderLike,
  currentUserId: string | number | null | undefined,
): CourierScanAction => {
  if (getCourierTakeState(order, currentUserId) === "other") return "take";
  if (!isOwnCourierOrder(order, currentUserId)) return "take";
  const status = normalizeReceiveStatus(order?.status);
  if (RECEIVABLE_STATUSES.has(status) && readOrderPostId(order)) return "receive";
  if (status === "waiting") return "sell";
  return "take";
};

/**
 * `/scan` «Qabul qilish» rejimida skanerlangan buyurtma nima bo'ladi:
 *   - `receive` — o'ziniki, qabul qilinadigan holatda, pochtasi bor → darhol qabul;
 *   - `open` — o'ziniki va allaqachon qabul qilingan (`waiting`) → natija sahifasi (sotish / bekor);
 *   - `free` — hech kimda emas (yoki faqat boshqa holatda) → «O'zimga olish» rejimida olinadi;
 *   - `other` — boshqa kuryerda;
 *   - `notReceivable` — o'ziniki, lekin yo'lda emas (sotilgan, bekor …) yoki pochtasi yo'q.
 */
/** Sotuvdan / bekordan keyingi holatlar — bunday buyurtmani na qabul, na «O'zimga olish» qilib bo'ladi. */
const FINAL_STATUSES: ReadonlySet<string> = new Set([
  "sold",
  "partly paid",
  "paid",
  "cancelled",
  "cancelled (sent)",
  "returned to market",
  "closed",
]);

export type CourierReceiveDecision = "receive" | "open" | "free" | "other" | "notReceivable";

export const getCourierReceiveDecision = (
  order: OrderLike,
  currentUserId: string | number | null | undefined,
): CourierReceiveDecision => {
  const me = idText(currentUserId);
  const ids = [idText(order?.courier_id ?? order?.courierId), idText(order?.holder_courier_id ?? order?.holderCourierId)].filter(
    Boolean,
  );
  const status = normalizeReceiveStatus(order?.status);
  // Hech kimda emas: sotilgan / bekor / yopilgan buyurtmani «O'zimga olish» ham ololmaydi — sababi aytiladi.
  if (ids.length === 0) return FINAL_STATUSES.has(status) ? "notReceivable" : "free";
  if (!me || ids.some((id) => id !== me)) return "other";
  if (RECEIVABLE_STATUSES.has(status)) return readOrderPostId(order) ? "receive" : "notReceivable";
  if (status === "waiting") return "open";
  if (status === "new" || status === "created" || status === "received") return "free";
  return "notReceivable";
};

const toIdList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.map((item) => (typeof item === "string" || typeof item === "number" ? String(item).trim() : "")).filter(Boolean)
    : [];

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/** Bitta buyurtmaning skan-qabul natijasi. */
export type ScanReceiveResult = {
  /** Buyurtma «kutilmoqda»da: shu so'rovda qabul qilindi yoki avval qabul qilingan edi. */
  ok: boolean;
  /** So'rovdan oldin allaqachon qabul qilingan (`already_received_order_ids`) — xato emas. */
  already: boolean;
  /** Qabul qilinmagan bo'lsa — backend sababi (`failures[].error`), bo'lmasa `null`. */
  error: string | null;
};

/**
 * `PATCH post/receive/:id` (`scan: true`) javobi → shu buyurtma natijasi. Yangi backend `received_order_ids` /
 * `already_received_order_ids` qaytaradi; eski shaklda (faqat `not_received_order_ids`) id u yerda bo'lmasa —
 * qabul qilingan (fix3b LC-11 qoidasi).
 */
export const readScanReceiveResult = (response: ReceivePostResponse | unknown, orderId: string): ScanReceiveResult => {
  const body = asRecord(response);
  const id = String(orderId).trim();
  const already = toIdList(body.already_received_order_ids).includes(id);
  const received = toIdList(body.received_order_ids).includes(id);
  const notReceived = toIdList(body.not_received_order_ids ?? asRecord(body.data).not_received_order_ids).includes(id);
  const ok = received || already || !notReceived;
  if (ok) return { ok, already, error: null };
  const failure = Array.isArray(body.failures)
    ? body.failures.map(asRecord).find((item) => String(item.order_id ?? "").trim() === id)
    : undefined;
  const error = typeof failure?.error === "string" && failure.error.trim() ? failure.error.trim() : null;
  return { ok, already, error };
};
