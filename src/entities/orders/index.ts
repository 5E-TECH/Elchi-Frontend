import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, LONG_REQUEST_TIMEOUT_MS } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";
import type { CancelOrderPayload } from "./cancelReason";
import type { SellOrderPayload } from "./sellPayment";
import type { ExtraCostRejectReason } from "./extraCostDecision";
import type { RollbackTarget } from "./rollbackTarget";

export {
  EXTRA_COST_REJECT_REASONS,
  canDecideExtraCost,
  isExtraCostAlreadyDecidedError,
  type ExtraCostRejectReason,
} from "./extraCostDecision";

const orders = "orders";

/**
 * Ro'yxat sahifasining yangilanish sozlamalari (OR-1, `pages/orders/list/useOrdersRefresh`). Ixtiyoriy —
 * berilmasa so'rov avvalgidek (global sukut: ilovaga qaytganda so'ralmaydi, xato global xabar beradi).
 */
export type ListRefreshQueryOptions = {
  /** Ilovaga (brauzer tabiga) qaytganda qayta so'rash — faqat shu so'rovda. */
  refetchOnWindowFocus?: boolean;
  /** Keshda ma'lumot bo'lsa xato global xabar bermaydi — sahifa «Ro'yxat yangilanmadi» ni o'zi chizadi. */
  silentErrorWhenCached?: boolean;
};

/** Kuryer tablari soni — `GET orders/courier/orders/counts` (0d11ewk7; ro'yxat `total` i bilan aynan bir xil). */
export type CourierOrderCounts = { waiting: number; all: number; cancelled: number };

export const COURIER_ORDER_COUNTS_QUERY_KEY = [orders, "courier", "counts"] as const;

const toCount = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : null;
};

/** `{ data: { waiting, all, cancelled } }` → sonlar; shakl boshqacha bo'lsa `null` (tablar sonsiz chiziladi). */
export const parseCourierOrderCounts = (body: unknown): CourierOrderCounts | null => {
  const root = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  const data = root?.data && typeof root.data === "object" && !Array.isArray(root.data)
    ? (root.data as Record<string, unknown>)
    : null;
  if (!data) return null;
  const waiting = toCount(data.waiting);
  const all = toCount(data.all);
  const cancelled = toCount(data.cancelled);
  return waiting === null || all === null || cancelled === null ? null : { waiting, all, cancelled };
};

/**
 * `GET orders/markets/new` (bugun yangi buyurtmasi bor marketlar) so'rovi — kalit va `queryFn` bitta joyda:
 * `useGetTodayOrders` va universal skaner «Qabul qilish» varag'i (`pages/scan`) bir kesh yozuvini ulashadi.
 */
export const todayMarketsQueryOptions = (params?: unknown) => ({
  queryKey: [orders, params] as const,
  queryFn: () => api.get(API_ENDPOINTS.ORDERS.MARKETS_NEW, { params }).then((res) => res.data),
});

export type ExtraCostApproval = {
  id: string;
  order_id: string;
  /** (0Ngp09FG) mijozga ko'rinadigan raqam («EL-100076»), ichki `order_id` emas — `extraCostOrderNumber`. */
  order_number?: string | null;
  market_id: string;
  requested_by_user_id: string;
  requested_by_role?: string | null;
  /** (0Ngp09FG) so'rovchi: `name` identity'dan, olinmasa `null` — `extraCostRequesterName`. */
  requested_by?: { id?: string | null; name?: string | null } | null;
  requester_branch_id?: string | null;
  action: "sell" | "cancel" | "partly_sell";
  amount: number;
  proof_file_keys?: string[];
  status: "pending" | "approved" | "rejected";
  decided_by_user_id?: string | null;
  decided_at?: string | null;
  decision_comment?: string | null;
  /** (1tnpaIqd) muddat o'tib avtomatik tasdiqlangan. */
  auto_approved?: boolean;
  /**
   * (1tnpaIqd) muddat: kutilayotgan so'rov shu vaqtgacha javobsiz qolsa avtomatik tasdiqlanadi
   * (`EXTRA_COST_AUTO_APPROVE_MINUTES`). Avtomatik tasdiq o'chiq yoki so'rov yopilgan — `null`.
   */
  auto_approve_at?: string | null;
  /** (DuST9k8j) rad etish sababi — yopiq ro'yxat. */
  reject_reason?: ExtraCostRejectReason | null;
  createdAt?: string;
  updatedAt?: string;
};

export type ExtraCostApprovalsResponse = {
  data?: ExtraCostApproval[];
  statusCode?: number;
  message?: string;
};

/**
 * Sotish/bekor qilish so'roviga qo'shimcha sarlavhalar. Ommaviy yopish (`/courier-bulk`)
 * `X-Request-Source: courier-bulk` yuboradi — backend amalni audit jurnalida ommaviy amal deb
 * yozadi (`activity_logs.metadata.request_source`, j9KFyqlS).
 */
export type OrderActionHeaders = Readonly<Record<string, string>>;

export type UpdateNewOrderPayload = Partial<{
  region_id: string;
  district_id: string;
  address: string;
  where_deliver: string;
  total_price: number;
  comment: string;
  items: { product_id: string; quantity: number }[];
}>;

export const useOrders = () => {
  const client = useQueryClient();

  const uploadProofFile = async (proof: File) => {
    const formData = new FormData();
    formData.append("file", proof);
    formData.append("folder", "proof");

    // Rasm/video (10 MB gacha) sekin tarmoqda 20 s dan oshishi mumkin.
    const response = await api.post(API_ENDPOINTS.FILES.UPLOAD, formData, { timeout: LONG_REQUEST_TIMEOUT_MS });
    const key = response.data?.data?.key ?? response.data?.key;

    if (!key) {
      throw new Error("Proof file upload did not return a key");
    }

    return String(key);
  };

  const toOrderActionBody = async (data: Record<string, unknown>) => {
    if (!(data.proof instanceof File)) return data;

    const { proof, proofFileKeys, ...rest } = data;
    const uploadedKey = await uploadProofFile(proof);
    const existingKeys = Array.isArray(proofFileKeys)
      ? proofFileKeys.map(String).filter(Boolean)
      : [];

    return {
      ...rest,
      proofFileKeys: Array.from(new Set([...existingKeys, uploadedKey])),
    };
  };

  // Sarlavhasiz chaqiruv aynan avvalgidek (`api.post(url, body)`) — boshqa chaqiruvchilar o'zgarmaydi.
  const postOrderAction = (url: string, body: unknown, headers?: OrderActionHeaders) =>
    (headers ? api.post(url, body, { headers }) : api.post(url, body)).then((res) => res.data);

  // A sell/cancel/rollback/partly-sell moves COD cash across cashboxes, so the
  // finance/cashbox caches (separate key space, 30s staleTime) must be refreshed
  // too — otherwise balances shown right after the action are stale. (Audit P1-3.)
  const invalidateMoney = () => {
    client.invalidateQueries({ queryKey: [orders] });
    client.invalidateQueries({ queryKey: ["finance-cov"] });
    client.invalidateQueries({ queryKey: ["cashbox"] });
    client.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const useExtraCostApprovals = (
    status: "pending" | "approved" | "rejected" = "pending",
    enabled = true,
  ) =>
    useQuery<ExtraCostApprovalsResponse>({
      queryKey: [orders, "extra-cost-approvals", status],
      queryFn: () =>
        api
          .get(API_ENDPOINTS.ORDERS.EXTRA_COST_APPROVALS, { params: { status } })
          .then((res) => res.data),
      enabled,
      // Kutilayotgan so'rov Telegram'da ham (✅/❌) hal qilinishi mumkin — oynaga qaytilganda va
      // har 30 s da yangilanadi (global sukut `refetchOnWindowFocus: false`). Xato holatida 30 s lik
      // yangilanish EMAS — aks holda xato kartasi har 30 s da skeletga aylanib qaytadi.
      refetchInterval: (query) => (status === "pending" && query.state.status !== "error" ? 30000 : false),
      refetchOnWindowFocus: status === "pending" ? "always" : false,
      // Karta xatoni o'zi chizadi (`ErrorState`) — global xabar takrorlanmasin va har fokusda qaytmasin
      // (G6F68ti6, 15-band).
      meta: { silentError: true },
    });

  /**
   * (1tnpaIqd) Avtomatik tasdiqlangan qo'shimcha xarajatlar — alohida filtr
   * (`?status=approved&auto_approved=true`), market e'tiroz bildirishi uchun. Kamdan-kam o'zgaradi —
   * davriy yangilanishsiz.
   */
  const useAutoApprovedExtraCostApprovals = (enabled = true) =>
    useQuery<ExtraCostApprovalsResponse>({
      queryKey: [orders, "extra-cost-approvals", "approved", "auto"],
      queryFn: () =>
        api
          .get(API_ENDPOINTS.ORDERS.EXTRA_COST_APPROVALS, { params: { status: "approved", auto_approved: true } })
          .then((res) => res.data),
      enabled,
    });

  const approveExtraCostApproval = useMutation({
    mutationFn: ({ id, comment }: { id: string; comment?: string }) =>
      api
        .post(API_ENDPOINTS.ORDERS.EXTRA_COST_APPROVAL_APPROVE(id), { comment })
        .then((res) => res.data),
    onSuccess: invalidateMoney,
  });

  const rejectExtraCostApproval = useMutation({
    mutationFn: ({ id, reason, comment }: { id: string; reason?: ExtraCostRejectReason; comment?: string }) =>
      api
        .post(API_ENDPOINTS.ORDERS.EXTRA_COST_APPROVAL_REJECT(id), {
          ...(reason ? { reason } : {}),
          ...(comment?.trim() ? { comment: comment.trim() } : {}),
        })
        .then((res) => res.data),
    onSuccess: invalidateMoney,
  });

  const createReceiveOrder = useMutation({
    mutationFn: (data: { orderIds?: string[]; order_ids?: string[] }) => {
      const normalizedOrderIds = Array.isArray(data?.order_ids)
        ? data.order_ids
        : Array.isArray(data?.orderIds)
          ? data.orderIds
          : [];

      return api
        .post(API_ENDPOINTS.ORDERS.RECEIVE, { order_ids: normalizedOrderIds })
        .then((res) => res.data);
    },
    onSuccess: () => {
      // Barcha orders cache ni yangilash
      client.invalidateQueries({ queryKey: [orders] });
    },
  });

  const createTransferBatch = useMutation({
    mutationFn: (data: { orderIds: string[] }) =>
      api.post(API_ENDPOINTS.BRANCHES.TRANSFER_BATCHES, data).then((res) => res.data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [orders] });
    },
  });

  const useGetTodayOrders = (params?: any, enabled: boolean = true) =>
    useQuery({ ...todayMarketsQueryOptions(params), enabled });

  const useGetTodayOrdersByMarket = (
    marketId: string | number,
    params?: unknown,
    enabled: boolean = true,
  ) =>
    useQuery({
      queryKey: [orders, marketId, params],
      queryFn: () =>
        api.get(API_ENDPOINTS.ORDERS.MARKET_NEW(marketId), { params }).then((res) => res.data),
      enabled: enabled && Boolean(marketId),
    });

  const useGetOrderById = (
    orderId: string,
    enabled: boolean = true,
    refetchInterval?: (data: unknown) => number | false,
  ) =>
    useQuery({
      queryKey: [orders, orderId],
      queryFn: () => api.get(API_ENDPOINTS.ORDERS.BY_ID(orderId)).then((res) => res.data),
      enabled: enabled && Boolean(orderId),
      refetchInterval: refetchInterval ? (query) => refetchInterval(query.state.data) : undefined,
      // Tafsilot sahifasi xatoni o'zi ko'rsatadi (D-13: 404 — «Buyurtma topilmadi», boshqasi — «Qayta urinish»),
      // global xabar takrorlanmaydi. 404 qayta so'ralmaydi — ilova sukuti (`shared/lib/queryRetry.ts`).
      meta: { silentError: true },
    });

  // `GET orders/courier/orders`: holat, sahifa, qidiruv (ism, telefon, raqam) va sana oralig'i
  // (`startDate` / `endDate`, YYYY-MM-DD) — openapi `findCourierOrdersLegacy`.
  const useGetOrderCourier = (
    params?: { status?: string; page?: number; limit?: number; search?: string; startDate?: string; endDate?: string },
    refetchInterval?: (data: unknown) => number | false,
    options?: ListRefreshQueryOptions,
  ) => {
    const queryKey = [orders, "courier", params];
    const silentError = Boolean(options?.silentErrorWhenCached) && client.getQueryData(queryKey) !== undefined;
    return useQuery({
      queryKey,
      queryFn: () =>
        api.get(API_ENDPOINTS.ORDERS.COURIER_ORDERS, { params }).then((res) => res.data),
      refetchInterval: refetchInterval ? (query) => refetchInterval(query.state.data) : undefined,
      // Berilgan bo'lsa aniq (to'xtatilganda `false`) — global sukutga tayanmaydi.
      ...(options?.refetchOnWindowFocus !== undefined ? { refetchOnWindowFocus: options.refetchOnWindowFocus } : {}),
      ...(silentError ? { meta: { silentError: true } } : {}),
    });
  };

  /**
   * Kuryer tablari soni (`GET orders/courier/orders/counts`, faqat COURIER). Yordamchi so'rov: xato global
   * xabar bermaydi — sonlar chizilmaydi yoki eskisi qoladi. Sotish/bekor/qaytarish `[orders]` ni yangilaydi —
   * sonlar ham shu bilan qayta so'raladi.
   */
  const useGetCourierOrderCounts = (
    options?: {
      enabled?: boolean;
      refetchInterval?: number | false;
      refetchOnWindowFocus?: boolean;
    },
  ) =>
    useQuery({
      queryKey: COURIER_ORDER_COUNTS_QUERY_KEY,
      queryFn: () =>
        api.get(API_ENDPOINTS.ORDERS.COURIER_ORDER_COUNTS).then((res) => parseCourierOrderCounts(res.data)),
      enabled: options?.enabled ?? true,
      refetchInterval: options?.refetchInterval ?? false,
      // Berilgan bo'lsa aniq (to'xtatilganda `false`) — global sukutga tayanmaydi.
      ...(options?.refetchOnWindowFocus !== undefined ? { refetchOnWindowFocus: options.refetchOnWindowFocus } : {}),
      meta: { silentError: true },
    });

  // `options.enabled` — ixtiyoriy (sukut `true`): «Qabul va yaratish» tablaridagi son faqat tab ko'rinsa so'raladi.
  const useCancelledMarkets = (params?: { search?: string }, options?: { enabled?: boolean }) =>
    useQuery({
      queryKey: [orders, "markets", "cancelled", params],
      queryFn: () =>
        api.get(API_ENDPOINTS.ORDERS.MARKETS_CANCELLED, { params }).then((res) => res.data),
      enabled: options?.enabled ?? true,
    });

  const useCancelledOrdersByMarket = (marketId: string | number, options?: { enabled?: boolean }) =>
    useQuery({
      queryKey: [orders, "markets", marketId, "cancelled"],
      queryFn: () =>
        api.get(API_ENDPOINTS.ORDERS.MARKET_CANCELLED(marketId)).then((res) => res.data),
      enabled: (options?.enabled ?? true) && Boolean(marketId),
    });

  const updateNewOrder = useMutation({
    mutationFn: ({ orderId, data }: { orderId: string; data: UpdateNewOrderPayload }) =>
      api.patch(API_ENDPOINTS.ORDERS.FULL(orderId), data).then((res) => res.data),
    onSuccess: () => {
      // Barcha orders cache ni yangilash
      client.invalidateQueries({ queryKey: [orders] });
    },
  });

  const SellOrder = useMutation({
    mutationFn: ({
      orderId,
      data,
      headers,
    }: {
      orderId: string;
      data: SellOrderPayload;
      /** Qo'shimcha sarlavhalar (ommaviy yopish — `X-Request-Source`); berilmasa so'rov avvalgidek. */
      headers?: OrderActionHeaders;
    }) =>
      toOrderActionBody(data).then((body) =>
        postOrderAction(API_ENDPOINTS.ORDERS.SELL(orderId), body, headers),
      ),
    onSuccess: invalidateMoney,
  });

  const PartlySellOrder = useMutation({
    mutationFn: ({
      orderId,
      data,
    }: {
      orderId: string;
      data: {
        order_item_info: { order_item_id: string; product_id?: string; quantity: number }[];
        totalPrice: number;
        extraCost: number;
        comment: string;
        proof?: File;
      };
    }) =>
      toOrderActionBody(data).then((body) =>
        api.post(API_ENDPOINTS.ORDERS.PARTLY_SELL(orderId), body).then((res) => res.data),
      ),
    onSuccess: invalidateMoney,
  });

  // Ortga qaytarish (y2RarzlT): `target_status` — «Kutilmoqda» (sukut), «Bekor qilish», kuryerda «Bekor — jo'natilgan».
  const RollbackOrder = useMutation({
    mutationFn: ({ orderId, targetStatus }: { orderId: string; targetStatus: RollbackTarget }) =>
      api.post(API_ENDPOINTS.ORDERS.ROLLBACK(orderId), { target_status: targetStatus }).then((res) => res.data),
    onSuccess: invalidateMoney,
  });

  const SendToPost = useMutation({
    mutationFn: (order_ids: string[]) =>
      api.post(API_ENDPOINTS.POSTS.CANCEL, { order_ids }).then((res) => res.data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [orders] });
    },
  });

  const handoverCancelledOrders = useMutation({
    mutationFn: ({
      marketId,
      orderIds,
      authorizationToken,
      manualOverrides,
    }: {
      marketId: string | number;
      orderIds: string[];
      authorizationToken?: string;
      manualOverrides?: Array<{ order_id: string; reason: string }>;
    }) =>
      api
        .post(API_ENDPOINTS.ORDERS.MARKET_CANCELLED_HANDOVER(marketId), {
          order_ids: orderIds,
          ...(authorizationToken ? { authorization_token: authorizationToken } : {}),
          ...(manualOverrides?.length ? { manual_overrides: manualOverrides } : {}),
        })
        .then((res) => res.data),
    onSuccess: (_data, variables) => {
      client.invalidateQueries({ queryKey: [orders] });
      client.invalidateQueries({ queryKey: [orders, "markets", "cancelled"] });
      client.invalidateQueries({ queryKey: [orders, "markets", variables.marketId, "cancelled"] });
    },
  });

  const generateCancelledMarketQr = useMutation({
    mutationFn: (marketId: string | number) =>
      api.post(API_ENDPOINTS.ORDERS.MARKET_CANCELLED_QR(marketId)).then((res) => res.data),
  });

  const scanMarketCancelledQr = useMutation({
    mutationFn: (qrToken: string) =>
      api.post(API_ENDPOINTS.SCAN.MARKET_CANCELLED, { qr_token: qrToken }).then((res) => res.data),
  });

  const CancelOrder = useMutation({
    mutationFn: ({
      orderId,
      data,
      headers,
    }: {
      orderId: string;
      data: CancelOrderPayload;
      /** Qo'shimcha sarlavhalar (ommaviy yopish — `X-Request-Source`); berilmasa so'rov avvalgidek. */
      headers?: OrderActionHeaders;
    }) =>
      toOrderActionBody(data).then((body) =>
        postOrderAction(API_ENDPOINTS.ORDERS.CANCEL(orderId), body, headers),
      ),
    onSuccess: invalidateMoney,
  });

  const deleteOrder = useMutation({
    mutationFn: (orderId: string) =>
      api.delete(API_ENDPOINTS.ORDERS.BY_ID(orderId)).then((res) => res.data),
    onSuccess: () => {
      // Barcha orders cache ni yangilash
      client.invalidateQueries({ queryKey: [orders] });
    },
  });

  return {
    createReceiveOrder,
    createTransferBatch,
    useGetTodayOrders,
    useGetTodayOrdersByMarket,
    useGetOrderById,
    useGetOrderCourier,
    useGetCourierOrderCounts,
    useCancelledMarkets,
    useCancelledOrdersByMarket,
    SendToPost,
    generateCancelledMarketQr,
    scanMarketCancelledQr,
    handoverCancelledOrders,
    RollbackOrder,
    updateNewOrder,
    deleteOrder,
    SellOrder,
    PartlySellOrder,
    CancelOrder,
    useExtraCostApprovals,
    useAutoApprovedExtraCostApprovals,
    approveExtraCostApproval,
    rejectExtraCostApproval,
  };
};
