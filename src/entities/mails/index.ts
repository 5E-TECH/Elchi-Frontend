import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";
import { useSelector } from "react-redux";
import type { RootState } from "../../app/config/store";

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
  status: string;
}

interface TransferBatchListResponse {
  data: {
    data?: any[];
    items?: any[];
    total?: number;
    page?: number;
    totalPages?: number;
    limit?: number;
    meta?: {
      total?: number;
      page?: number;
      totalPages?: number;
      limit?: number;
    };
  };
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

const mapTransferBatchToMailItem = (batch: any): MailItem => {
  const sourceBranch = batch?.source_branch ?? batch?.from_branch ?? batch?.sourceBranch ?? batch?.fromBranch;
  const destinationBranch = batch?.destination_branch ?? batch?.to_branch ?? batch?.destinationBranch ?? batch?.toBranch;
  const region = batch?.region;
  const regionName = toText(
    region?.name ??
      destinationBranch?.name ??
      destinationBranch?.title ??
      sourceBranch?.name ??
      sourceBranch?.title,
    "Filial",
  );
  const regionId = toText(region?.id ?? batch?.target_region_id ?? destinationBranch?.id ?? sourceBranch?.id ?? "branch");

  return {
    id: toText(batch?.id ?? batch?._id),
    createdAt: toText(batch?.createdAt ?? batch?.created_at, new Date().toISOString()),
    updatedAt: toText(batch?.updatedAt ?? batch?.updated_at ?? batch?.createdAt, new Date().toISOString()),
    courier_id: "",
    post_total_price: toNumber(batch?.total_price ?? batch?.totalPrice ?? batch?.amount),
    order_quantity: toNumber(
      batch?.order_count ??
        batch?.orders_count ??
        batch?.ordersCount ??
        batch?.items?.length ??
        batch?.orders?.length,
    ),
    qr_code_token: toText(batch?.qr_code_token ?? batch?.qrCodeToken ?? batch?.token),
    region_id: regionId,
    region: {
      id: regionId,
      name: regionName,
      sato_code: toText(region?.sato_code),
    },
    status: toText(batch?.status),
  };
};

const mapReturnRequestToMailItem = (request: any): MailItem => {
  const post = request?.post ?? request?.mail ?? request?.batch ?? request;
  const region = post?.region ?? request?.region;
  const orders = post?.orders ?? request?.orders ?? post?.allOrdersByPostId ?? request?.allOrdersByPostId;
  const orderCount =
    request?.order_quantity ??
    request?.order_count ??
    request?.orders_count ??
    post?.order_quantity ??
    post?.order_count ??
    post?.orders_count ??
    (Array.isArray(orders) ? orders.length : undefined);
  const totalPrice =
    request?.post_total_price ??
    request?.total_price ??
    request?.totalPrice ??
    post?.post_total_price ??
    post?.total_price ??
    post?.totalPrice;
  const regionId = toText(region?.id ?? post?.region_id ?? request?.region_id, "return-region");

  return {
    id: toText(post?.id ?? request?.post_id ?? request?.postId ?? request?.id ?? request?._id),
    createdAt: toText(post?.createdAt ?? post?.created_at ?? request?.createdAt ?? request?.created_at, new Date().toISOString()),
    updatedAt: toText(post?.updatedAt ?? post?.updated_at ?? request?.updatedAt ?? request?.updated_at, new Date().toISOString()),
    courier_id: toText(post?.courier_id ?? request?.courier_id),
    post_total_price: toNumber(totalPrice),
    order_quantity: toNumber(orderCount),
    qr_code_token: toText(post?.qr_code_token ?? post?.qrCodeToken ?? request?.qr_code_token ?? request?.qrCodeToken),
    region_id: regionId,
    region: {
      id: regionId,
      name: toText(region?.name ?? region?.title, "Qaytarish"),
      sato_code: toText(region?.sato_code),
    },
    status: toText(request?.status ?? post?.status, "return"),
  };
};

const toPaginatedMailResponse = (
  payload: TransferBatchListResponse | any,
  mapItem: (item: any) => MailItem = mapTransferBatchToMailItem,
): PaginatedPostsResponse => {
  const container = payload?.data ?? payload;
  const rawItems = container?.data ?? container?.items ?? [];
  const items = Array.isArray(rawItems) ? rawItems.map(mapItem).filter((item) => item.id) : [];
  const total = toNumber(container?.meta?.total ?? container?.total, items.length);
  const page = toNumber(container?.meta?.page ?? container?.page, 1);
  const totalPages = toNumber(container?.meta?.totalPages ?? container?.totalPages, 1);
  const limit = toNumber(container?.meta?.limit ?? container?.limit, 8);

  return {
    statusCode: 200,
    message: "ok",
    data: {
      data: items,
      total,
      page,
      totalPages,
      limit,
    },
  };
};

// ─── Hooks ────────────────────────────────────────────────────────────────────
export const useMails = () => {
  const role = useSelector((state: RootState) => state.role.role);
  const branchId = useSelector((state: RootState) => state.user.user?.branch_id);
  const isManagerRole = role === "manager";

  const getManagerScopedPosts = (
    status?: "new" | "sent" | "received" | "canceled" | "canceled_received",
    params?: GetOldMailsParams,
  ) =>
    api
      .get(API_ENDPOINTS.POSTS.BASE, {
        params: {
          page: params?.page ?? 1,
          limit: params?.limit ?? 8,
          ...(status ? { status } : {}),
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
    });

  const useGetRefusedMailsCourierByPostId = (id: string) =>
    useQuery({
      queryKey: [MAILS_KEY, "refused-detail", id],
      queryFn: () => api.get(API_ENDPOINTS.POSTS.REJECTED_ORDERS_BY_POST_ID(id)).then((res) => res.data),
      enabled: !!id,
    });

  const useGetRefusedMails = (options?: { enabled?: boolean }) =>
    useQuery({
      queryKey: [MAILS_KEY, "refused", role, branchId],
      queryFn: () =>
        isManagerRole
          ? getManagerScopedPosts("canceled")
          : api.get(API_ENDPOINTS.POSTS.REJECTED).then((res) => res.data),
      enabled: options?.enabled ?? true,
    });

  const useGetReturnMails = (params?: GetOldMailsParams) =>
    useQuery<PaginatedPostsResponse>({
      queryKey: [MAILS_KEY, "return", role, branchId, params?.page ?? 1, params?.limit ?? 8],
      queryFn: () =>
        api
          .get(API_ENDPOINTS.POSTS.RETURN_REQUESTS_LIST, {
            params: {
              page: params?.page ?? 1,
              limit: params?.limit ?? 8,
            },
          })
          .then((res) => toPaginatedMailResponse(res.data, mapReturnRequestToMailItem)),
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
              params?.status as "new" | "sent" | "received" | "canceled" | "canceled_received" | undefined,
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
  });

export const useRefusedMailDetail = (postId: string) =>
  useQuery<RefusedMailDetailResponse>({
    queryKey: [MAILS_KEY, "refused-detail", postId],
    queryFn: () => api.get(API_ENDPOINTS.POSTS.REJECTED_ORDERS_BY_POST_ID(postId)).then((res) => res.data),
    enabled: !!postId,
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
    },
  });
};
