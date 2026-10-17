import { toApiBatchStatus, type ApiBatchStatus, type BatchStatus } from "../../../entities/batch";
import type { ISODateRange } from "../../../shared/lib/dateRange";
import {
  getPresetRange,
  matchPreset,
  normalizeISODay,
  todayISODay,
  type ISODay,
} from "../../../shared/ui/primitives/date/calendarMath";

/**
 * «QAYTARISHLAR» (`/returns`) — qaytarish paketlari ro'yxatining sof qismi: URL filtrlari (holat, sana), so'rov
 * paramlari, javobni normallashtirish (backend javobining turli shakllari — v1 dagidek) va joriy sahifa ichida
 * saralash. Hammasi `returnBatches.test.ts` da tekshiriladi.
 */

type UnknownRecord = Record<string, unknown>;

export interface ReturnBatch {
  id: string;
  token: string;
  fromBranch: string;
  toBranch: string;
  ordersCount: number;
  totalPrice: number;
  status: BatchStatus;
  createdAt: string;
}

export interface ReturnBatchesResponse {
  data: ReturnBatch[];
  meta: { page: number; limit: number; total: number; totalPages?: number };
}

/* ─── Sana filtri (ega qarori 2026-10-17 F2) ───────────────────────────────── */

/**
 * `GET transfer-batches` sana filtri: oraliq (`from`/`to`) YO'Q — faqat davr `period=today|week|month` yoki bitta
 * kun `date=YYYY-MM-DD` (Toshkent kuni, `createdAt`); ikkalasi kelsa backend `date` ni oladi.
 * Hafta — dushanbadan, oy — 1-kunidan (taqvim tez tanlovi bilan bir xil).
 */
export type ReturnPeriod = "today" | "week" | "month";
export type ReturnDateFilter = { period: ReturnPeriod } | { date: ISODay } | null;

const RETURN_PERIODS: readonly ReturnPeriod[] = ["today", "week", "month"];
const RETURN_STATUSES: readonly BatchStatus[] = ["new", "on_the_way", "received", "cancelled"];

/** URL parametrlari (nomlari API bilan bir xil): `?status=received&period=week` yoki `?date=2026-10-15`. */
export const RETURN_FILTER_KEYS = { status: "status", period: "period", date: "date" } as const;

export type ReturnFilters = { status: BatchStatus | ""; dateFilter: ReturnDateFilter };

const isReturnPeriod = (value: string | null): value is ReturnPeriod =>
  RETURN_PERIODS.some((period) => period === value);

/** Faqat `YYYY-MM-DD` va haqiqiy kun (`2026-13-40` — yo'q). */
const readISODay = (value: string | null): ISODay => {
  const raw = value?.trim() ?? "";
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? normalizeISODay(raw) : "";
};

/** URL → filtrlar: noma'lum holat va noto'g'ri sana e'tiborsiz; `date` va `period` ikkalasi bo'lsa — `date`. */
export const readReturnFilters = (params: URLSearchParams): ReturnFilters => {
  const rawStatus = params.get(RETURN_FILTER_KEYS.status);
  const status = RETURN_STATUSES.find((value) => value === rawStatus) ?? "";
  const date = readISODay(params.get(RETURN_FILTER_KEYS.date));
  const period = params.get(RETURN_FILTER_KEYS.period);
  const dateFilter: ReturnDateFilter = date ? { date } : isReturnPeriod(period) ? { period } : null;
  return { status, dateFilter };
};

/**
 * Filtr o'zgardi → URL: berilgan kalitlar yoziladi yoki o'chadi (sana — `period` va `date` dan bittasi, ikkinchisi
 * doim o'chadi), sahifa 1 ga qaytadi (`page` o'chadi), `limit` qoladi.
 */
export const writeReturnFilters = (prev: URLSearchParams, patch: Partial<ReturnFilters>): URLSearchParams => {
  const next = new URLSearchParams(prev);
  if ("status" in patch) {
    if (patch.status) next.set(RETURN_FILTER_KEYS.status, patch.status);
    else next.delete(RETURN_FILTER_KEYS.status);
  }
  if ("dateFilter" in patch) {
    next.delete(RETURN_FILTER_KEYS.period);
    next.delete(RETURN_FILTER_KEYS.date);
    const filter = patch.dateFilter;
    if (filter && "date" in filter) next.set(RETURN_FILTER_KEYS.date, filter.date);
    else if (filter) next.set(RETURN_FILTER_KEYS.period, filter.period);
  }
  next.delete("page");
  return next;
};

/** Sana filtri → maydon qiymati (`DateRange selection="day"`): davr — tez tanlov oralig'i, kun — `{ d, d }`. */
export const dateFilterToRange = (filter: ReturnDateFilter, today: ISODay = todayISODay()): ISODateRange => {
  if (!filter) return { from: "", to: "" };
  if ("date" in filter) return { from: filter.date, to: filter.date };
  return getPresetRange(filter.period, today);
};

/**
 * Maydon qiymati → sana filtri: bo'sh — yo'q; tez tanlov oralig'i — `period` (dushanba kuni «Bu hafta» va oyning
 * 1-kuni «Bu oy» «Bugun» bilan bir xil oraliq — `today`, backend natijasi ham bir xil); bitta kun — `date`.
 * Kun rejimida boshqa oraliq bo'lmaydi; bo'lsa — boshlanish kuni.
 */
export const rangeToDateFilter = (range: ISODateRange, today: ISODay = todayISODay()): ReturnDateFilter => {
  const from = normalizeISODay(range.from);
  const to = normalizeISODay(range.to);
  if (!from && !to) return null;
  const period = matchPreset({ from, to }, RETURN_PERIODS, today);
  if (period && isReturnPeriod(period)) return { period };
  return { date: from || to };
};

/* ─── So'rov ─────────────────────────────────────────────────────────────────── */

/**
 * `GET transfer-batches` paramlari (openapi: `direction`, `status` — katta harf, `source_branch_id`, `period` |
 * `date`, `page`, `limit`). `from`/`to` va saralash paramlari yo'q (gateway ularni tashlab yuboradi).
 */
export interface ReturnBatchesParams {
  page: number;
  limit: number;
  direction: "RETURN";
  source_branch_id?: string;
  status?: ApiBatchStatus;
  period?: ReturnPeriod;
  date?: ISODay;
}

/**
 * So'rov paramlari. Holat filtri API qiymatiga o'tkaziladi (`new` → `PENDING`, `on_the_way` → `SENT` …): v1 kichik
 * harfli ilova qiymatini yuborardi — backend uni tanimasdi (ma'lumot yetishmovchiligi 4). Sana — `period` yoki
 * `date` (bittasi).
 */
export const buildReturnBatchesParams = ({
  page,
  limit,
  branchId,
  status,
  dateFilter = null,
}: {
  page: number;
  limit: number;
  branchId?: string;
  status?: BatchStatus | "";
  dateFilter?: ReturnDateFilter;
}): ReturnBatchesParams => ({
  page,
  limit,
  direction: "RETURN",
  ...(branchId ? { source_branch_id: branchId } : {}),
  ...(status ? { status: toApiBatchStatus(status) } : {}),
  ...(dateFilter ? ("date" in dateFilter ? { date: dateFilter.date } : { period: dateFilter.period }) : {}),
});

const getPayload = (payload: unknown): UnknownRecord => {
  if (!payload || typeof payload !== "object") return {};
  return payload as UnknownRecord;
};

export const unwrapReturnBatchList = (payload: unknown): UnknownRecord[] => {
  const body = getPayload(payload);
  const nestedData = getPayload(body.data);
  const candidates = [body.items, nestedData.items, body.results, nestedData.results, body.data, nestedData.data, payload];
  const list = candidates.find(Array.isArray);
  return (list ?? []) as UnknownRecord[];
};

export const readReturnBatchesMeta = (payload: unknown, page: number, limit: number, count: number) => {
  const body = getPayload(payload);
  const nestedData = getPayload(body.data);
  const meta = getPayload(body.meta ?? nestedData.meta);

  return {
    page: Number(meta.page ?? body.page ?? nestedData.page ?? page),
    limit: Number(meta.limit ?? body.limit ?? nestedData.limit ?? limit),
    total: Number(meta.total ?? body.total ?? nestedData.total ?? count),
    totalPages: Number(meta.totalPages ?? body.totalPages ?? nestedData.totalPages ?? 1),
  };
};

export const normalizeReturnBatch = (item: UnknownRecord): ReturnBatch => {
  const sourceBranch = getPayload(item.source_branch ?? item.sourceBranch ?? item.from_branch ?? item.fromBranch);
  const destinationBranch = getPayload(
    item.destination_branch ?? item.destinationBranch ?? item.to_branch ?? item.toBranch,
  );
  const id = String(item.id ?? item._id ?? item.batch_id ?? item.batchId ?? item.token ?? "");
  const rawStatus = String(item.status ?? item.batch_status ?? "new").toLowerCase();
  const status: BatchStatus =
    rawStatus === "pending" || rawStatus === "new"
      ? "new"
      : rawStatus === "sent" || rawStatus === "on_the_way"
        ? "on_the_way"
        : rawStatus === "received"
          ? "received"
          : "cancelled";

  return {
    id,
    token: String(item.qr_code_token ?? item.qrCodeToken ?? item.token ?? id),
    fromBranch: String(
      sourceBranch.name ??
        item.source_branch_name ??
        item.sourceBranchName ??
        item.from_branch_name ??
        item.fromBranchName ??
        "—",
    ),
    toBranch: String(
      destinationBranch.name ??
        item.destination_branch_name ??
        item.destinationBranchName ??
        item.to_branch_name ??
        item.toBranchName ??
        "—",
    ),
    ordersCount: Number(item.order_count ?? item.orderCount ?? item.orders_count ?? item.ordersCount ?? 0),
    totalPrice: Number(
      item.total_price ?? item.totalPrice ?? item.amount ?? item.total_amount ?? item.totalAmount ?? 0,
    ),
    status,
    createdAt: String(item.created_at ?? item.createdAt ?? item.sent_at ?? item.sentAt ?? ""),
  };
};

/** Backend javobi → ro'yxat (id'siz yozuvlar tashlanadi). */
export const toReturnBatchesResponse = (payload: unknown, params: Pick<ReturnBatchesParams, "page" | "limit">) => {
  const list = unwrapReturnBatchList(payload)
    .map(normalizeReturnBatch)
    .filter((item) => item.id);
  return {
    data: list,
    meta: readReturnBatchesMeta(payload, params.page, params.limit, list.length),
  } satisfies ReturnBatchesResponse;
};

/** Saralanadigan ustunlar (maket: har sarlavha `.el-th-sort`). */
export type ReturnBatchSortKey = "batch" | "from" | "to" | "status" | "orders" | "amount";

export type ReturnBatchSort = { key: ReturnBatchSortKey; direction: "asc" | "desc" };

/** Sukut: paketlar — yangisi tepada (maket `aria-sort="descending"`). */
export const DEFAULT_RETURN_SORT: ReturnBatchSort = { key: "batch", direction: "desc" };

const STATUS_ORDER: Record<BatchStatus, number> = { new: 0, on_the_way: 1, received: 2, cancelled: 3 };

const toTime = (value: string) => {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
};

const compareIds = (a: string, b: string) => {
  const left = Number(a);
  const right = Number(b);
  return Number.isFinite(left) && Number.isFinite(right) ? left - right : a.localeCompare(b);
};

const compareBy: Record<ReturnBatchSortKey, (a: ReturnBatch, b: ReturnBatch) => number> = {
  batch: (a, b) => toTime(a.createdAt) - toTime(b.createdAt) || compareIds(a.id, b.id),
  from: (a, b) => a.fromBranch.localeCompare(b.fromBranch),
  to: (a, b) => a.toBranch.localeCompare(b.toBranch),
  status: (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status],
  orders: (a, b) => a.ordersCount - b.ordersCount,
  amount: (a, b) => a.totalPrice - b.totalPrice,
};

/**
 * Joriy sahifa ichida saralash (backend `transfer-batches` saralash paramini qabul qilmaydi — yetishmovchilik 4).
 * `null` — kelgan tartib.
 */
export const sortReturnBatches = (rows: readonly ReturnBatch[], sort: ReturnBatchSort | null): ReturnBatch[] => {
  if (!sort) return [...rows];
  const sign = sort.direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => sign * compareBy[sort.key](a, b));
};

/** Profilga biriktirilgan filial nomi (`branch.branch.name` yoki `branch.name`), bo'lmasa `null`. */
export const readUserBranchName = (user: unknown): string | null => {
  const asRecord = (value: unknown) => (value && typeof value === "object" ? (value as UnknownRecord) : null);
  const asText = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
  const branch = asRecord(asRecord(user)?.branch);
  if (!branch) return null;
  return asText(asRecord(branch.branch)?.name) ?? asText(branch.name) ?? asText(branch.branch_name);
};
