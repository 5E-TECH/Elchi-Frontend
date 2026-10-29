import type { MailItem } from "../../../entities/mails";
import { scannerArrivalState, type ScanSource } from "../../../shared/lib/scanner";
import { readMailItems } from "../../mails/model/mailsLists";
import { extractCancelledMarkets } from "../../new_orders/cancelled/utils";

/**
 * UNIVERSAL SKANER — ro'yxatdan tanlanadigan rejimlar (Trello vNcGDnNh 2-band, «Qabul qilish» namunasida): kelinadigan
 * sahifalarning skan maqsadi id'lari, varaq qatorlari va sahifaga o'tish holati (sof funksiyalar).
 *
 * Kamera kelgan sahifada OCHIQ davom etadi: `navigate(path, { state: { ...sahifa holati, ...scannerArrivalState({
 * targetId }) } })` — `ScannerHost` aynan shu id'li maqsad ro'yxatdan o'tishini kutadi. Id'lar sahifalarning o'zi
 * ro'yxatdan o'tkazadigan bilan AYNAN bir xil bo'lishi shart (testlar tekshiradi):
 *   - pochta: `mail:<postId>:send` / `mail:<postId>:refused` (`pages/mails/detail` — `cameraMode`);
 *   - bekorlarni topshirish: `cancelled-handover:<marketId>` (`pages/new_orders/cancelled/detail`, ikkala bosqichda);
 *   - market yangi buyurtmalari: `new-orders:market:<marketId>` (`new_orderDetail`).
 */

/** Pochta rejimi: jo'natish (yangi pochta) yoki rad etilgan pochtani qabul qilish. */
export type ScanMailKind = "send" | "refused";

export const mailScanTargetId = (postId: string, kind: ScanMailKind) => `mail:${postId}:${kind}`;
export const cancelledHandoverTargetId = (marketId: string) => `cancelled-handover:${marketId}`;
export const newOrdersMarketTargetId = (marketId: string) => `new-orders:market:${marketId}`;

export const mailDetailPath = (postId: string) => `/mails/${encodeURIComponent(postId)}`;
export const cancelledHandoverPath = (marketId: string) => `/new-orders/cancelled/${encodeURIComponent(marketId)}`;

/** Varaqdagi pochta qatori (`GET post/new` / `GET post/rejected`). */
export type ScanMailRow = {
  id: string;
  /** Pochtaning viloyati — sahifa jo'natish manzili uchun zaxira (`fallbackRegionId`, fix3). */
  regionId: string;
  regionName: string | null;
  orders: number;
  /** Rad etilgan pochtada — qaytargan kuryer (backend beradi); yangi pochtada odatda yo'q. */
  courierName: string | null;
};

const toCount = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const toMailRow = (mail: MailItem): ScanMailRow => ({
  id: String(mail.id ?? "").trim(),
  regionId: String(mail.region?.id ?? mail.region_id ?? "").trim(),
  regionName: mail.region?.name?.trim() || null,
  orders: toCount(mail.order_quantity),
  courierName: mail.courier?.name?.trim() || null,
});

/** Pochtalar javobi → varaq qatorlari (id'siz yozuv tashlanadi). */
export const toScanMailRows = (payload: unknown): ScanMailRow[] =>
  readMailItems(payload)
    .map(toMailRow)
    .filter((row) => row.id);

/** Bekorlari bor marketlar (`GET orders/markets/cancelled`) — «Bekor qilinganlar» ro'yxati bilan bir xil o'qish. */
export const toScanCancelledMarketRows = (payload: unknown) => extractCancelledMarkets(payload);

/**
 * `/mails/:id` ga o'tish holati — pochta ro'yxatidagi havola bilan bir xil (`todaysMails` / `refusedMails`:
 * `fromTab`, rad etilganda `type: "refused"`, viloyat zaxirasi, kutilgan son) + «kelganda kamerani och» bayrog'i.
 */
export const mailArrivalState = (
  mail: Pick<ScanMailRow, "id"> & Partial<Pick<ScanMailRow, "regionId" | "regionName" | "orders">>,
  kind: ScanMailKind,
  pendingScan?: { raw: string; source: ScanSource },
) => ({
  fromTab: kind === "refused" ? "refused" : "today",
  ...(kind === "refused" ? { type: "refused" } : {}),
  ...(mail.regionId ? { fallbackRegionId: mail.regionId } : {}),
  ...(mail.regionName ? { fallbackRegionName: mail.regionName } : {}),
  ...(mail.orders ? { expectedOrderCount: mail.orders } : {}),
  ...scannerArrivalState({ targetId: mailScanTargetId(mail.id, kind), pendingScan }),
});

/** `/new-orders/cancelled/:marketId` ga o'tish holati (sahifaning o'z holati yo'q — faqat kamera bayrog'i). */
export const cancelledHandoverArrivalState = (marketId: string) =>
  scannerArrivalState({ targetId: cancelledHandoverTargetId(marketId) });

/* ─── Skanerlangan pochta QR'i (`POST-…` / `PST-…`) ─────────────────────────── */

type AnyRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is AnyRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const textOf = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
};

/** `GET post/scan/:token` — pochta qatorining o'zi (`{ statusCode, data: { id, status, region_id, … } }`). */
export type ScannedMail = {
  id: string;
  /** `new` · `sent` · `received` · `canceled` · `canceled_received` (backend `Post_status`); kelmasa `null`. */
  status: string | null;
  regionId: string;
  regionName: string | null;
  orders: number;
};

export const readScannedMail = (response: unknown): ScannedMail | null => {
  let current: unknown = response;
  for (let depth = 0; depth < 3 && isRecord(current) && isRecord(current.data); depth += 1) current = current.data;
  if (!isRecord(current)) return null;
  const id = textOf(current.id ?? current.post_id);
  if (!id) return null;
  const region = isRecord(current.region) ? current.region : null;
  return {
    id,
    status: textOf(current.status).toLowerCase() || null,
    regionId: textOf(current.region_id ?? region?.id),
    regionName: textOf(region?.name) || null,
    orders: toCount(current.order_quantity ?? current.orders_count),
  };
};

/**
 * Pochta holati rejimga mosmi: jo'natish — faqat yangi (`new`) pochta, rad etilganni qabul — `canceled`
 * (`GET post/rejected` ham shu holatni qaytaradi). Holat kelmasa — sahifaning o'zi hal qiladi (o'tiladi).
 */
export const isMailReadyFor = (kind: ScanMailKind, status: string | null) => {
  if (!status) return true;
  return kind === "send" ? status === "new" : status === "canceled" || status === "cancelled";
};
