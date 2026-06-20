import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

type ApiBatchStatus = "PENDING" | "SENT" | "RECEIVED" | "CANCELLED";
type ApiBatchDirection = "FORWARD" | "RETURN";

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

  if (["new", "created", "yangi", "pending"].includes(normalized)) return "new";
  if (["on_the_way", "on-way", "in_transit", "yo'lda", "yolda", "sent"].includes(normalized)) {
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

const normalizeWhereDeliver = (value: unknown): BatchOrder["where_deliver"] => {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (["center", "centre", "branch", "office", "pickup", "markaz", "markazga"].includes(normalized)) {
    return "center";
  }

  if (["home", "house", "door", "door_to_door", "uy", "uyga"].includes(normalized)) {
    return "home";
  }

  if (["address", "manzil", "manzilga", "delivery_address"].includes(normalized)) {
    return "address";
  }

  return undefined;
};

const toApiBatchStatus = (status: BatchStatus): ApiBatchStatus => {
  const statusMap: Record<BatchStatus, ApiBatchStatus> = {
    new: "PENDING",
    on_the_way: "SENT",
    received: "RECEIVED",
    cancelled: "CANCELLED",
  };

  return statusMap[status];
};

const toApiBatchDirection = (direction: BatchDirection): ApiBatchDirection => {
  const directionMap: Record<BatchDirection, ApiBatchDirection> = {
    forward: "FORWARD",
    return: "RETURN",
  };

  return directionMap[direction];
};

const normalizeBranch = (value: any, fallback = "—"): BatchBranch => {
  const branch = value?.branch ?? value?.branch_data ?? value?.branchData ?? value;
  const id = toText(
    branch?.id ??
      branch?._id ??
      branch?.branch_id ??
      branch?.branchId ??
      value?.branch_id ??
      value?.branchId,
    fallback,
  );
  const name = toText(
    branch?.name ??
      branch?.title ??
      branch?.branch_name ??
      branch?.branchName ??
      value?.branch_name ??
      value?.branchName,
    fallback,
  );

  return {
    id,
    name,
    code: branch?.code ? toText(branch.code, fallback) : undefined,
    region: branch?.region?.name
      ? toText(branch.region.name, fallback)
      : branch?.region
        ? toText(branch.region, fallback)
        : branch?.region_name ?? branch?.regionName
          ? toText(branch.region_name ?? branch.regionName, fallback)
          : undefined,
  };
};

const normalizeOrder = (order: any, index: number): BatchOrder => ({
  id: toText(
    order?.order?.id ??
      order?.id ??
      order?._id ??
      order?.order_id,
    `ORD-${index + 1}`,
  ),
  qr_code_token: toText(
    order?.order?.qr_code_token ??
      order?.qr_code_token ??
      order?.qrCodeToken ??
      order?.token,
    "",
  ) || null,
  where_deliver: normalizeWhereDeliver(
    order?.order?.where_deliver ??
      order?.order?.whereDeliver ??
      order?.order?.delivery_type ??
      order?.order?.deliveryType ??
      order?.where_deliver ??
      order?.whereDeliver ??
      order?.delivery_type ??
      order?.deliveryType,
  ),
  receiver: toText(
    order?.order?.customer?.name ??
      order?.order?.receiver ??
    order?.receiver ??
      order?.customer?.name ??
      order?.customer?.fullName ??
      order?.customer_name,
  ),
  phone: toText(
    order?.order?.customer?.phone_number ??
      order?.phone ??
      order?.customer?.phone_number ??
      order?.customer?.phone,
    "",
  ),
  address: toText(
    order?.order?.address ??
      order?.address ??
      order?.delivery_address ??
      order?.location,
  ),
  price: toNumber(
    order?.order?.total_price ??
      order?.snapshot_price ??
      order?.price ??
      order?.total_price ??
      order?.amount,
  ),
  status: toText(order?.order?.status ?? order?.status),
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
  token: toText(raw?.qr_code_token ?? raw?.token ?? raw?.qr_token ?? raw?.qrCodeToken, ""),
  from_branch: normalizeBranch(
      raw?.from_branch ??
      raw?.fromBranch ??
      raw?.source_branch ??
      raw?.sourceBranch ??
      raw?.from ??
      {
        id: raw?.source_branch_id ?? raw?.sourceBranchId ?? raw?.from_branch_id ?? raw?.fromBranchId,
        name: raw?.source_branch_name ?? raw?.sourceBranchName ?? raw?.from_branch_name ?? raw?.fromBranchName,
      },
  ),
  to_branch: normalizeBranch(
    raw?.to_branch ??
      raw?.toBranch ??
      raw?.destination_branch ??
      raw?.destinationBranch ??
      raw?.to ??
      (raw?.destination_branch_id || raw?.destinationBranchId || raw?.destination_branch_name || raw?.destinationBranchName
        ? {
            id: raw?.destination_branch_id ?? raw?.destinationBranchId,
            name: raw?.destination_branch_name ?? raw?.destinationBranchName,
          }
        : null) ??
      {
        id: raw?.target_region_id ?? raw?.region?.id,
        name: raw?.region?.name,
        region: raw?.region?.name,
      },
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
  driver_phone: raw?.driver_phone ? toText(raw.driver_phone, "") : undefined,
  vehicle_plate: raw?.vehicle_plate ? toText(raw.vehicle_plate, "") : undefined,
  request_key: raw?.request_key ? toText(raw.request_key, "") : undefined,
  created_at: toText(raw?.created_at ?? raw?.createdAt, new Date().toISOString()),
});

const normalizeBatchWithRegion = (raw: any): Batch => {
  const normalized = normalizeBatch(raw);
  const regionName = toText(raw?.region?.name ?? raw?.target_region_name, "");

  if (!normalized.to_branch.region && regionName) {
    return {
      ...normalized,
      to_branch: {
        ...normalized.to_branch,
        region: regionName,
      },
    };
  }

  return normalized;
};

const normalizeBatchDetail = (raw: any): BatchDetail => {
  const source = raw?.data ?? raw?.item ?? raw;
  const batch = normalizeBatch(source);
  const orders = Array.isArray(source?.orders)
    ? source.orders
    : Array.isArray(source?.order_list)
      ? source.order_list
      : Array.isArray(source?.items)
        ? source.items
        : [];
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

  return source.map(normalizeBatchWithRegion);
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

  if (params.status) requestParams.status = toApiBatchStatus(params.status);
  if (params.direction) requestParams.direction = toApiBatchDirection(params.direction);
  if (params.statusRaw) requestParams.status = params.statusRaw;

  if (params.directionRaw) requestParams.direction = params.directionRaw;

  if (params.sourceBranchId) requestParams.source_branch_id = params.sourceBranchId;
  if (params.destinationBranchId) requestParams.destination_branch_id = params.destinationBranchId;
  if (params.from) requestParams.from = params.from;
  if (params.to) requestParams.to = params.to;
  if (params.page) requestParams.page = String(params.page);
  if (params.limit) requestParams.limit = String(params.limit);

  return requestParams;
};

export const useBatches = (params?: BatchListParams, options?: { enabled?: boolean }) =>
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
    enabled: options?.enabled ?? true,
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

export const useBatchRemainingDetail = (id?: string) =>
  useQuery<BatchDetail>({
    queryKey: [BATCH_KEY, "remaining", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const response = await api.get(API_ENDPOINTS.BATCHES.REMAINING(id || ""));
      return normalizeBatchDetail(response.data);
    },
  });

export const useSendTransferBatch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      batchId,
      orderIds,
    }: {
      batchId: string;
      orderIds: string[];
    }) =>
      api.patch(API_ENDPOINTS.BATCHES.SEND(batchId), {
        orderIds,
      }),
    onSuccess: (_response, variables) => {
      void queryClient.invalidateQueries({ queryKey: [BATCH_KEY] });
      void queryClient.invalidateQueries({ queryKey: [BATCH_KEY, variables.batchId] });
      void queryClient.invalidateQueries({ queryKey: ["mails"] });
    },
  });
};

export const useReceiveTransferBatch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (batchId: string) => api.post(API_ENDPOINTS.BATCHES.RECEIVE(batchId)),
    onSuccess: (_response, batchId) => {
      void queryClient.invalidateQueries({ queryKey: [BATCH_KEY] });
      void queryClient.invalidateQueries({ queryKey: [BATCH_KEY, batchId] });
      void queryClient.invalidateQueries({ queryKey: ["mails"] });
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
};

export const useReceiveTransferBatchOrders = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      batchId,
      orderIds,
    }: {
      batchId: string;
      orderIds: string[];
    }) =>
      api.post(API_ENDPOINTS.BATCHES.RECEIVE_ORDERS(batchId), {
        orderIds,
      }),
    onSuccess: (_response, variables) => {
      void queryClient.invalidateQueries({ queryKey: [BATCH_KEY] });
      void queryClient.invalidateQueries({ queryKey: [BATCH_KEY, variables.batchId] });
      void queryClient.invalidateQueries({ queryKey: [BATCH_KEY, "remaining", variables.batchId] });
      void queryClient.invalidateQueries({ queryKey: ["mails"] });
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
};
