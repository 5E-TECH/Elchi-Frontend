import { isInPostNow } from "../../../../entities/mails/lib/postHistory";

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const toId = (value: unknown) =>
  typeof value === "string" || typeof value === "number" ? String(value).trim() : "";

/**
 * PATCH /post/receive/:id javobidagi qabul qilinmagan buyurtmalar (fix3b LC-11).
 *
 * Backend `data` shaklini o'zgartirmagan (qabul qilingan buyurtmalar
 * ro'yxati), yuqori darajada esa `not_received_order_ids: string[]` va
 * `failures: [{ order_id, error }]` qaytaradi. `not_received_order_ids` —
 * tanlangan, lekin WAITING ga o'tmay hamon yo'lda qolgan buyurtmalar: ular
 * "qabul qilindi" deb yashirilmasligi kerak. (`failures` ga tanlanmagan
 * qatorlarning yon yangilanishlari ham kiradi — u bu yerda ishlatilmaydi.)
 */
export const extractNotReceivedOrderIds = (response: unknown): string[] => {
  const body = asRecord(response);
  const raw = body.not_received_order_ids ?? asRecord(body.data).not_received_order_ids;
  if (!Array.isArray(raw)) return [];

  return [...new Set(raw.map(toId).filter(Boolean))];
};

/**
 * "Eski" (qabul qilingan) pochtada hamon yo'lda (ON_THE_ROAD) buyurtma bormi
 * (fix3b LC-11). Eski yozuvlarda pochta RECEIVED bo'lib qolgan, ichida esa
 * qabul qilinmagan posilka bor — u holda qabul qilish qayta ochiladi.
 * Faqat HOZIR pochtadagi qatorlar sanaladi (#618: `view=all` da sobiq a'zo
 * `in_post_now: false` — u boshqa pochtada yo'lda bo'lsa ham bu pochtaniki emas).
 */
export const hasOnTheRoadOrders = (
  orders: ReadonlyArray<{ status?: string | null; in_post_now?: boolean | null }>,
) => orders.some((order) => order.status === "on the road" && isInPostNow(order));

/**
 * Skan-qabulda qabul qilinadigan buyurtma holati (backend bilan bir xil): yo'lda yoki mijoz kutilmoqda
 * (`waiting_customer`, eski yozuvda `waiting customer`). `waiting` — allaqachon qabul qilingan.
 */
const SCAN_RECEIVABLE_STATUSES = new Set(["on the road", "on_the_road", "waiting_customer", "waiting customer"]);

export const isScanReceivableStatus = (status: unknown): boolean =>
  SCAN_RECEIVABLE_STATUSES.has(String(status ?? "").trim().toLowerCase());

const toIdList = (value: unknown): string[] => (Array.isArray(value) ? value.map(toId).filter(Boolean) : []);

/** Bitta skanerlangan buyurtma bo'yicha `PATCH post/receive/:id` (`scan: true`) natijasi. */
export interface ScanReceiveOutcome {
  /** Buyurtma «kutilmoqda»da: shu so'rovda qabul qilindi yoki avval qabul qilingan edi. */
  ok: boolean;
  /** So'rovdan oldin allaqachon qabul qilingan (`already_received_order_ids`) — xato emas. */
  alreadyReceived: boolean;
  /** Pochtaning yangi holati (`sent` | `received` …), kichik harfda; berilmasa `null`. */
  postStatus: string | null;
  /** Qabul qilinmagan bo'lsa — backend sababi (`failures[].error` yoki `message`). */
  error: string | null;
}

/**
 * Skan-qabul javobini o'qiydi (2026-11-07). Yangi backend: `received_order_ids`, `already_received_order_ids`,
 * `not_received_order_ids`, `failures`, `post_status`. Eski backend (faqat `not_received_order_ids`) — id u yerda
 * bo'lmasa qabul qilingan deb olinadi (fix3b LC-11 qoidasi).
 */
export const readScanReceiveOutcome = (response: unknown, orderId: string): ScanReceiveOutcome => {
  const body = asRecord(response);
  const id = toId(orderId);
  const received = toIdList(body.received_order_ids);
  const alreadyReceived = toIdList(body.already_received_order_ids).includes(id);
  const notReceived = extractNotReceivedOrderIds(response).includes(id);
  const ok = received.includes(id) || alreadyReceived || !notReceived;
  const failure = Array.isArray(body.failures)
    ? body.failures.map(asRecord).find((item) => toId(item.order_id) === id)
    : undefined;
  const failureText = typeof failure?.error === "string" && failure.error.trim() ? failure.error.trim() : null;
  const messageText = typeof body.message === "string" && body.message.trim() ? body.message.trim() : null;
  const postStatus = typeof body.post_status === "string" && body.post_status.trim() ? body.post_status.trim().toLowerCase() : null;

  return {
    ok,
    alreadyReceived,
    postStatus,
    error: ok ? null : (failureText ?? messageText),
  };
};
