import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";
import { useSelector } from "react-redux";
import type { RootState } from "../../app/config/store";
import { getCurrentBranchId } from "../../shared/lib/currentBranch";

// ─── Query Keys ───────────────────────────────────────────────────────────────
const MAILS_KEY = "mails";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Region {
  id: string;
  name: string;
  sato_code: string;
}

export interface District {
  id: string;
  name: string;
  sato_code: string;
  region_id: string;
  assigned_region: string;
  region?: Region;
  assignedToRegion?: Region;
  createdAt: string;
  updatedAt: string;
}

export interface RegionWithDistricts extends Region {
  districts: District[];
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  product_id: string;
  order_id: string;
  quantity: number;
  createdAt: string;
  updatedAt: string;
  product?: {
    id: string;
    name: string;
    image_url?: string | null;
  };
}

export interface Market {
  id: string;
  name: string;
  phone_number: string;
  extra_number: string | null;
  username: string;
  salary: number;
  payment_day: string | null;
  role: string;
  status: string;
  tariff_home: number;
  tariff_center: number;
  add_order: boolean;
  default_tariff: string | null;
  createdAt: string;
  updatedAt: string;
  is_deleted: boolean;
}

export interface Customer {
  id: string;
  name: string;
  phone_number: string;
  extra_number: string | null;
  username: string;
  salary: number;
  payment_day: string | null;
  role: string;
  status: string;
  tariff_home: number | null;
  tariff_center: number | null;
  add_order: boolean;
  default_tariff: string | null;
  createdAt: string;
  updatedAt: string;
  is_deleted: boolean;
}

export type OrderStatus =
  | "new"
  | "received"
  | "waiting"
  | "on the road"
  | "delivered"
  | "cancelled"
  | "cancelled (sent)";
export type WhereDeliver = "address" | "center";

export interface PostOrder {
  id: string;
  createdAt: string;
  updatedAt: string;
  isDeleted?: boolean;
  market_id: string;
  customer_id: string;
  product_quantity: number;
  where_deliver: WhereDeliver;
  total_price: number;
  to_be_paid: number;
  paid_amount: number;
  status: OrderStatus;
  comment: string | null;
  operator: string | null;
  post_id: string | null;
  canceled_post_id?: string | null;
  sold_at?: string | null;
  district_id: string;
  region_id: string;
  address: string | null;
  qr_code_token: string | null;
  external_id?: string | null;
  deleted: boolean;
  items: OrderItem[];
  market?: Market;
  customer?: Customer;
  district?: District;
  region?: RegionWithDistricts;
}

export interface HomeOrders {
  homeOrders: number;
  homeOrdersTotalPrice: number;
}

export interface CenterOrders {
  centerOrders: number;
  centerOrdersTotalPrice: number;
}

export interface MailDetailData {
  allOrdersByPostId: PostOrder[];
  homeOrders: HomeOrders;
  centerOrders: CenterOrders;
}

export interface MailDetailResponse {
  statusCode: number;
  message: string;
  data: MailDetailData;
}

export interface RefusedMailDetailResponse {
  statusCode: number;
  message: string;
  data: PostOrder[];
}

export interface PaginatedPostsResponse {
  statusCode: number;
  message: string;
  data: {
    data: MailItem[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
  };
}

interface GetOldMailsParams {
  page?: number;
  limit?: number;
  region_id?: string;
  courier_id?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

type ManagerPostStatus = "new" | "sent" | "received" | "canceled" | "canceled_received";

export const BRANCH_TRANSFER_BATCH_STATUS = {
  PENDING: "PENDING",
  SENT: "SENT",
  RECEIVED: "RECEIVED",
  CANCELLED: "CANCELLED",
} as const;

export type BranchTransferBatchStatus =
  (typeof BRANCH_TRANSFER_BATCH_STATUS)[keyof typeof BRANCH_TRANSFER_BATCH_STATUS];

// ─── Mail list item (post/new, post/old, post/rejected) ───────────────────────
export interface MailItem {
  id: string;
  request_id?: string;
  order_id?: string;
  post_id?: string;
  createdAt: string;
  updatedAt: string;
  courier_id: string;
  post_total_price: number;
  order_quantity: number;
  qr_code_token: string;
  region_id: string;
  region: Region;
  courier?: {
    id?: string;
    name?: string;
    phone_number?: string;
  } | null;
  customer?: {
    id?: string;
    name?: string;
    phone_number?: string;
    extra_number?: string | null;
  } | null;
  district?: {
    id?: string;
    name?: string;
  } | null;
  action?: string;
  status: string;
}

const toText = (value: unknown, fallback = ""): string => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return fallback;
};

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

// ─── Pochta → Qaytarish (kuryer qaytarish so'rovlari) ─────────────────────────
// Backend: data = { total, scope: { type: "HQ" | "BRANCH", branch_id }, groups: [
//   { courier, courier_id, orders: [OrderRow + customer/district/market] } ] }.
// Har bir so'rov — bitta buyurtma; approve/reject aynan { order_ids } oladi
// (gateway ValidationPipe boshqa kalitni 400 bilan qaytaradi).
export interface ReturnRequestActionPayload {
  order_ids: string[];
}

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : null;

const mapReturnOrderToMailItem = (
  order: UnknownRecord,
  group: UnknownRecord,
  destination: "branch" | "center",
): MailItem => {
  const courier = asRecord(group.courier);
  const customer = asRecord(order.customer);
  const district = asRecord(order.district);
  const region = asRecord(district?.region) ?? asRecord(order.region);
  const orderId = toText(order.id);
  const regionId = toText(region?.id ?? order.region_id);
  const createdAt = toText(order.createdAt ?? order.created_at, new Date().toISOString());

  return {
    id: orderId,
    request_id: orderId,
    order_id: orderId,
    post_id: toText(order.post_id),
    createdAt,
    updatedAt: toText(order.updatedAt ?? order.updated_at, createdAt),
    courier_id: toText(group.courier_id ?? courier?.id ?? order.holder_courier_id),
    post_total_price: toNumber(order.total_price),
    order_quantity: 1,
    qr_code_token: toText(order.qr_code_token),
    region_id: regionId,
    region: {
      id: regionId,
      name: toText(region?.name),
      sato_code: toText(region?.sato_code),
    },
    courier: courier
      ? {
          id: toText(courier.id),
          name: toText(courier.name ?? courier.full_name ?? courier.username),
          phone_number: toText(courier.phone_number ?? courier.phone),
        }
      : null,
    customer: customer
      ? {
          id: toText(customer.id),
          name: toText(customer.name ?? customer.full_name ?? customer.username),
          phone_number: toText(customer.phone_number ?? customer.phone),
          extra_number: typeof customer.extra_number === "string" ? customer.extra_number : null,
        }
      : null,
    district: district ? { id: toText(district.id), name: toText(district.name) } : null,
    action: destination,
    status: toText(order.status),
  };
};

export const toReturnRequestsMailResponse = (payload: unknown): PaginatedPostsResponse => {
  const body = asRecord(payload);
  const container = Array.isArray(body?.groups) ? body : asRecord(body?.data);
  const groups = Array.isArray(container?.groups) ? container.groups : [];
  // Eski backend `scope` bermaydi — o'shanda markaz (HQ) deb ko'rsatiladi.
  const destination = toText(asRecord(container?.scope)?.type).toUpperCase() === "BRANCH" ? "branch" : "center";

  const items = groups.flatMap((rawGroup) => {
    const group = asRecord(rawGroup);
    if (!group) return [];
    const orders = Array.isArray(group.orders) ? group.orders : [];
    return orders
      .map(asRecord)
      .filter((order): order is UnknownRecord => order !== null)
      .map((order) => mapReturnOrderToMailItem(order, group, destination))
      .filter((item) => item.id);
  });

  return {
    statusCode: 200,
    message: "ok",
    data: {
      data: items,
      total: items.length,
      page: 1,
      totalPages: 1,
      limit: items.length,
    },
  };
};

// ─── Hooks ────────────────────────────────────────────────────────────────────
export const useMails = () => {
  const queryClient = useQueryClient();
  const role = useSelector((state: RootState) => state.role.role);
  const branchId = useSelector(getCurrentBranchId);
  const isManagerRole = role === "manager";

  const getManagerScopedPosts = (
    status?: ManagerPostStatus,
    params?: GetOldMailsParams,
  ) =>
    api
      .get(API_ENDPOINTS.POSTS.BASE, {
        params: {
          page: params?.page ?? 1,
          limit: params?.limit ?? 8,
          ...(status ? { status } : {}),
          ...(branchId ? { branch_id: branchId } : {}),
          ...(params?.region_id ? { region_id: params.region_id } : {}),
          ...(params?.courier_id ? { courier_id: params.courier_id } : {}),
          ...(params?.startDate ? { startDate: params.startDate } : {}),
          ...(params?.endDate ? { endDate: params.endDate } : {}),
        },
      })
      .then((res) => res.data);

  const useGetNewMails = (options?: { enabled?: boolean }) =>
    useQuery({
      queryKey: [MAILS_KEY, "new", role, branchId],
      queryFn: () =>
        isManagerRole
          ? getManagerScopedPosts("sent")
          : api.get(API_ENDPOINTS.POSTS.NEW).then((res) => res.data),
      enabled: options?.enabled ?? true,
    });

  const useGetNewMailsCourier = (options?: { enabled?: boolean }) =>
    useQuery({
      queryKey: [MAILS_KEY, "new"],
      queryFn: () => api.get(API_ENDPOINTS.POSTS.ON_THE_ROAD).then((res) => res.data),
      enabled: options?.enabled ?? true,
    });

  const useGetTodayMailsCourier = (id: string) =>
    useQuery({
      queryKey: [MAILS_KEY, "new", id],
      queryFn: () => api.get(API_ENDPOINTS.POSTS.ORDERS_BY_POST_ID(id)).then((res) => res.data),
      enabled: !!id,
      retry: false,
    });

  const useGetRefusedMailsCourierByPostId = (id: string) =>
    useQuery({
      queryKey: [MAILS_KEY, "refused-detail", id],
      queryFn: () => api.get(API_ENDPOINTS.POSTS.REJECTED_ORDERS_BY_POST_ID(id)).then((res) => res.data),
      enabled: !!id,
      retry: false,
    });

  const useGetRefusedMails = (options?: { enabled?: boolean }) =>
    useQuery({
      queryKey: [MAILS_KEY, "refused", role, branchId],
      queryFn: () => api.get(API_ENDPOINTS.POSTS.REJECTED).then((res) => res.data),
      enabled: options?.enabled ?? true,
    });

  // Backend sahifalamaydi: doiradagi (filial yoki HQ) barcha so'rovlar
  // kuryer bo'yicha guruhlab qaytadi — page/limit yuborilmaydi.
  const useGetReturnMails = () =>
    useQuery<PaginatedPostsResponse>({
      queryKey: [MAILS_KEY, "return", role, branchId],
      queryFn: () =>
        api
          .get(API_ENDPOINTS.POSTS.RETURN_REQUESTS_LIST)
          .then((res) => toReturnRequestsMailResponse(res.data)),
    });

  // Tasdiqlash buyurtmalarni omborga qaytaradi va kuryer pochtasini yopishi
  // mumkin. Backend buyurtmalarni ketma-ket yozadi (atomik emas) — xato
  // bo'lsa ham bir qismi o'tgan bo'lishi mumkin, shuning uchun ro'yxatlar
  // har holda (onSettled) yangilanadi.
  const invalidateAfterReturnAction = () => {
    queryClient.invalidateQueries({ queryKey: [MAILS_KEY, "return"] });
    queryClient.invalidateQueries({ queryKey: [MAILS_KEY, "old"] });
    queryClient.invalidateQueries({ queryKey: [MAILS_KEY, "new"] });
    queryClient.invalidateQueries({ queryKey: ["orders"] });
  };

  const approveReturnRequests = useMutation({
    mutationFn: (payload: ReturnRequestActionPayload) =>
      api
        .post(API_ENDPOINTS.POSTS.RETURN_REQUESTS_APPROVE, { order_ids: payload.order_ids })
        .then((res) => res.data),
    onSettled: invalidateAfterReturnAction,
  });

  const rejectReturnRequests = useMutation({
    mutationFn: (payload: ReturnRequestActionPayload) =>
      api
        .post(API_ENDPOINTS.POSTS.RETURN_REQUESTS_REJECT, { order_ids: payload.order_ids })
        .then((res) => res.data),
    onSettled: invalidateAfterReturnAction,
  });

  const useGetRefusedMailsCourier = (options?: { enabled?: boolean }) =>
    useQuery({
      queryKey: [MAILS_KEY, "refused-courier"],
      queryFn: () => api.get(API_ENDPOINTS.POSTS.COURIER_REJECTED).then((res) => res.data),
      enabled: options?.enabled ?? true,
    });

  const useGetOldMails = (
    isCourier = false,
    params?: GetOldMailsParams,
    options?: { enabled?: boolean },
  ) =>
    useQuery<PaginatedPostsResponse>({
      queryKey: [
        MAILS_KEY,
        "old",
        role,
        branchId,
        isCourier ? "courier" : "default",
        params,
      ],
      queryFn: () =>
        isManagerRole
          ? getManagerScopedPosts(
              params?.status as ManagerPostStatus | undefined,
              params,
            )
          : api
            .get(isCourier ? API_ENDPOINTS.POSTS.COURIER_OLD : API_ENDPOINTS.POSTS.BASE, {
              params: {
                page: params?.page ?? 1,
                limit: params?.limit ?? 8,
                ...(params?.region_id ? { region_id: params.region_id } : {}),
                ...(params?.courier_id ? { courier_id: params.courier_id } : {}),
                ...(params?.status ? { status: params.status } : {}),
                ...(params?.startDate ? { startDate: params.startDate } : {}),
                ...(params?.endDate ? { endDate: params.endDate } : {}),
              },
            })
            .then((res) => res.data),
      enabled: options?.enabled ?? true,
    });

  return {
    useGetNewMails,
    useGetRefusedMails,
    useGetReturnMails,
    approveReturnRequests,
    rejectReturnRequests,
    useGetOldMails,
    useGetNewMailsCourier,
    useGetTodayMailsCourier,
    useGetRefusedMailsCourier,
    useGetRefusedMailsCourierByPostId
  };
};

export const useMailDetail = (postId: string) =>
  useQuery<MailDetailResponse>({
    queryKey: [MAILS_KEY, "detail", postId],
    queryFn: () => api.get(API_ENDPOINTS.POSTS.ORDERS_BY_POST_ID(postId)).then((res) => res.data),
    enabled: !!postId,
    retry: false,
  });

export const useRefusedMailDetail = (postId: string) =>
  useQuery<RefusedMailDetailResponse>({
    queryKey: [MAILS_KEY, "refused-detail", postId],
    queryFn: () => api.get(API_ENDPOINTS.POSTS.REJECTED_ORDERS_BY_POST_ID(postId)).then((res) => res.data),
    enabled: !!postId,
    retry: false,
  });

// ─── Courier Types ────────────────────────────────────────────────────────────
export interface CourierItem {
  id: string;
  name: string;
  phone_number: string;
  username: string;
  status: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export interface CouriersByRegionResponse {
  statusCode: number;
  message: string;
  data: {
    items: CourierItem[];
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

// ─── Send Post Payload ────────────────────────────────────────────────────────
export interface SendPostPayload {
  orderIds: string[];
  courierId: string;
}

export interface DispatchPostToBranchPayload {
  destinationBranchId: string;
  orderIds: string[];
}

export const fetchCouriersByRegion = (regionId: string) =>
  api
    .get(API_ENDPOINTS.COURIERS.BY_REGION(regionId), {
      params: { status: "active", limit: 100 },
    })
    .then((res) => res.data as CouriersByRegionResponse);

// ─── GET: Viloyat bo'yicha courierlar ─────────────────────────────────────────
export const useGetCouriersByRegion = (regionId: string, enabled: boolean) =>
  useQuery<CouriersByRegionResponse>({
    queryKey: [MAILS_KEY, "couriers-by-region", regionId],
    queryFn: () => fetchCouriersByRegion(regionId),
    enabled: !!regionId && enabled,
    staleTime: 0,
  });

// ─── PATCH: Pochtani courierga jo'natish ──────────────────────────────────────
export const useSendPost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      postId,
      payload,
    }: {
      postId: string;
      payload: SendPostPayload;
    }) => api.patch(API_ENDPOINTS.POSTS.BY_ID(postId), payload).then((res) => res.data),
    onSuccess: (_data, { postId }) => {
      queryClient.invalidateQueries({
        queryKey: [MAILS_KEY, "detail", postId],
      });
    },
  });
};

export const useDispatchPostToBranch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      postId,
      payload,
    }: {
      postId: string;
      payload: DispatchPostToBranchPayload;
    }) =>
      api
        .post(API_ENDPOINTS.BRANCHES.POST_DISPATCH(postId), {
          destination_branch_id: payload.destinationBranchId,
          order_ids: payload.orderIds,
        })
        .then((res) => res.data),
    onSuccess: (_data, { postId }) => {
      queryClient.invalidateQueries({
        queryKey: [MAILS_KEY, "detail", postId],
      });
    },
  });
};

// ─── Receive Post Payload ─────────────────────────────────────────────────────
export interface ReceivePostPayload {
  order_ids: string[];
}

// ─── PATCH: Courier tomonidan pochtani qabul qilish ──────────────────────────
export const useReceivePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      postId,
      payload,
    }: {
      postId: string;
      payload: ReceivePostPayload;
    }) => api.patch(API_ENDPOINTS.POSTS.RECEIVE(postId), payload).then((res) => res.data),
    onSuccess: (_data, { postId }) => {
      queryClient.invalidateQueries({
        queryKey: [MAILS_KEY, "detail", postId],
      });
    },
  });
};

export const useReceiveCanceledPost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      postId,
      payload,
    }: {
      postId: string;
      payload: ReceivePostPayload;
    }) => api.post(API_ENDPOINTS.POSTS.CANCEL_RECEIVE(postId), payload).then((res) => res.data),
    onSuccess: (_data, { postId }) => {
      queryClient.invalidateQueries({
        queryKey: [MAILS_KEY, "refused-detail", postId],
      });
      queryClient.invalidateQueries({
        queryKey: [MAILS_KEY, "refused"],
      });
      queryClient.invalidateQueries({
        queryKey: [MAILS_KEY, "refused-courier"],
      });
      queryClient.invalidateQueries({
        queryKey: ["orders"],
      });
      queryClient.invalidateQueries({
        queryKey: ["orders", "markets", "cancelled"],
      });
    },
  });
};
