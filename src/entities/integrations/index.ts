import type { AxiosError } from "axios";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";

/**
 * INTEGRATSIYA ROLI — oqimda nima qiladi.
 *
 * ⚠️ `type` (`api`/`webhook`/`ftp`) bilan aralashtirmaslik kerak: u
 * TRANSPORT, ya'ni "qanday gaplashamiz". Rol esa "nima qiladi".
 */
export type IntegrationRole = "carrier" | "source" | "payment" | "mirror";

/** Tizim turi — guruhlash va onboarding shabloni uchun. */
export type IntegrationCategory =
  "marketplace" | "crm" | "cargo" | "payment" | "spreadsheet" | "other";

/** `spec` — biz kontrakt beramiz · `adapter` — biz moslashamiz. */
export type IntegrationMode = "spec" | "adapter";

/** Rol yorliqlari va izohlari — UI bir joydan o'qiydi. */
/**
 * ROL TAKSONOMIYASI — i18n KALITLARI.
 *
 * ⚠️ NEGA MATN EMAS, KALIT. Ilgari bu yerda o'zbekcha matn turardi va
 * sahifa i18n'dan tashqarida edi: til almashtirilganda barcha yorliq
 * o'zbekcha qolib ketardi. Endi qiymat — `integrations` nomlar fazosidagi
 * kalit, tarjima esa `locales/{uz,ru,en}/integrations.json` da.
 *
 * ⚠️ IKKI MANBA YARATILMADI. Bu xarita ikki sahifada ishlatiladi
 * (integratsiyalar konsoli va `new_orders/external_orders`). Matnni bu
 * yerda qoldirib, yoniga kalit qo'shsak, bir yorliq ikki joyda yashardi va
 * bir kuni ular ajralib ketardi. Shu bois ikkala iste'molchi ham `t()`
 * orqali o'qiydi.
 */
export const ROLE_META: Record<IntegrationRole, { labelKey: string; hintKey: string }> = {
  carrier: { labelKey: "roleCarrier", hintKey: "roleCarrierHint" },
  source: { labelKey: "roleSource", hintKey: "roleSourceHint" },
  payment: { labelKey: "rolePayment", hintKey: "rolePaymentHint" },
  mirror: { labelKey: "roleMirror", hintKey: "roleMirrorHint" },
};

/**
 * KATEGORIYA TAKSONOMIYASI — i18n KALITLARI (`ROLE_META` bilan ayni sabab).
 *
 * ⚠️ `Marketplace` va `CRM` tarjimada ham shu shaklda qoladi: ular o'zbek
 * tilida ham, ruscha matnda ham xalqaro atama sifatida ishlatiladi.
 */
export const CATEGORY_LABEL: Record<IntegrationCategory, string> = {
  marketplace: "categoryMarketplace",
  crm: "categoryCrm",
  cargo: "categoryCargo",
  payment: "categoryPayment",
  spreadsheet: "categorySpreadsheet",
  other: "categoryOther",
};

export type Integration = {
  id: string;
  name: string;
  slug: string;
  status: string;
  api_url: string;
  base_url?: string | null;
  type?: string | null;
  /** Oqimda nima qiladi. Eski yozuvlarda `carrier`. */
  role?: IntegrationRole | null;
  category?: IntegrationCategory | null;
  integration_mode?: IntegrationMode | null;
  auth_type: string;
  auth_url?: string | null;
  username?: string | null;
  credentials?: Record<string, string> | null;
  is_active: boolean;
  market_id: string | null;
  /**
   * Sekret SOZLANGANMI — sekretning o'zi emas.
   *
   * Backend `sanitizeIntegrationRow` HMAC sekretini javobdan o'chiradi va
   * faqat shu bayroqni beradi: "sozlangan" ni ko'rsatish uchun sirni
   * yuborish shart emas.
   */
  has_webhook_secret?: boolean;
  /** Posilka jo'natish shabloni — kargo uchun. */
  dispatch_config?: { endpoint?: string } | null;
  /**
   * CRM voronkasidan buyurtma yaratish darvozasi.
   *
   * `enabled: true` bo'lsa backend `create_on_stages` yoki
   * `create_on_events` dan kamida bittasini TALAB qiladi (400) — darvozasiz
   * CRM "bitim yaratildi" hodisasini mijoz manzili to'lmasdan oldin
   * yuboradi va chala buyurtma tug'ilardi.
   */
  inbound_order_config?: {
    enabled?: boolean;
    deal_path?: string;
    funnel_path?: string;
    funnel_id?: string;
    stage_path?: string;
    create_on_stages?: string[];
    create_on_events?: string[];
  } | null;
  market?: {
    id?: string | number;
    name?: string | null;
    username?: string | null;
    phone_number?: string | null;
  } | null;
  field_mapping?: unknown;
  status_mapping?: unknown;
  status_sync_config?: unknown;
  total_synced_orders: number;
  last_sync_at: string | null;
  createdAt: string;
  updatedAt: string;
  isDeleted?: boolean;
};

export type IntegrationParams = {
  is_active?: string;
  status?: string;
  role?: string;
  category?: string;
  market_id?: string;
  from_date?: string;
  to_date?: string;
  page?: number;
  limit?: number;
};

export type CreateIntegrationPayload = {
  name: string;
  slug: string;
  /** TRANSPORT — `api` | `webhook` | `ftp`. Rol EMAS. */
  type: string;
  /** XULQ — `carrier` | `source` | `payment` | `mirror`. */
  role?: IntegrationRole;
  /** Guruhlash va ulash shabloni. Xulqqa ta'sir qilmaydi. */
  category?: IntegrationCategory;
  integration_mode?: IntegrationMode;
  status: string;
  base_url: string;
  auth_type: string;
  credentials: Record<string, string>;
  market_id?: string | null;
  is_active?: boolean;
  field_mapping?: unknown;
  status_mapping?: unknown;
  status_sync_config?: unknown;
};

export type UpdateIntegrationPayload = Partial<CreateIntegrationPayload>;

export type IntegrationsMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type IntegrationsResponse = {
  statusCode: number;
  message: string;
  data: {
    items: Integration[];
    market: unknown | null;
    markets: unknown[];
    meta: IntegrationsMeta;
  };
};

export const integrationKeys = {
  all: ["integrations"] as const,
  list: (params: IntegrationParams) => ["integrations", params] as const,
  byId: (id: string | number) => ["integrations", "by-id", id] as const,
};

export const getIntegrationErrorMessage = (err: unknown): string => {
  const axiosErr = err as AxiosError<{ message?: unknown; error?: unknown }>;
  const msg = axiosErr?.response?.data?.message ?? axiosErr?.response?.data?.error;
  if (typeof msg === "string") return msg;
  if (Array.isArray(msg)) return msg.map(String).join(", ");
  return "";
};

export const useGetIntegrations = (params: IntegrationParams) =>
  useQuery<IntegrationsResponse>({
    queryKey: integrationKeys.list(params),
    queryFn: () => api.get(API_ENDPOINTS.INTEGRATIONS.BASE, { params }).then((res) => res.data),
    placeholderData: keepPreviousData,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

export type IntegrationByIdResponse = {
  statusCode: number;
  message: string;
  data: Integration;
};

export const useGetIntegrationById = (id?: string | number) =>
  useQuery<IntegrationByIdResponse>({
    queryKey: integrationKeys.byId(id ?? ""),
    queryFn: () =>
      api.get(API_ENDPOINTS.INTEGRATIONS.BY_ID(id as string | number)).then((res) => res.data),
    enabled: Boolean(id),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

export const useCreateIntegration = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateIntegrationPayload) =>
      api.post(API_ENDPOINTS.INTEGRATIONS.BASE, payload).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: integrationKeys.all });
    },
  });
};

export const useDeleteIntegration = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string | number) =>
      api.delete(API_ENDPOINTS.INTEGRATIONS.BY_ID(id)).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: integrationKeys.all });
    },
  });
};

export const useUpdateIntegration = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string | number; payload: UpdateIntegrationPayload }) =>
      api.patch(API_ENDPOINTS.INTEGRATIONS.BY_ID(id), payload).then((res) => res.data),
    onSuccess: (_response, variables) => {
      queryClient.invalidateQueries({ queryKey: integrationKeys.all });
      queryClient.invalidateQueries({ queryKey: integrationKeys.byId(variables.id) });
    },
  });
};

// Metrika hooklari va holat qoidasi — alohida faylda, chunki ular boshqa
// endpointga tayanadi va testlari ham alohida.
export * from "./metrics";
