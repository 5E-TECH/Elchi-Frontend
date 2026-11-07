import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";
import { useSelector } from "react-redux";
import type { RootState } from "../../app/config/store";
import { getCurrentBranchId } from "../../shared/lib/currentBranch";
import { silentErrorMeta, type SilentErrorOption } from "../../shared/lib/queryErrorEvents";
import type { PostOrderMembership } from "./lib/postHistory";

export {
  getPostOrderLocation,
  isHistoryView,
  isInPostNow,
  type PostOrderLocation,
  type PostOrderLocationKind,
  type PostOrderMembership,
} from "./lib/postHistory";

// ─── Query Keys ───────────────────────────────────────────────────────────────
const MAILS_KEY = "mails";

/** Menejer «Bugungi» ro'yxati bitta so'rovda (`GET post?status=sent`): backend sahifa chegarasi — 100. */
const MANAGER_TODAY_LIMIT = 100;

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Region {
  id: string;
  name: string;
  sato_code: string;
}

/**
 * Pochta detalidagi buyurtma tumani — backend oq ro'yxati (VfgcnxDa, FRONTEND_CHANGELOG 2026-10-14):
 * `id/name/sato_code/region_id/assigned_region/region/assignedToRegion`.
 */
export interface District {
  id: string;
  name: string;
  sato_code: string;
  region_id: string;
  assigned_region: string;
  region?: Region;
  assignedToRegion?: Region;
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
  /** Hamkor buyurtmasi: katalogda yo'q mahsulot nomi (chekda `product.name` dan keyin). */
  product_name?: string | null;
}

/**
 * Pochta detalidagi market — faqat oq ro'yxat (VfgcnxDa): `id/name/phone_number`. `market_tg_token`,
 * `username`, `salary`, `tariff_*`, `commission_*`, `settings` backenddan hech qachon kelmaydi — UI ham o'qimaydi.
 */
export interface Market {
  id: string;
  name: string;
  phone_number: string;
}

/** Pochta detalidagi mijoz — oq ro'yxat (VfgcnxDa): `id/name/phone_number/extra_number/address/district_id/region_id`. */
export interface Customer {
  id: string;
  name: string;
  phone_number: string;
  extra_number: string | null;
  address?: string | null;
  district_id?: string | null;
  region_id?: string | null;
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
  /** «EL-100081» — BE-1 (HJ5sLHiz) dan keyin pochta qatorlarida ham keladi; yo'q — chek `№{id}` chiqaradi. */
  order_number?: string | null;
  createdAt: string;
  updatedAt: string;
  isDeleted?: boolean;
  market_id: string;
  customer_id: string;
  product_quantity: number;
  where_deliver: WhereDeliver;
  total_price: number;
  /** Sof kuryerning eski pochtasida boshqa kuryerdagi sobiq a'zo qatoridan olib tashlanadi (#618) — yo'q bo'lishi mumkin. */
  to_be_paid?: number;
  paid_amount?: number;
  /** Mijoz onlayn to'lagan qism; kelmasa — 0 (chekdagi summa = `total_price − paid_online_amount`). */
  paid_online_amount?: number | null;
  status: OrderStatus;
  comment: string | null;
  operator: string | null;
  /** T7: chekdagi «Muammo bo'lsa» — viloyat logisti yoki umumiy raqam. */
  problem_contacts?: { name?: string | null; phone?: string | null; source?: string | null }[] | null;
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
  /**
   * Pochta tarixi (#618) — faqat `view=all` qatorlarida: `in_post_now` (`false` — sobiq a'zo), kirgan / chiqqan vaqt,
   * buyurtmaning hozirgi pochtalari. `view=current` javobida yo'q (o'qish — `lib/postHistory`).
   */
  in_post_now?: boolean | null;
  membership?: PostOrderMembership | null;
  current_post_id?: string | null;
  current_canceled_post_id?: string | null;
  /**
   * Qaytarish so'rovi bor. Jo'natilgan (`sent`) pochtada — kuryer (o'z pochtasida) yoki manzil filial menejeri
   * (o'tkazma pochtasida) «kelmagan» deb bildirgan (yoki qisman qabulda tanlamagan) buyurtma: holat «yo'lda» qoladi,
   * so'rov «Qaytarish» bo'limida ko'rib chiqiladi.
   */
  return_requested?: boolean | null;
}

export interface HomeOrders {
  homeOrders: number;
  homeOrdersTotalPrice: number;
}

export interface CenterOrders {
  centerOrders: number;
  centerOrdersTotalPrice: number;
}

export interface MailDetailPost {
  id: string;
  status: string;
  courier_id?: string | null;
  /** Faqat shu uch maydon (maxfiy maydonlarsiz); kuryer yo'q / o'chirilgan — `null`. */
  courier?: { id: string; name: string; phone_number?: string | null } | null;
  qr_code_token?: string | null;
  order_quantity?: number;
  createdAt?: string;
  branch_id?: string | null;
  /** Jo'natuvchi filial (BE-2, HJ5sLHiz) — pochta chekidagi «Qayerdan»; hali kelmaydi, kelmasa qator chiqmaydi. */
  branch?: { id: string; name: string } | null;
  /** Pochtaning o'z viloyati — sarlavha va manzil filiallari uchun birlamchi manba (router state — zaxira). */
  region_id?: string | null;
  region?: { id: string; name: string } | null;
}

/**
 * `GET post/orders/:id` ko'rinishi (#618): `current` — faqat hozir pochtadagilar; `all` — pochtaga har qachon
 * kirganlar. Berilmasa server qabul qilingan pochtaga (`received`, `canceled_received`) `all` beradi.
 */
export type MailDetailView = "current" | "all";

export interface MailDetailData {
  allOrdersByPostId: PostOrder[];
  homeOrders: HomeOrders;
  centerOrders: CenterOrders;
  /**
   * Pochtaning o'z ma'lumoti (yokjwjXG, 4YZcTTDQ) — sarlavhadagi holat badge'i,
   * raqam va sana shundan; savat faqat `status === "new"` da. Eski backendda yo'q —
   * u holda sahifa router state / buyurtmalardan oladi.
   */
  post?: MailDetailPost | null;
  /** #618: faqat `view=all` javobida `"all"`; kalit yo'q — joriy (`current`) javob. */
  view?: MailDetailView;
  /** #618: faqat `view=all` da; `true` — tarix to'liq olinmadi (ro'yxat to'liq emas). */
  history_incomplete?: boolean;
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
    /** `GET /post`, `post/courier/old-posts` (kA70Rban): so'ralgan `limit` 100 dan katta bo'lsa `true`. */
    limit_capped?: boolean;
    /** Backend bitta sahifada beradigan eng ko'p qator (100). */
    max_limit?: number;
  };
}

/**
 * Eski pochtalar so'rovi (`GET /post`, kuryerda `GET post/courier/old-posts`). Backend (YfrqN70i) viloyat,
 * kuryer, holat, sana (Toshkent kuni, `YYYY-MM-DD`) va `has_orders` ni o'zi filtrlaydi; `limit` ≤ 100.
 * Kuryer endpointi `courier_id` olmaydi (doim JWT egasi).
 */
export interface GetOldMailsParams {
  page?: number;
  limit?: number;
  region_id?: string;
  courier_id?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  /** `true` — faqat buyurtmasi bor pochtalar (`order_quantity > 0`); `has_orders=true` bo'lib ketadi. */
  has_orders?: boolean;
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
  /** Pochta filiali (`GET /post`, `post/new`, `post/rejected`; faqat id, nomi kelmaydi): jo'natilgan — qabul qiluvchi
   * filial, filial kuryerining pochtasi — o'sha filial; YANGI (jo'natilmagan) pochtada `null`. */
  branch_id?: string | null;
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
  /**
   * Faqat «Qaytarish» ro'yxatida (`GET post/return-requests/list`, HQ doirasi): so'rov filial o'tkazmasidan —
   * manzil filial menejeri «kelmagan» degan yoki qisman qabulda qolgan (kuryersiz; ega qarori 2026-11-04).
   * Kuryer so'rovida — yo'q.
   */
  return_source?: "branch_transfer";
  /** Filial o'tkazmasi so'rovida — manzil filial (`groups[].branch_id`; nomi backend bersa, aks holda bo'sh). */
  return_branch?: { id: string; name: string } | null;
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
// HQ doirasida filial o'tkazmasi so'rovlari — manzil filial bo'yicha alohida guruh:
//   { courier: null, courier_id: null, source: "branch_transfer", branch_id, orders } (2026-11-04).
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
  // Filial o'tkazmasi guruhi — kuryersiz: `holder_courier_id` ('0' / bo'sh) kuryer deb olinmaydi.
  const isBranchTransfer = toText(group.source).toLowerCase() === "branch_transfer";
  const groupBranch = asRecord(group.branch);

  return {
    id: orderId,
    request_id: orderId,
    order_id: orderId,
    post_id: toText(order.post_id),
    createdAt,
    updatedAt: toText(order.updatedAt ?? order.updated_at, createdAt),
    courier_id: isBranchTransfer ? "" : toText(group.courier_id ?? courier?.id ?? order.holder_courier_id),
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
    ...(isBranchTransfer
      ? {
          return_source: "branch_transfer" as const,
          return_branch: {
            id: toText(group.branch_id ?? groupBranch?.id),
            name: toText(groupBranch?.name ?? group.branch_name),
          },
        }
      : {}),
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

// ─── So'rovlar (kalit + queryFn bitta joyda) ─────────────────────────────────
type MailsScope = { role: string | null | undefined; branchId: string | null | undefined };

/**
 * «Bugungi» (yangi, jo'natilmagan) pochtalar — `GET post/new`. Kalit `useMails().useGetNewMails` niki bilan bir:
 * universal skaner «Pochtani jo'natish» varag'i (`pages/scan`) va «Bugungi pochtalar» ro'yxati bir kesh yozuvini
 * ulashadi. ⚠️ Menejer uchun emas: menejerda shu kalit ostida `post?status=sent&branch_id` (hook o'zi almashtiradi);
 * jo'natish rejimi menejerda yo'q (`canDispatchPostToBranch`).
 */
export const newMailsQueryOptions = ({ role, branchId }: MailsScope) => ({
  queryKey: [MAILS_KEY, "new", role, branchId] as const,
  queryFn: () => api.get(API_ENDPOINTS.POSTS.NEW).then((res) => res.data),
});

/**
 * «Rad etilgan» pochtalar (kuryerdan boshqa rollar) — `GET post/rejected`. Kalit `useGetRefusedMails` niki bilan
 * bir: universal skaner «Rad etilgan pochta» varag'i va «Rad etilgan pochtalar» ro'yxati keshni ulashadi.
 */
export const refusedMailsQueryOptions = ({ role, branchId }: MailsScope) => ({
  queryKey: [MAILS_KEY, "refused", role, branchId] as const,
  queryFn: () => api.get(API_ENDPOINTS.POSTS.REJECTED).then((res) => res.data),
});

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
          ...(params?.has_orders ? { has_orders: "true" } : {}),
        },
      })
      .then((res) => res.data);

  // Menejer «Bugungi»si — filialga kelayotgan BARCHA ochiq pochtalar (ro'yxat sahifalanmaydi, kartalar to'ri;
  // sukut `limit: 8` 9-pochtadan boshlab jimgina kesardi). 100 — backend sahifa chegarasi (`OLD_MAILS_PAGE_MAX`).
  // Parametrlar doim bir xil, shuning uchun kalit (`newMailsQueryOptions`) o'zgarmaydi.
  // `enabled` — chaqiruvchi rol shartini beradi (`post/new` faqat HQ xodimlariga: `canViewNewPosts`, anKpzwxk);
  // `silentError` — xato ro'yxat joyida chiziladi, global xabar takrorlanmaydi.
  const useGetNewMails = (options?: { enabled?: boolean } & SilentErrorOption) => {
    const query = newMailsQueryOptions({ role, branchId });
    return useQuery({
      queryKey: query.queryKey,
      queryFn: isManagerRole
        ? () => getManagerScopedPosts("sent", { page: 1, limit: MANAGER_TODAY_LIMIT })
        : query.queryFn,
      enabled: options?.enabled ?? true,
      ...silentErrorMeta(options),
    });
  };

  const useGetNewMailsCourier = (options?: { enabled?: boolean }) =>
    useQuery({
      queryKey: [MAILS_KEY, "new"],
      queryFn: () => api.get(API_ENDPOINTS.POSTS.ON_THE_ROAD).then((res) => res.data),
      enabled: options?.enabled ?? true,
    });

  const useGetRefusedMailsCourierByPostId = (id: string) =>
    useQuery({
      queryKey: [MAILS_KEY, "refused-detail", id],
      queryFn: () => api.get(API_ENDPOINTS.POSTS.REJECTED_ORDERS_BY_POST_ID(id)).then((res) => res.data),
      enabled: !!id,
      retry: false,
    });

  const useGetRefusedMails = (options?: { enabled?: boolean }) =>
    useQuery({ ...refusedMailsQueryOptions({ role, branchId }), enabled: options?.enabled ?? true });

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
    // `/returns` dagi «Qaytarish so'rovlari» (superadmin) — `entities/logistics` (`["logi-cov", "posts", …]`).
    queryClient.invalidateQueries({ queryKey: ["logi-cov", "posts"] });
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

  /**
   * Eski pochtalarning bitta sahifasi (hook emas — Excel barcha sahifalarni shu bilan yig'adi). Menejer — o'z
   * filiali (`branch_id`), kuryer — `post/courier/old-posts`, qolganlar — `GET /post`.
   */
  const fetchOldMails = (isCourier = false, params?: GetOldMailsParams): Promise<PaginatedPostsResponse> =>
    isManagerRole
      ? getManagerScopedPosts(params?.status as ManagerPostStatus | undefined, params)
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
              ...(params?.has_orders ? { has_orders: "true" } : {}),
            },
          })
          .then((res) => res.data);

  const useGetOldMails = (
    isCourier = false,
    params?: GetOldMailsParams,
    options?: {
      enabled?: boolean;
      /** Sahifa yoki filtr almashganda oldingi javob ko'rinib turadi (`isPlaceholderData`). */
      keepPreviousData?: boolean;
      /** Xato umumiy bildirishnoma bermaydi (masalan filtr varaqasidagi yordamchi son). */
      silentError?: boolean;
    },
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
      queryFn: () => fetchOldMails(isCourier, params),
      enabled: options?.enabled ?? true,
      ...(options?.keepPreviousData ? { placeholderData: keepPreviousData } : {}),
      ...(options?.silentError ? { meta: { silentError: true } } : {}),
    });

  return {
    useGetNewMails,
    useGetRefusedMails,
    useGetReturnMails,
    approveReturnRequests,
    rejectReturnRequests,
    useGetOldMails,
    fetchOldMails,
    useGetNewMailsCourier,
    useGetRefusedMailsCourier,
    useGetRefusedMailsCourierByPostId
  };
};

/**
 * Pochta tafsiloti (`GET post/orders/:id`). `view` berilsa — so'rovda ham, kesh kalitida ham (oxirgi bo'lak);
 * berilmasa — parametrsiz (server sukuti). Amal rejimlari `current` so'raydi, eski pochta (tarix) — sukut.
 * `silentError` — yordamchi so'rov (masalan rad etilgan pochtaning jo'natuvchi ma'lumoti): xato global xabar bermaydi.
 */
export const useMailDetail = (postId: string, options?: { view?: MailDetailView } & SilentErrorOption) => {
  const view = options?.view;
  return useQuery<MailDetailResponse>({
    queryKey: view ? [MAILS_KEY, "detail", postId, view] : [MAILS_KEY, "detail", postId],
    queryFn: () => {
      const url = API_ENDPOINTS.POSTS.ORDERS_BY_POST_ID(postId);
      return (view ? api.get(url, { params: { view } }) : api.get(url)).then((res) => res.data);
    },
    enabled: !!postId,
    retry: false,
    ...silentErrorMeta(options),
  });
};

/** `POST /post/delete` javobi. */
export interface DeleteOrdersFromPostResult {
  post_id: string;
  deleted: string[];
  skipped: string[];
  /** Oxirgi buyurtma o'chdi — bo'sh pochta ham o'chirildi. */
  post_deleted: boolean;
  order_quantity?: number;
  post_total_price?: number;
}

/**
 * Buyurtmalarni SHU pochtadan o'chirish (yokjwjXG). Faqat superadmin va
 * jo'natilmagan (NEW) pochta; bitta tranzaksiya — yo hammasi, yo hech biri.
 * ⚠️ `POST /post/cancel` (bekor qilinganlarni qaytarish oqimi) EMAS.
 */
export const useDeleteOrdersFromPost = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { post_id: string; order_ids: string[]; reason: string }) =>
      api.post(API_ENDPOINTS.POSTS.DELETE_ORDERS, body).then((res) => {
        const raw = (res.data?.data ?? res.data ?? {}) as Partial<DeleteOrdersFromPostResult>;
        return {
          post_id: String(raw.post_id ?? body.post_id),
          deleted: Array.isArray(raw.deleted) ? raw.deleted.map(String) : [],
          skipped: Array.isArray(raw.skipped) ? raw.skipped.map(String) : [],
          post_deleted: raw.post_deleted === true,
          order_quantity: raw.order_quantity,
          post_total_price: raw.post_total_price,
        } satisfies DeleteOrdersFromPostResult;
      }),
    onSuccess: () => {
      // Pochta ro'yxatlari, sonlar ("Markazgacha N ta · summa") va buyurtmalar.
      queryClient.invalidateQueries({ queryKey: [MAILS_KEY] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
};

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
      // Jo'natilgan pochta «Bugungi»dan chiqib «Eski»ga o'tadi, buyurtmalar «yo'lda» bo'ladi — jo'natgach sahifa
      // «Bugungi»ga qaytadi, eski kesh (30 s) ko'rinmasin.
      queryClient.invalidateQueries({ queryKey: [MAILS_KEY, "new"] });
      queryClient.invalidateQueries({ queryKey: [MAILS_KEY, "old"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
};

/**
 * Jo'natilgan, hali qabul qilinmagan pochtani boshqa filialga o'tkazish (eski pochta → «Filialga o'tkazish»):
 * `POST branches/posts/:id/reassign {destination_branch_id}`. Pochta id'si o'zgarmaydi; pochta va buyurtmalar
 * ro'yxatlari (eski/yangi pochtalar, buyurtmalar) eskiradi.
 */
export const useReassignPostToBranch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, destinationBranchId }: { postId: string; destinationBranchId: string }) =>
      api
        .post(API_ENDPOINTS.BRANCHES.POST_REASSIGN(postId), {
          destination_branch_id: destinationBranchId,
        })
        .then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MAILS_KEY] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
};

// ─── Receive Post Payload ─────────────────────────────────────────────────────
export interface ReceivePostPayload {
  order_ids: string[];
  /**
   * Skaner bilan qabul (2026-11-07): faqat `order_ids` qabul qilinadi, pochtadagi qolgan yo'ldagi buyurtmalarga tegilmaydi
   * (qaytarish so'rovi belgilanmaydi). Berilmasa — eski «tanlanganlarni qabul qil, qolganini qaytarishga» qoidasi.
   */
  scan?: boolean;
}

/**
 * `PATCH post/receive/:id` javobi. `scan: true` bo'lsa backend qo'shimcha maydonlarni ham qaytaradi
 * (eski backendda yo'q bo'lishi mumkin — hammasi ixtiyoriy).
 */
export interface ReceivePostResponse {
  data?: unknown;
  message?: string;
  not_received_order_ids?: Array<string | number>;
  /** Shu so'rovda yo'ldan «kutilmoqda»ga o'tganlar. */
  received_order_ids?: Array<string | number>;
  /** So'rovdan oldin allaqachon qabul qilingan (yozuv yo'q, xato emas). */
  already_received_order_ids?: Array<string | number>;
  /** Pochtada hamon yo'lda turganlar soni (qaytarish so'ralganlar ham); qayta tekshiruv yiqilsa `null`. */
  remaining_count?: number | null;
  /** Pochtaning yangi holati (`sent` | `received` …). */
  post_status?: string;
}

/**
 * Skan-qabul navbatlari (kalit — `scope`): so'rovlar ketma-ket, sahifa yashirin bo'lsa ham va sahifadan chiqilsa ham
 * yuboriladi. TanStack `scope` ishlatilmaydi — u navbatdagi mutatsiyani fokus/tarmoq qaytguncha to'xtatib qo'yadi
 * (telefon qulflansa skanlar jo'natilmay qolardi, kuryer esa «qabul qilindi» ni eshitib bo'lgan).
 */
const receiveChains = new Map<string, Promise<unknown>>();

const enqueueReceive = <T,>(key: string, run: () => Promise<T>): Promise<T> => {
  const previous = receiveChains.get(key) ?? Promise.resolve();
  const next = previous.then(run, run);
  const tail = next.then(
    () => undefined,
    () => undefined,
  );
  receiveChains.set(key, tail);
  void tail.then(() => {
    if (receiveChains.get(key) === tail) receiveChains.delete(key);
  });
  return next;
};

// ─── PATCH: Courier tomonidan pochtani qabul qilish ──────────────────────────
export const useReceivePost = (options?: {
  /**
   * Berilsa so'rovlar shu kalit bo'yicha ketma-ket (bitta navbat; sahifa yashirin bo'lsa yoki sahifadan chiqilsa ham
   * yuboriladi) va `mutationKey: ["post-receive", scope]` (useIsMutating / useMutationState uchun — navbatdagilar ham
   * darhol `pending`). Skan-qabulda: `post-receive:<postId>`; kuryer /scan va ro'yxati: `courier-scan-receive`.
   */
  scope?: string;
}) => {
  const queryClient = useQueryClient();
  const scope = options?.scope;

  return useMutation({
    ...(scope ? { mutationKey: ["post-receive", scope] } : {}),
    mutationFn: ({
      postId,
      payload,
    }: {
      postId: string;
      payload: ReceivePostPayload;
    }): Promise<ReceivePostResponse> => {
      const send = () =>
        api
          .patch(API_ENDPOINTS.POSTS.RECEIVE(postId), payload)
          .then((res) => res.data as ReceivePostResponse);
      return scope ? enqueueReceive(scope, send) : send();
    },
    onSuccess: (_data, { postId }) => {
      queryClient.invalidateQueries({
        queryKey: [MAILS_KEY, "detail", postId],
      });
      // Qabul qilingan pochta «Bugungi»dan chiqib «Eski»ga o'tadi — orqaga qaytganda eski kesh (30 s) ko'rinmasin:
      // kuryer / menejer «Bugungi»si (`post/on-the-road`, `post?status=sent`), menejer zaxirasi (yo'ldagi buyurtmalar)
      // va eski pochtalar.
      queryClient.invalidateQueries({ queryKey: [MAILS_KEY, "new"] });
      queryClient.invalidateQueries({ queryKey: [MAILS_KEY, "today-fallback-orders"] });
      queryClient.invalidateQueries({ queryKey: [MAILS_KEY, "old"] });
      // Qabul qilingan buyurtmalar «kutilmoqda»ga o'tadi — buyurtmalar ro'yxati va sonlari.
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
};

/**
 * Kuryer / filial menejeri: «Bu buyurtma kelmagan» — qaytarish so'rovi natijasi (`POST post/:postId/orders/:orderId/return-request`
 * javobining `data` qismi, bir shaklga keltirilgan).
 *
 *  - `alreadyRequested` — so'rov avval yuborilgan edi (boshqa oyna / qurilmadan), qayta yozilmadi;
 *  - `remainingReceivable` — pochtada hali qabul qilinadigan (yo'ldagi, so'rovsiz) buyurtmalar soni;
 *    `null` — backend bermadi (sahifa o'z ro'yxatidan sanaydi).
 */
export interface RequestOrderReturnResult {
  orderId: string;
  postId: string;
  returnRequested: boolean;
  alreadyRequested: boolean;
  remainingReceivable: number | null;
}

/** Javob (`{ statusCode, message, data }` yoki to'g'ridan-to'g'ri `data`) → `RequestOrderReturnResult`. */
export const toRequestOrderReturnResult = (
  payload: unknown,
  fallback: { postId: string; orderId: string },
): RequestOrderReturnResult => {
  const body = asRecord(payload);
  const data = asRecord(body?.data) ?? body ?? {};
  const remaining = Number(data.remaining_receivable);
  return {
    orderId: toText(data.order_id) || fallback.orderId,
    postId: toText(data.post_id) || fallback.postId,
    returnRequested: data.return_requested !== false,
    alreadyRequested: data.already_requested === true,
    remainingReceivable:
      data.remaining_receivable != null && Number.isFinite(remaining) ? Math.max(0, remaining) : null,
  };
};

/**
 * Kuryer o'z jo'natilgan (`sent`) pochtasidagi yoki filial menejeri o'z filialiga jo'natilgan o'tkazma pochtasidagi
 * (kuryersiz; ega qarori 2026-11-04) yo'ldagi buyurtmani «kelmagan» deb bildiradi —
 * `POST post/:postId/orders/:orderId/return-request` (tanasiz, ikkalasiga bitta endpoint). Buyurtma «yo'lda» qoladi
 * (`return_requested: true`), so'rov xodimning «Qaytarish» bo'limiga tushadi; pochta bu amal bilan yopilmaydi.
 * Rad javoblari (matn backenddan): 403 — boshqa filial menejeri yoki boshqa rol; 404 — pochta kuryerniki emas;
 * 400 — pochta jo'natilmagan, buyurtma qabul qilingan yoki yo'lda emas; 409 — buyurtma shu orada boshqa pochtaga
 * o'tgan yoki o'zgargan.
 */
export const useRequestOrderReturn = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, orderId }: { postId: string; orderId: string }) =>
      api
        .post(API_ENDPOINTS.POSTS.ORDER_RETURN_REQUEST(postId, orderId))
        .then((res) => toRequestOrderReturnResult(res.data, { postId, orderId })),
    // Xatoda ham (409 — shu orada qabul qilingan / boshqa pochtaga o'tgan) qatorlar yangilansin.
    onSettled: (_data, _error, { postId }) => {
      queryClient.invalidateQueries({ queryKey: [MAILS_KEY, "detail", postId] });
      // Kuryer / menejerning «Bugungi» pochtalari (`post/on-the-road`, `post?status=sent`) va «Qaytarish» ro'yxati.
      queryClient.invalidateQueries({ queryKey: [MAILS_KEY, "new"] });
      queryClient.invalidateQueries({ queryKey: [MAILS_KEY, "return"] });
      // Buyurtma ro'yxati va tafsilotidagi «Qaytarish so'ralgan» belgisi.
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
};

/** Rad etilgan (bekor qilingan) pochta holati: `canceled` — ochiq, `canceled_received` — yopilgan. */
export type CanceledPostStatus = "canceled" | "canceled_received";

/**
 * Rad etilgan pochtadagi amal natijasi — `POST post/cancel/receive/:id` (qabul) va `POST post/cancel/return/:id`
 * (HQ: filialga qaytarish) javobining `data` qismi, bir shaklga keltirilgan.
 *
 *  - `orderIds` — shu amal bajarilgan buyurtmalar (qabul qilingan / qaytarilgan);
 *  - `remainingOrderIds` — pochtada hali turganlari (`null` — eski backend bermadi);
 *  - `postClosed` — pochtada buyurtma qolmadi, pochta yopildi (`null` — eski backend: `post_closed` ham,
 *    `post_status` ham yo'q; bunda sahifa avvalgi matn bilan qoladi);
 *  - `requeuedPostIds` — qaytarish pochtalari (HQ qabulida endi doim bo'sh — hech narsa o'zi qaytmaydi);
 *  - `branchId` — qabul joyi (qabul), `returnBranchId` — buyurtmalar qaytgan filial (qaytarish).
 */
export interface CanceledPostActionResult {
  orderIds: string[];
  remainingOrderIds: string[] | null;
  requeuedPostIds: string[];
  groupedPostIds: string[];
  postStatus: CanceledPostStatus | null;
  postClosed: boolean | null;
  branchId: string | null;
  returnBranchId: string | null;
}

const toIdList = (value: unknown): string[] =>
  Array.isArray(value) ? [...new Set(value.map((item) => toText(item)).filter(Boolean))] : [];

/** Javob (`{ statusCode, message, data }` yoki to'g'ridan-to'g'ri `data`) → `CanceledPostActionResult`. */
export const toCanceledPostActionResult = (payload: unknown): CanceledPostActionResult => {
  const body = asRecord(payload);
  const data = asRecord(body?.data) ?? body ?? {};
  const rawStatus = toText(data.post_status).toLowerCase();
  const postStatus: CanceledPostStatus | null =
    rawStatus === "canceled" || rawStatus === "canceled_received" ? rawStatus : null;
  return {
    orderIds: toIdList(data.order_ids),
    remainingOrderIds: Array.isArray(data.remaining_order_ids) ? toIdList(data.remaining_order_ids) : null,
    requeuedPostIds: toIdList(data.requeued_post_ids),
    groupedPostIds: toIdList(data.grouped_post_ids),
    postStatus,
    postClosed:
      typeof data.post_closed === "boolean"
        ? data.post_closed
        : postStatus === "canceled_received"
          ? true
          : postStatus === "canceled"
            ? false
            : null,
    branchId: toText(data.branch_id) || null,
    returnBranchId: toText(data.return_branch_id) || null,
  };
};

/**
 * Rad etilgan pochtadagi amaldan keyin eskiradigan so'rovlar: pochta qatorlari (rad etilgan va oddiy tafsilot —
 * yordamchi `current` so'rovi ham), «Rad etilgan» / «Eski pochtalar» ro'yxatlari va buyurtmalar.
 */
const invalidateAfterCanceledPostAction = (queryClient: ReturnType<typeof useQueryClient>, postId: string) => {
  queryClient.invalidateQueries({ queryKey: [MAILS_KEY, "refused-detail", postId] });
  queryClient.invalidateQueries({ queryKey: [MAILS_KEY, "detail", postId] });
  queryClient.invalidateQueries({ queryKey: [MAILS_KEY, "refused"] });
  queryClient.invalidateQueries({ queryKey: [MAILS_KEY, "refused-courier"] });
  queryClient.invalidateQueries({ queryKey: [MAILS_KEY, "old"] });
  queryClient.invalidateQueries({ queryKey: ["orders"] });
  queryClient.invalidateQueries({ queryKey: ["orders", "markets", "cancelled"] });
};

/**
 * Rad etilgan pochtani (tanlangan buyurtmalarni) qabul qilish — `POST post/cancel/receive/:id { order_ids }`.
 * HQ qabulida tanlanmaganlar shu pochtada qoladi (`remainingOrderIds`); filial qabulida pochta doim yopiladi.
 */
export const useReceiveCanceledPost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      postId,
      payload,
    }: {
      postId: string;
      payload: ReceivePostPayload;
    }) =>
      api
        .post(API_ENDPOINTS.POSTS.CANCEL_RECEIVE(postId), payload)
        .then((res) => toCanceledPostActionResult(res.data)),
    // Xatoda ham (409 — boshqa xodim shu orada qabul qilgan / qaytargan) qatorlar yangilansin.
    onSettled: (_data, _error, { postId }) => invalidateAfterCanceledPostAction(queryClient, postId),
  });
};

/**
 * HQ: rad etilgan pochtadagi TANLANGAN buyurtmalarni jo'natgan filialga qaytarish —
 * `POST post/cancel/return/:id { order_ids }` (bo'sh ro'yxat yuborilmaydi). Filial ularni «Rad etilgan
 * pochtalar»dan qabul qiladi. Rad javoblari: 400 (pochtani HQ kuryeri olib kelgan, jo'natuvchi filial noma'lum,
 * buyurtma bu pochtada yo'q, pochta yopilgan) va 409 (buyurtma shu orada qabul qilingan / qaytarilgan) — matn
 * backenddan.
 */
export const useReturnCanceledOrders = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, payload }: { postId: string; payload: ReceivePostPayload }) =>
      api
        .post(API_ENDPOINTS.POSTS.CANCEL_RETURN(postId), payload)
        .then((res) => toCanceledPostActionResult(res.data)),
    // Xatoda ham (409 — boshqa xodim shu orada qabul qilgan / qaytargan) qatorlar yangilansin.
    onSettled: (_data, _error, { postId }) => invalidateAfterCanceledPostAction(queryClient, postId),
  });
};
