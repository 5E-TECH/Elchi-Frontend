import type { Batch, BatchStatus } from "../../../entities/batch";
import { getPostStatusBadge } from "../detail/lib/postStatus";

/**
 * «ESKI POCHTALAR» (`/mails/old`) — sof yordamchilar (dizayn v2): URL filtrlari, holat turi, mijoz tomonidagi
 * filtr va paket → qator moslashtirgichi. UI — `components/oldMails.tsx`, telefon varaqasi —
 * `components/OldMailsFiltersSheet.tsx`.
 *
 * Ma'lumot yetishmovchiligi (spec §7): `GET /post` faqat `page, limit, status, branch_id` ni oladi va `limit` ni
 * 100 bilan cheklaydi; kuryerning `post/courier/old-posts` parametr olmaydi. Shuning uchun viloyat, kuryer, holat
 * va sana filtri — kelgan ro'yxat ustida mijoz tomonida (v1 dagidek), sahifalash ham.
 */

/* ─── URL ─────────────────────────────────────────────────────────────────── */

/** URL parametrlari (v1 bilan bir xil — eski havolalar ishlayveradi). */
export const OLD_MAILS_FILTER_KEYS = {
  regionId: "region_id",
  courierId: "courier_id",
  status: "status",
  dateFrom: "startDate",
  dateTo: "endDate",
} as const;

/** «Hamma batchlar» rejimi (faqat admin va superadmin): `?batch_mode=all`. */
export const OLD_MAILS_BATCH_MODE_KEY = "batch_mode";
export const OLD_MAILS_BATCH_MODE_ALL = "all";

export type OldMailsFilters = {
  regionId: string;
  courierId: string;
  status: string;
  dateFrom: string;
  dateTo: string;
};

export const EMPTY_OLD_MAILS_FILTERS: OldMailsFilters = {
  regionId: "",
  courierId: "",
  status: "",
  dateFrom: "",
  dateTo: "",
};

export const readOldMailsFilters = (params: URLSearchParams): OldMailsFilters => ({
  regionId: params.get(OLD_MAILS_FILTER_KEYS.regionId) ?? "",
  courierId: params.get(OLD_MAILS_FILTER_KEYS.courierId) ?? "",
  status: params.get(OLD_MAILS_FILTER_KEYS.status) ?? "",
  dateFrom: params.get(OLD_MAILS_FILTER_KEYS.dateFrom) ?? "",
  dateTo: params.get(OLD_MAILS_FILTER_KEYS.dateTo) ?? "",
});

/**
 * Filtrlarni URL'ga yozadi: bo'sh qiymat — kalit o'chadi; har o'zgarishda `page=1` (v1 `updateFilter`).
 * Boshqa parametrlar (`batch_mode`, `limit`) saqlanadi.
 */
export const writeOldMailsFilters = (prev: URLSearchParams, patch: Partial<OldMailsFilters>): URLSearchParams => {
  const next = new URLSearchParams(prev);
  (Object.keys(patch) as Array<keyof OldMailsFilters>).forEach((key) => {
    const value = patch[key] ?? "";
    if (value) next.set(OLD_MAILS_FILTER_KEYS[key], value);
    else next.delete(OLD_MAILS_FILTER_KEYS[key]);
  });
  next.set("page", "1");
  return next;
};

/** «Filtrlarni tozalash» (v1 `resetFilters`): filtrlar va sahifa o'chadi, rejim va `limit` qoladi. */
export const clearOldMailsFilters = (prev: URLSearchParams): URLSearchParams => {
  const next = new URLSearchParams(prev);
  [...Object.values(OLD_MAILS_FILTER_KEYS), "page"].forEach((key) => next.delete(key));
  return next;
};

/**
 * Rejim almashinuvi «Pochtalar | Filial paketlari» (ega qarori D11): `batch_mode=all` yoziladi yoki o'chadi,
 * `status` tashlanadi (ikki rejimda holatlar to'plami boshqa), sahifa 1 ga qaytadi; qolgan filtrlar saqlanadi.
 */
export const writeOldMailsMode = (prev: URLSearchParams, batches: boolean): URLSearchParams => {
  const next = new URLSearchParams(prev);
  if (batches) next.set(OLD_MAILS_BATCH_MODE_KEY, OLD_MAILS_BATCH_MODE_ALL);
  else next.delete(OLD_MAILS_BATCH_MODE_KEY);
  next.delete(OLD_MAILS_FILTER_KEYS.status);
  next.delete("page");
  return next;
};

/* ─── Holat ───────────────────────────────────────────────────────────────── */

export type OldMailStatusKind = "received" | "cancelled" | "returned" | "sent";

const normalizeStatus = (status: string) => status.trim().toLowerCase().replaceAll("-", "_");

/** Pochta holati → tur (v1 `getStatusKind` so'zma-so'z: noma'lum holat — «qabul qilingan»). */
export const getOldMailStatusKind = (status: string): OldMailStatusKind => {
  const normalizedStatus = normalizeStatus(status).replaceAll(" ", "_");

  if (
    normalizedStatus === "canceled_received" ||
    normalizedStatus === "cancelled_received" ||
    normalizedStatus === "returned" ||
    normalizedStatus === "return"
  ) {
    return "returned";
  }

  if (
    normalizedStatus === "canceled" ||
    normalizedStatus === "cancelled" ||
    normalizedStatus === "cancelled_(sent)" ||
    normalizedStatus === "rejected"
  ) {
    return "cancelled";
  }

  if (
    normalizedStatus === "sent" ||
    normalizedStatus === "on_the_way" ||
    normalizedStatus === "on_the_road"
  ) {
    return "sent";
  }

  return "received";
};

/** Tur → `getPostStatusBadge` kaliti (ton va `mails:` yorlig'i maketlardagidek). */
const KIND_TO_POST_STATUS: Record<OldMailStatusKind, string> = {
  received: "received",
  sent: "sent",
  cancelled: "canceled",
  returned: "canceled_received",
};

/** Badge: qabul qilingan — success, jo'natilgan — warning, rad etilgan — danger, qaytarilgan — neutral. */
export const getOldMailStatusBadge = (status: string) => {
  const kind = getOldMailStatusKind(status);
  // Har tur uchun yozuv bor — `null` bo'lmaydi.
  const badge = getPostStatusBadge(KIND_TO_POST_STATUS[kind]) as NonNullable<ReturnType<typeof getPostStatusBadge>>;
  return { kind, tone: badge.tone, labelKey: badge.labelKey };
};

/** «Holati» filtri variantlari — pochtalar (URL qiymati v1 dagidek; yorliq `mails:` dan). */
export const OLD_MAIL_STATUS_FILTERS = [
  { value: "sent", labelKey: "statusSent" },
  { value: "received", labelKey: "statusReceived" },
  { value: "canceled", labelKey: "statusRejected" },
  { value: "canceled_received", labelKey: "statusReturned" },
] as const;

/** «Holati» filtri — paketlar rejimida paket holatlari (D11; yorliq `newOrders:batchStatus.*`). */
export const OLD_BATCH_STATUS_FILTERS: readonly BatchStatus[] = ["new", "on_the_way", "received", "cancelled"];

const isBatchStatus = (value: string): value is BatchStatus =>
  (OLD_BATCH_STATUS_FILTERS as readonly string[]).includes(value);

/**
 * Rejimga mos holat filtri: paketlar rejimida faqat paket holati, pochtalarda — v1 dagi har qanday qiymat
 * (`getOldMailStatusKind` orqali). Mos kelmasa — filtr yo'q (masalan qo'lda yozilgan URL).
 */
export const effectiveOldMailsStatus = (status: string, batches: boolean): string => {
  if (!status) return "";
  if (batches) return isBatchStatus(status) ? status : "";
  return status;
};

/* ─── Qatorlar va filtr ───────────────────────────────────────────────────── */

type Region = { id?: string | null; name?: string | null; sato_code?: string };

/** Pochta (`GET /post`, `post/courier/old-posts`) yoki unga moslashtirilgan paket. */
export type OldMailSource = {
  id: string;
  createdAt: string;
  updatedAt: string;
  post_total_price: number;
  order_quantity: number;
  region_id: string;
  region?: Region | null;
  status: string;
  courier_id?: string | null;
  courier?: { id?: string; name?: string; phone_number?: string } | null;
};

/** Paket → qator manbasi (v1 dagidek: viloyat — qabul qiluvchi filial viloyati yoki nomi). */
export const toOldMailSourceFromBatch = (batch: Batch): OldMailSource => ({
  id: batch.id,
  createdAt: batch.created_at,
  updatedAt: batch.created_at,
  post_total_price: batch.total_price,
  order_quantity: batch.orders_count,
  region_id: batch.to_branch.id,
  region: {
    id: batch.to_branch.id,
    name: batch.to_branch.region ?? batch.to_branch.name,
  },
  status: batch.status,
});

export const getOldMailDate = (mail: Pick<OldMailSource, "createdAt" | "updatedAt">) =>
  mail.createdAt || mail.updatedAt || "";

/** Sana oralig'i (kun bo'yicha, `YYYY-MM-DD` matn solishtiruvi — v1 dagidek). */
export const isOldMailInDateRange = (
  mail: Pick<OldMailSource, "createdAt" | "updatedAt">,
  dateFrom: string,
  dateTo: string,
) => {
  const value = getOldMailDate(mail).slice(0, 10);
  if (!value) return true;
  if (dateFrom && value < dateFrom) return false;
  if (dateTo && value > dateTo) return false;
  return true;
};

const hasOrders = (mail: OldMailSource) => Number(mail.order_quantity) > 0;

/**
 * Mijoz tomonidagi filtr (v1 dagidek): buyurtmasiz pochta ko'rinmaydi; viloyat; kuryer (faqat kuryeri bor
 * pochtada — paketga ta'sir qilmaydi); holat (pochtada — tur bo'yicha, paketda — aynan); sana oralig'i.
 */
export const filterOldMails = <T extends OldMailSource>(
  items: readonly T[],
  filters: OldMailsFilters,
  batches: boolean,
): T[] => {
  const status = effectiveOldMailsStatus(filters.status, batches);
  const statusKind = status && !batches ? getOldMailStatusKind(status) : null;
  return items.filter((mail) => {
    const statusMatched = !status
      ? true
      : batches
        ? mail.status === status
        : getOldMailStatusKind(mail.status) === statusKind;
    const regionMatched = filters.regionId ? String(mail.region?.id) === filters.regionId : true;
    const courierMatched =
      !batches && filters.courierId && "courier_id" in mail
        ? String(mail.courier_id) === filters.courierId
        : true;
    return (
      hasOrders(mail) &&
      regionMatched &&
      courierMatched &&
      statusMatched &&
      isOldMailInDateRange(mail, filters.dateFrom, filters.dateTo)
    );
  });
};

/** Faol filtrlar soni («Filtrlar N»): viloyat, kuryer (pochtalarda, xodimda), holat, sana (bitta). */
export const countOldMailsFilters = (
  filters: OldMailsFilters,
  options: { batches: boolean; withCourier: boolean; withDate?: boolean },
) =>
  [
    filters.regionId,
    options.withCourier && !options.batches ? filters.courierId : "",
    effectiveOldMailsStatus(filters.status, options.batches),
    options.withDate === false ? "" : filters.dateFrom || filters.dateTo,
  ].filter(Boolean).length;

/** Xulosa: «N ta pochta · N ta buyurtma · jami X» — filtrlangan ro'yxat bo'yicha (D6). */
export const summarizeOldMails = (items: readonly OldMailSource[]) =>
  items.reduce(
    (acc, mail) => ({
      count: acc.count + 1,
      orders: acc.orders + (Number(mail.order_quantity) || 0),
      amount: acc.amount + (Number(mail.post_total_price) || 0),
    }),
    { count: 0, orders: 0, amount: 0 },
  );

/** Pochta javobi (`GET post/orders/:id`) → buyurtmalar (chekni qayta chiqarish; v1 `getPostOrders`). */
export const readPostOrders = <T>(value: unknown): T[] => {
  const response = value as {
    data?: {
      allOrdersByPostId?: T[];
      orders?: T[];
      data?: T[];
    } | T[];
  };

  if (Array.isArray(value)) return value as T[];
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.allOrdersByPostId)) return response.data.allOrdersByPostId;
  if (Array.isArray(response?.data?.orders)) return response.data.orders;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  return [];
};
