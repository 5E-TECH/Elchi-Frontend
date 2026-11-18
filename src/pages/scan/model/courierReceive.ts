import type { ReceivePostResponse } from "../../../entities/mails";
import { getCourierTakeState } from "./scanOrderView";

/**
 * SKAN-QABUL qoidalari (sof, testlanadi).
 *
 * COURIER-SCAN (ega, 2026-11-17): KURYER SKANI = QABUL. Kuryer «O'zimga olish» bilan olgan buyurtma darhol
 * «Kutilmoqda» (backend `scan-assign` WAITING yozadi) — kuryerdan alohida «Qabul qilish» qadami yo'q (2026-11-07 dagi
 * kuryer skan-qabuli olib tashlandi). Kuryerning o'zidagi buyurtma (kutilmoqda, yo'lda yoki mijoz kutilmoqda) — darhol
 * «Sotish» / «Bekor qilish»: yo'ldagini backend sotish/bekordan oldin o'zi qabul qiladi (2026-11-12).
 *
 * Menejerning «Pochtadan qabul»i (`PATCH post/receive/:post_id { order_ids: [id], scan: true }`) — qoladi
 * (`getBranchReceiveDecision`).
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
  branch_id?: unknown;
  branchId?: unknown;
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
export const isScanReceivableStatus = (status: unknown) => RECEIVABLE_STATUSES.has(normalizeReceiveStatus(status));

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

/** Kuryerning o'zidagi buyurtmada «Sotish» / «Bekor qilish» ochiq holatlar (COURIER-SCAN: skan = qabul). */
const COURIER_SELLABLE_STATUSES = new Set(["waiting", "on the road", "waiting customer"]);

/**
 * Kuryer skan natijasidagi asosiy amal (`/scan/:token`):
 *   - `sell` — o'ziniki va kutilmoqda / yo'lda / mijoz kutilmoqda → «Sotish» + «Bekor qilish» (alohida qabul yo'q);
 *   - `take` — qolgan hammasi: «O'zimga olish» (bo'sh buyurtma faol, boshqa kuryerniki `getCourierTakeState` bo'yicha
 *     faol emas).
 */
export type CourierScanAction = "take" | "sell";

export const getCourierScanAction = (
  order: OrderLike,
  currentUserId: string | number | null | undefined,
): CourierScanAction => {
  if (getCourierTakeState(order, currentUserId) === "other") return "take";
  if (!isOwnCourierOrder(order, currentUserId)) return "take";
  return COURIER_SELLABLE_STATUSES.has(normalizeReceiveStatus(order?.status)) ? "sell" : "take";
};

/** Sotuvdan / bekordan keyingi holatlar — bunday buyurtmani qabul qilib bo'lmaydi. */
const FINAL_STATUSES: ReadonlySet<string> = new Set([
  "sold",
  "partly paid",
  "paid",
  "cancelled",
  "cancelled (sent)",
  "returned to market",
  "closed",
]);

/**
 * MENEJER SKAN-QABULI (2026-11-07, Dilshod: «scanerni faqat kuryerda emas, menejerda ham») — `/scan` «Pochtadan
 * qabul» rejimi (REGIONAL / HYBRID filial menejeri). HQ → filial o'tkazma pochtasidagi (kuryersiz) yo'ldagi buyurtma
 * skanerlansa — `PATCH post/receive/:post_id { order_ids: [id], scan: true }`, faqat shu buyurtma «kutilmoqda»ga
 * o'tadi (backend anKpzwxk: o'tkazma pochtasini faqat manzil filial menejeri qabul qiladi). Qaror (shu tartibda):
 *   - `notReceivable` — sotuvdan / bekordan keyingi holat (kuryer id'si qolgan bo'lsa ham — «yo'lda emas»);
 *   - `other` — buyurtma kuryerda (`courier_id` / `holder_courier_id`; COURIER-SCAN: kuryer uni skan bilan olgan —
 *     skan = qabul, sotish / bekor kuryerda); boshqa holatda — `notReceivable`;
 *   - `notReceivable` — yo'lda, lekin pochtasi yo'q (masalan filiallararo paketdagi posilka — pochta emas);
 *   - `notOurs` — buyurtma boshqa filialniki (`branch_id` ma'lum va menejer filiali emas);
 *   - `receive` — yo'lda yoki mijoz kutilmoqda va pochtasi bor → darhol qabul;
 *   - `open` — «kutilmoqda» (qabul qilingan) → natija sahifasi (sotish / bekor);
 *   - `notReceivable` — qolgan holatlar (yangi, qabul qilingan …).
 * Menejer filiali noma'lum (profil hali kelmagan) — filial tekshirilmaydi, backend hal qiladi (begona filial — 403).
 */
export type BranchReceiveDecision = "receive" | "open" | "other" | "notOurs" | "notReceivable";

export const getBranchReceiveDecision = (
  order: OrderLike,
  branchId: string | number | null | undefined,
): BranchReceiveDecision => {
  const status = normalizeReceiveStatus(order?.status);
  if (FINAL_STATUSES.has(status)) return "notReceivable";
  const receivable = RECEIVABLE_STATUSES.has(status);
  const courierIds = [
    idText(order?.courier_id ?? order?.courierId),
    idText(order?.holder_courier_id ?? order?.holderCourierId),
  ].filter(Boolean);
  if (courierIds.length > 0) return receivable || status === "waiting" ? "other" : "notReceivable";
  if (receivable && !readOrderPostId(order)) return "notReceivable";
  const mine = idText(branchId);
  const orderBranch = idText(order?.branch_id ?? order?.branchId);
  if (mine && orderBranch && orderBranch !== mine) return "notOurs";
  if (receivable) return "receive";
  if (status === "waiting") return "open";
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
