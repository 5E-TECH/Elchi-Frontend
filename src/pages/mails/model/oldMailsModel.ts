import type { Batch, BatchStatus } from "../../../entities/batch";
import type { GetOldMailsParams } from "../../../entities/mails";
import { getPostStatusBadge } from "../detail/lib/postStatus";

/**
 * «ESKI POCHTALAR» (`/mails/old`) — sof yordamchilar (dizayn v2): URL filtrlari, holat turi, server so'rovi,
 * Excel uchun barcha sahifalarni yig'ish, paket rejimining mijoz tomonidagi filtri va paket → qator
 * moslashtirgichi. UI — `components/oldMails.tsx`, telefon varaqasi — `components/OldMailsFiltersSheet.tsx`.
 *
 * Pochtalar (F4, backend YfrqN70i): `GET /post` va kuryerning `GET post/courier/old-posts` viloyat, kuryer
 * (faqat `GET /post`), holat, sana (Toshkent kuni) va `has_orders` ni o'zi filtrlaydi va `total` bilan
 * sahifalaydi (`limit` ≤ 100) — filtr va sahifalash serverda, `buildOldMailsQuery`. Excel — barcha filtrlangan
 * qatorlar, 100 talab (`fetchAllOldMailPages`). Javobda buyurtma/summa yig'indisi yo'q.
 * Paketlar rejimi («Filial paketlari»): `GET transfer-batches` da viloyat va sana oralig'i yo'q — barcha
 * paketlar yuklanadi va filtr mijoz tomonida (`filterOldBatches`, `summarizeOldMails`).
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

/**
 * Kuryer «Holati» filtri: `post/courier/old-posts` faqat received / canceled / canceled_received ni oladi
 * (boshqasiga bo'sh sahifa; jo'natilgan pochta kuryerning eski ro'yxatida bo'lmaydi).
 */
export const OLD_MAIL_STATUS_FILTERS_COURIER = OLD_MAIL_STATUS_FILTERS.filter((option) => option.value !== "sent");

/** «Holati» filtri — paketlar rejimida paket holatlari (D11; yorliq `newOrders:batchStatus.*`). */
export const OLD_BATCH_STATUS_FILTERS: readonly BatchStatus[] = ["new", "on_the_way", "received", "cancelled"];

const isBatchStatus = (value: string): value is BatchStatus =>
  (OLD_BATCH_STATUS_FILTERS as readonly string[]).includes(value);

/**
 * Rejimga mos holat filtri: paketlar rejimida faqat paket holati, pochtalarda — v1 dagi har qanday qiymat
 * (`getOldMailStatusKind` orqali), kuryerda «jo'natilgan» turidan tashqari. Mos kelmasa — filtr yo'q
 * (masalan qo'lda yozilgan URL).
 */
export const effectiveOldMailsStatus = (
  status: string,
  batches: boolean,
  options: { courier?: boolean } = {},
): string => {
  if (!status) return "";
  if (batches) return isBatchStatus(status) ? status : "";
  if (options.courier && getOldMailStatusKind(status) === "sent") return "";
  return status;
};

/* ─── Server so'rovi (F4) ─────────────────────────────────────────────────── */

/** Backend bitta sahifada beradigan eng ko'p qator (`GET /post`, `post/courier/old-posts`, kA70Rban). */
export const OLD_MAILS_PAGE_MAX = 100;

/**
 * URL holati → backend pochta holati (`sent | received | canceled | canceled_received`). Eski havolalar
 * (`cancelled`, `rejected`, `returned`, `on the road` …) tur orqali ishlayveradi; bo'sh — filtr yo'q.
 */
export const toServerPostStatus = (status: string): string =>
  status ? KIND_TO_POST_STATUS[getOldMailStatusKind(status)] : "";

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** `YYYY-MM-DD` va haqiqiy kun (`2026-13-40` emas) — aks holda backend 400 qaytaradi. */
const isValidDay = (value: string) => {
  if (!DAY_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const toPositiveInt = (value: number, fallback: number) => {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : fallback;
};

/**
 * Ro'yxat so'rovi (`useGetOldMails` / `fetchOldMails` parametrlari): sahifa, `limit` ≤ 100, doim
 * `has_orders: true` (v1 dagidek buyurtmasiz pochta ko'rinmaydi), bo'sh bo'lmagan filtrlar. Kuryerda
 * `courier_id` yo'q (backend — JWT egasi) va «jo'natilgan» holati tashlanadi. Sana noto'g'ri bo'lsa tashlanadi,
 * teskari oraliq almashtiriladi (backend `startDate > endDate` ga 400 beradi).
 */
export const buildOldMailsQuery = ({
  filters,
  page,
  limit,
  isCourier,
}: {
  filters: OldMailsFilters;
  page: number;
  limit: number;
  isCourier: boolean;
}): GetOldMailsParams => {
  const query: GetOldMailsParams = {
    page: toPositiveInt(page, 1),
    limit: Math.min(OLD_MAILS_PAGE_MAX, toPositiveInt(limit, 8)),
    has_orders: true,
  };
  if (filters.regionId) query.region_id = filters.regionId;
  if (!isCourier && filters.courierId) query.courier_id = filters.courierId;

  const status = toServerPostStatus(effectiveOldMailsStatus(filters.status, false, { courier: isCourier }));
  if (status) query.status = status;

  let startDate = isValidDay(filters.dateFrom) ? filters.dateFrom : "";
  let endDate = isValidDay(filters.dateTo) ? filters.dateTo : "";
  if (startDate && endDate && startDate > endDate) [startDate, endDate] = [endDate, startDate];
  if (startDate) query.startDate = startDate;
  if (endDate) query.endDate = endDate;
  return query;
};

/** Pochta ro'yxati javobi (`{ statusCode, data: { data, total, page, totalPages, limit, … } }`). */
type OldMailsPageResponse<T> = {
  statusCode?: number;
  message?: string;
  data?: { data?: T[]; total?: number; page?: number; totalPages?: number; limit?: number } | null;
} | null | undefined;

/** Bitta server sahifasi: qatorlar, filtrlangan jami (`total`), sahifalar soni va haqiqiy `limit`. */
export const readOldMailsPage = <T = OldMailSource>(response: OldMailsPageResponse<T>) => {
  const body = response?.data;
  const rows = Array.isArray(body?.data) ? body.data : [];
  const total = Math.max(0, Number(body?.total ?? rows.length) || 0);
  const limit = Math.max(0, Number(body?.limit ?? rows.length) || 0);
  const totalPages = Math.max(1, Number(body?.totalPages) || (limit > 0 ? Math.ceil(total / limit) : 1));
  return { rows, total, totalPages, limit };
};

/**
 * Excel uchun BARCHA filtrlangan qatorlar: `page = 1..totalPages` ketma-ket (javoblardagi eng katta `totalPages`
 * bo'yicha), har biri `pageSize` (100) dan, filtrlar bir xil. Bo'sh sahifada to'xtaydi; `maxPages` dan oshsa
 * `capped: true`. Yig'ish paytida yangi pochta qo'shilib sahifalar surilsa — takror `id` tashlanadi. Birinchi
 * xatoda rad etadi (yarim fayl berilmaydi).
 */
export const fetchAllOldMailPages = async <T extends { id: string | number }>(
  fetchPage: (params: GetOldMailsParams) => Promise<OldMailsPageResponse<T>>,
  query: GetOldMailsParams,
  { pageSize = OLD_MAILS_PAGE_MAX, maxPages = 200 }: { pageSize?: number; maxPages?: number } = {},
): Promise<{ rows: T[]; capped: boolean }> => {
  const rows: T[] = [];
  const seen = new Set<string>();
  let totalPages = 1;
  let page = 1;

  for (; page <= totalPages && page <= maxPages; page += 1) {
    const response = await fetchPage({ ...query, page, limit: pageSize });
    const current = readOldMailsPage<T>(response);
    // Yig'ish paytida yangi pochta qo'shilsa `total` o'sadi — oxirgi qator keyingi sahifaga suriladi, uni ham olamiz.
    totalPages = Math.max(totalPages, current.totalPages);
    if (current.rows.length === 0) return { rows, capped: false };
    current.rows.forEach((row) => {
      const key = String(row.id);
      if (seen.has(key)) return;
      seen.add(key);
      rows.push(row);
    });
  }

  return { rows, capped: page <= totalPages };
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
 * Mijoz tomonidagi filtr — faqat «Filial paketlari» rejimi (pochtalarni server filtrlaydi, `buildOldMailsQuery`):
 * buyurtmasiz paket ko'rinmaydi; viloyat; holat (paket holati, aynan); sana oralig'i. Kuryer filtri paketga
 * ta'sir qilmaydi.
 */
export const filterOldBatches = <T extends OldMailSource>(items: readonly T[], filters: OldMailsFilters): T[] => {
  const status = effectiveOldMailsStatus(filters.status, true);
  return items.filter((mail) => {
    const statusMatched = !status || mail.status === status;
    const regionMatched = filters.regionId ? String(mail.region?.id) === filters.regionId : true;
    return (
      hasOrders(mail) &&
      regionMatched &&
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

/** Xulosa: «N ta paket · N ta buyurtma · jami X» — paketlar rejimida, filtrlangan ro'yxat bo'yicha (D6). */
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
