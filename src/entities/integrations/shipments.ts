import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";

/**
 * JO'NATMALAR — ulanish bo'yicha posilkalar.
 *
 * IKKI YO'NALISH, IKKI JADVAL va ular teng emas:
 *
 *   chiquvchi (`provider_shipments`)     — BOY: ikki tomonning statusi,
 *                                          urinishlar, oxirgi xato, kuzatuv
 *                                          kodi. "Qaysi posilka yetmadi?"
 *                                          degan savolga javob beradi.
 *   kiruvchi (`partner_shipment_refs`)   — YUPQA: faqat bog'lanish. Status va
 *                                          summa buyurtmaning o'zida (boshqa
 *                                          sxemada) — ularni qo'shish har
 *                                          qator uchun alohida so'rov talab
 *                                          qilardi.
 */

export interface ProviderShipmentRow {
  id: string | number;
  order_id: string;
  integration_id: string;
  provider_slug: string | null;
  external_ref: string | null;
  tracking_number: string | null;
  /** Tashuvchining o'z statusi — har provayderda boshqacha nomlanadi. */
  provider_status: string | null;
  /** Bizning statusga xaritalangan qiymat — filtr shu bo'yicha. */
  internal_status: string | null;
  status_changed_at: string | null;
  send_attempts: number;
  last_error: string | null;
  createdAt?: string;
  /**
   * Buyurtma xulosasi (gateway `order.summary_by_ids`, tokhPLMP). `null` —
   * order-service javob bermadi; jadval baribir ko'rinadi.
   */
  order?: ShipmentOrderSummary | null;
}

export interface ShipmentOrderSummary {
  id: string;
  order_number?: string | null;
  status?: string | null;
  /** Jo'natilgan COD — buyurtmaning `total_price` i. */
  total_price?: number | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  region_name?: string | null;
  district_name?: string | null;
}

/** Pill filtrlari — backend `SHIPMENT_FILTERS` bilan bir xil. */
export type ShipmentFilter = "all" | "not_sent" | "failed" | "delivered" | "mismatch";

/**
 * Pill sanoqlari BITTA agregat so'rovdan. `mismatch: null` — ulanishda status
 * xaritasi yo'q, "Nomuvofiqlik" pili ko'rsatilmaydi.
 */
export type ShipmentCounts = Record<Exclude<ShipmentFilter, "mismatch">, number> & {
  mismatch: number | null;
};

export interface PartnerShipmentRow {
  id: string | number;
  partner_id: string;
  external_order_id: string;
  order_id: string;
  createdAt?: string;
}

export interface ShipmentsPage<T> {
  items: T[];
  pagination: { total: number; page: number; limit: number };
  /** Faqat chiquvchi posilkalarda; eski backendda yo'q — pillar sanoqsiz. */
  counts?: ShipmentCounts;
}

const EMPTY = { items: [], pagination: { total: 0, page: 1, limit: 20 } };

const unwrap = <T>(raw: unknown): ShipmentsPage<T> => {
  const outer = raw as { data?: unknown };
  const first = outer?.data ?? raw;
  const inner = (first as { data?: unknown })?.data ?? first;
  const page = inner as Partial<ShipmentsPage<T>> | undefined;
  return {
    items: Array.isArray(page?.items) ? page!.items : [],
    pagination: page?.pagination ?? EMPTY.pagination,
    ...(page?.counts ? { counts: page.counts } : {}),
  };
};

export const shipmentsKey = "integration-shipments";

/** Chiquvchi ulanishning posilkalari. */
export const useProviderShipments = (params: {
  integrationId?: string;
  failedOnly?: boolean;
  filter?: ShipmentFilter;
  page?: number;
  limit?: number;
}) =>
  useQuery({
    queryKey: [shipmentsKey, "provider", params.integrationId, params.failedOnly, params.filter, params.page],
    enabled: Boolean(params.integrationId),
    queryFn: () =>
      api
        .get(API_ENDPOINTS.INTEGRATIONS.SHIPMENTS_BY_ID(params.integrationId!), {
          params: {
            // ⚠️ Backend satrni `'true'`/`'1'` bo'yicha o'qiydi; `false`ni
            // umuman yubormaslik aniqroq.
            ...(params.failedOnly ? { failed_only: "true" } : {}),
            ...(params.filter && params.filter !== "all" ? { filter: params.filter } : {}),
            page: params.page ?? 1,
            limit: params.limit ?? 20,
          },
        })
        .then((res) => unwrap<ProviderShipmentRow>(res.data)),
  });

/** Hamkordan kelgan posilkalar bog'lanishi. */
export const usePartnerShipments = (params: {
  partnerId?: string;
  page?: number;
  limit?: number;
}) =>
  useQuery({
    queryKey: [shipmentsKey, "partner", params.partnerId, params.page],
    enabled: Boolean(params.partnerId),
    queryFn: () =>
      api
        .get(API_ENDPOINTS.PARTNERS.SHIPMENTS(params.partnerId!), {
          params: { page: params.page ?? 1, limit: params.limit ?? 20 },
        })
        .then((res) => unwrap<PartnerShipmentRow>(res.data)),
  });

/**
 * Posilkani QAYTA jo'natish.
 *
 * Mavjud `POST integrations/:slug/dispatch` ishlatiladi — u yangi posilka
 * yaratish uchun ham, yiqilganini qayta urinish uchun ham bir xil yo'l
 * (backend idempotent: `provider_shipments` da yozuv bor bo'lsa yangilanadi).
 */
export const useRedispatch = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, orderId }: { slug: string; orderId: string }) =>
      api
        .post(API_ENDPOINTS.INTEGRATIONS.DISPATCH(slug), { order_id: orderId })
        .then((res) => res.data),
    onSuccess: () => client.invalidateQueries({ queryKey: [shipmentsKey] }),
  });
};

/**
 * QO'LDA ISHGA TUSHIRISH — CRON'ni kutmasdan.
 *
 * `POST integrations/:id/sync` nomi CHALG'ITADI: u hech narsa tortib
 * olmaydi, CHIQUVCHI navbatni qayta ishlaydi (statuslarni tashuvchiga
 * yuboradi). Nomi backendda shunday, shuning uchun UI'da aniq yozamiz.
 */
export const useProcessQueue = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post(API_ENDPOINTS.INTEGRATIONS.SYNC(id), {}).then((res) => res.data),
    onSuccess: () => client.invalidateQueries({ queryKey: [shipmentsKey] }),
  });
};

/** Yiqilgan navbat qatorlarini qayta urinish. */
export const useRetryFailed = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post(API_ENDPOINTS.INTEGRATIONS.RETRY(id), {}).then((res) => res.data),
    onSuccess: () => client.invalidateQueries({ queryKey: [shipmentsKey] }),
  });
};
