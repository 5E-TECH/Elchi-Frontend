import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/api";

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

export type OrderStatus = "new" | "received" | "delivered" | "cancelled";
export type WhereDeliver = "address" | "center";

export interface PostOrder {
  id: string;
  createdAt: string;
  updatedAt: string;
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
  district_id: string;
  region_id: string;
  address: string | null;
  qr_code_token: string | null;
  deleted: boolean;
  items: OrderItem[];
  market: Market;
  customer: Customer;
  district: District;
  region: RegionWithDistricts;
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
  status: string;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────
export const useMails = () => {
  const getNewMails = () =>
    useQuery({
      queryKey: [MAILS_KEY, "new"],
      queryFn: () => api.get("post/new").then((res) => res.data),
    });

  const getNewMailsCourier = () =>
    useQuery({
      queryKey: [MAILS_KEY, "new"],
      queryFn: () => api.get("post/on-the-road").then((res) => res.data),
    });

  const getTodayMailsCourier = (id: string) =>
    useQuery({
      queryKey: [MAILS_KEY, "new"],
      queryFn: () => api.get(`post/orders/${id}`).then((res) => res.data),
    });

  const getRefusedMails = () =>
    useQuery({
      queryKey: [MAILS_KEY, "refused"],
      queryFn: () => api.get("post/rejected").then((res) => res.data),
    });

  const getRefusedMailsCourier = () =>
    useQuery({
      queryKey: [MAILS_KEY, "refused-courier"],
      queryFn: () => api.get("post/courier/rejected").then((res) => res.data),
    });

  const getOldMails = () =>
    useQuery({
      queryKey: [MAILS_KEY, "old"],
      queryFn: () => api.get("post/old").then((res) => res.data),
    });

  return {
    getNewMails,
    getRefusedMails,
    getOldMails,
    getNewMailsCourier,
    getTodayMailsCourier,
    getRefusedMailsCourier
  };
};

export const useMailDetail = (postId: string) =>
  useQuery<MailDetailResponse>({
    queryKey: [MAILS_KEY, "detail", postId],
    queryFn: () => api.get(`post/orders/${postId}`).then((res) => res.data),
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

// ─── GET: Viloyat bo'yicha courierlar ─────────────────────────────────────────
export const useGetCouriersByRegion = (regionId: string, enabled: boolean) =>
  useQuery<CouriersByRegionResponse>({
    queryKey: [MAILS_KEY, "couriers-by-region", regionId],
    queryFn: () =>
      api
        .get(`couriers/region/${regionId}`, {
          params: { status: "active", limit: 100 },
        })
        .then((res) => res.data),
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
    }) => api.patch(`post/${postId}`, payload).then((res) => res.data),
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
    }) => api.patch(`post/receive/${postId}`, payload).then((res) => res.data),
    onSuccess: (_data, { postId }) => {
      queryClient.invalidateQueries({
        queryKey: [MAILS_KEY, "detail", postId],
      });
    },
  });
};
