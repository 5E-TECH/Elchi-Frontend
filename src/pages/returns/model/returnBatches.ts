import { toApiBatchStatus, type ApiBatchStatus, type BatchStatus } from "../../../entities/batch";

/**
 * «QAYTARISHLAR» (`/returns`) — qaytarish paketlari ro'yxatining sof qismi: so'rov paramlari, javobni
 * normallashtirish (backend javobining turli shakllari — v1 dagidek) va joriy sahifa ichida saralash.
 * Hammasi `returnBatches.test.ts` da tekshiriladi.
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

/** `GET transfer-batches` paramlari (openapi: `direction`, `status` — katta harf, `source_branch_id`, `page`, `limit`). */
export interface ReturnBatchesParams {
  page: number;
  limit: number;
  direction: "RETURN";
  source_branch_id?: string;
  status?: ApiBatchStatus;
}

/**
 * So'rov paramlari. Holat filtri API qiymatiga o'tkaziladi (`new` → `PENDING`, `on_the_way` → `SENT` …): v1 kichik
 * harfli ilova qiymatini yuborardi — backend uni tanimasdi (ma'lumot yetishmovchiligi 4).
 */
export const buildReturnBatchesParams = ({
  page,
  limit,
  branchId,
  status,
}: {
  page: number;
  limit: number;
  branchId?: string;
  status?: BatchStatus | "";
}): ReturnBatchesParams => ({
  page,
  limit,
  direction: "RETURN",
  ...(branchId ? { source_branch_id: branchId } : {}),
  ...(status ? { status: toApiBatchStatus(status) } : {}),
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
