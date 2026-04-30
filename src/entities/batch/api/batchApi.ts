import { useQuery } from "@tanstack/react-query";
import { api } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";
import type {
  Batch,
  BatchBranch,
  BatchDetail,
  BatchDirection,
  BatchHistoryItem,
  BatchListParams,
  BatchListResponse,
  BatchListMeta,
  BatchOrder,
  BatchStatus,
} from "../model/types";

export const BATCH_KEY = "batches";

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toText = (value: unknown, fallback = "—") => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return fallback;
};

const normalizeStatus = (value: unknown): BatchStatus => {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (["new", "created", "yangi"].includes(normalized)) return "new";
  if (["on_the_way", "on-way", "in_transit", "yo'lda", "yolda"].includes(normalized)) {
    return "on_the_way";
  }
  if (["received", "accepted", "qabul_qilindi", "received_at_branch"].includes(normalized)) {
    return "received";
  }
  if (["cancelled", "canceled", "bekor_qilindi"].includes(normalized)) return "cancelled";

  return "new";
};

const normalizeDirection = (value: unknown): BatchDirection => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["return", "returned", "qaytarish", "backward"].includes(normalized)) return "return";
  return "forward";
};

const normalizeBranch = (value: any, fallback = "—"): BatchBranch => ({
  id: toText(value?.id ?? value?._id ?? value?.branch_id, fallback),
  name: toText(value?.name ?? value?.title ?? value?.branch_name, fallback),
  code: value?.code ? toText(value.code, fallback) : undefined,
  region: value?.region?.name
    ? toText(value.region.name, fallback)
    : value?.region
      ? toText(value.region, fallback)
      : value?.region_name
        ? toText(value.region_name, fallback)
        : undefined,
});

const normalizeOrder = (order: any, index: number): BatchOrder => ({
  id: toText(order?.id ?? order?._id ?? order?.order_id, `ORD-${index + 1}`),
  receiver: toText(
    order?.receiver ??
      order?.customer?.name ??
      order?.customer?.fullName ??
      order?.customer_name,
  ),
  phone: toText(order?.phone ?? order?.customer?.phone_number ?? order?.customer?.phone, ""),
  address: toText(order?.address ?? order?.delivery_address ?? order?.location),
  price: toNumber(order?.price ?? order?.total_price ?? order?.amount),
  status: toText(order?.status),
});

const normalizeHistoryItem = (
  item: any,
  index: number,
  createdAtFallback: string,
): BatchHistoryItem => ({
  id: toText(item?.id ?? item?._id, `history-${index + 1}`),
  actor: toText(item?.actor?.name ?? item?.actor ?? item?.user?.name ?? item?.user?.fullName),
  action: toText(item?.action ?? item?.message ?? item?.title),
  created_at: toText(item?.created_at ?? item?.createdAt, createdAtFallback),
});

const normalizeBatch = (raw: any): Batch => ({
  id: toText(raw?.id ?? raw?._id ?? raw?.batch_id),
  token: toText(raw?.token ?? raw?.qr_token ?? raw?.qrCodeToken, ""),
  from_branch: normalizeBranch(
    raw?.from_branch ?? raw?.fromBranch ?? raw?.source_branch ?? raw?.from,
  ),
  to_branch: normalizeBranch(
    raw?.to_branch ?? raw?.toBranch ?? raw?.destination_branch ?? raw?.to,
  ),
  direction: normalizeDirection(raw?.direction),
  orders_count: toNumber(raw?.orders_count ?? raw?.ordersCount ?? raw?.order_count ?? raw?.orders?.length),
  total_price: toNumber(raw?.total_price ?? raw?.totalPrice ?? raw?.amount ?? raw?.total_amount ?? raw?.total),
  status: normalizeStatus(raw?.status),
  driver: raw?.driver?.name
    ? toText(raw.driver.name)
    : raw?.driver_name
      ? toText(raw.driver_name)
      : raw?.driver
        ? toText(raw.driver)
        : undefined,
  created_at: toText(raw?.created_at ?? raw?.createdAt, new Date().toISOString()),
});

const normalizeBatchDetail = (raw: any): BatchDetail => {
  const source = raw?.data ?? raw?.item ?? raw;
  const batch = normalizeBatch(source);
  const orders = Array.isArray(source?.orders) ? source.orders : Array.isArray(source?.order_list) ? source.order_list : [];
  const history = Array.isArray(source?.history) ? source.history : Array.isArray(source?.logs) ? source.logs : [];

  return {
    ...batch,
    orders: orders.map(normalizeOrder),
    history: history.map((item: any, index: number) =>
      normalizeHistoryItem(item, index, batch.created_at),
    ),
  };
};

const extractBatchList = (payload: any): Batch[] => {
  const source =
    payload?.data?.items ??
    payload?.data?.data ??
    payload?.data ??
    payload?.items ??
    payload;

  if (!Array.isArray(source)) return [];

  return source.map(normalizeBatch);
};

const extractTotal = (payload: any, fallback: number) =>
  toNumber(
    payload?.data?.meta?.total ??
      payload?.data?.total ??
      payload?.meta?.total ??
      payload?.total,
    fallback,
  );

const extractMeta = (payload: any, fallbackTotal: number): BatchListMeta => ({
  page: toNumber(payload?.data?.meta?.page ?? payload?.meta?.page, 1),
  limit: toNumber(payload?.data?.meta?.limit ?? payload?.meta?.limit, 20),
  total: extractTotal(payload, fallbackTotal),
  totalPages: toNumber(payload?.data?.meta?.totalPages ?? payload?.meta?.totalPages, 1),
});

const buildListParams = (params?: BatchListParams) => {
  if (!params) return undefined;

  const requestParams: Record<string, string> = {};

  if (params.status) requestParams.status = params.status;
  if (params.direction) requestParams.direction = params.direction;
  if (params.from) requestParams.from = params.from;
  if (params.to) requestParams.to = params.to;
  if (params.page) requestParams.page = String(params.page);
  if (params.limit) requestParams.limit = String(params.limit);

  return requestParams;
};

export const useBatches = (params?: BatchListParams) =>
  useQuery<BatchListResponse>({
    queryKey: [BATCH_KEY, params],
    queryFn: async () => {
      const response = await api.get(API_ENDPOINTS.BATCHES.BASE, {
        params: buildListParams(params),
      });
      const data = extractBatchList(response.data);
      const meta = extractMeta(response.data, data.length);

      return {
        data,
        total: meta.total,
        meta,
      };
    },
    placeholderData: (prev) => prev,
  });

export const useBatchDetail = (id?: string) =>
  useQuery<BatchDetail>({
    queryKey: [BATCH_KEY, id],
    enabled: Boolean(id),
    queryFn: async () => {
      const response = await api.get(API_ENDPOINTS.BATCHES.BY_ID(id || ""));
      return normalizeBatchDetail(response.data);
    },
  });
