import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";

/**
 * Partner API hamkorlari (admin).
 *
 * Hamkor — Elchi'ga tashqi tizimdan (BeePost, marketplace) buyurtma yuboradigan
 * taraf. U API kalit bilan `/partner/*` ga kiradi; biz esa unga holat
 * o'zgarishlarini webhook orqali qaytaramiz.
 *
 * ⚠️ API KALIT FAQAT BIR MARTA ko'rsatiladi — yaratish va rotatsiya javobida.
 * Bazada faqat sha256 hash saqlanadi, ya'ni kalitni QAYTA ko'rsatib bo'lmaydi.
 */

export interface PartnerWebhookSummary {
  pending: number;
  failed: number;
  completed: number;
  last_delivered_at: string | null;
}

export interface Partner {
  id: string;
  name: string;
  webhook_url: string | null;
  /** Sinov manzili — hodisa nusxasi shu yerga ham ketadi. */
  sandbox_webhook_url?: string | null;
  is_active: boolean;
  createdAt: string;
  webhooks?: PartnerWebhookSummary;
}

export interface PartnerWebhookRow {
  id: string;
  partner_id: string;
  order_id: string;
  external_order_id: string;
  event_type: string;
  new_status: string | null;
  status: "pending" | "processing" | "completed" | "permanently_failed";
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  next_retry_at: string | null;
  delivered_at: string | null;
  created_at: string;
  payload: Record<string, unknown>;
}

/**
 * Tahrirlash. Maydon semantikasi backend bilan BIR XIL:
 *   • berilmasa   — tegilmaydi;
 *   • bo'sh satr  — tozalanadi.
 */
export interface UpdatePartnerDto {
  name?: string;
  webhook_url?: string;
  webhook_secret?: string;
  /**
   * SANDBOX manzili — har bir hodisaning NUSXASI shu yerga ham yuboriladi
   * (`sandbox: true` bayrog'i bilan).
   *
   * Prodakshnda `webhook_url` haqiqiy qabul qiluvchiga qaratilgan va unga
   * tegib bo'lmaydi. Integratsiyani tekshirish uchun esa haqiqiy hodisalar
   * oqimini ko'rish kerak — sinov buyurtmasi yaratmasdan.
   *
   * Sandboxga yuborish "eng yaxshi harakat": xatosi asosiy yetkazishga
   * TA'SIR QILMAYDI va qayta urinilmaydi.
   */
  sandbox_webhook_url?: string;
  /** Berilmasa ASOSIY sekret ishlatiladi. */
  sandbox_webhook_secret?: string;
  ip_allowlist?: string[];
}

/** `POST /admin/partners/:id/webhook-test` javobi. */
export interface WebhookTestResult {
  ok: boolean;
  url: string;
  used_saved_url: boolean;
  http_status: number | null;
  duration_ms: number;
  response_body: string | null;
  error: string | null;
  /** Qabul qiluvchi tomonda solishtirib, sekret mosligini tekshirish uchun. */
  signature_sent: string;
  secret_configured: boolean;
  event_id: string;
}

export interface CreatePartnerDto {
  name: string;
  webhook_url?: string;
  webhook_secret?: string;
  ip_allowlist?: string[];
}

export const partnersKey = "admin-partners";
export const partnerWebhooksKey = "admin-partner-webhooks";

/**
 * Javob qobig'ini himoyalangan ochish.
 *
 * Gateway `successRes` bilan `{ statusCode, message, data }` qaytaradi, lekin
 * qatlam soni marshrutga qarab farq qilishi mumkin — bir qatlam o'zgarsa
 * sahifa bo'sh ko'rinib qolmasin.
 */
const unwrap = <T,>(raw: unknown, fallback: T): T => {
  const outer = raw as { data?: unknown };
  if (outer?.data !== undefined) {
    const inner = (outer.data as { data?: unknown })?.data;
    if (inner !== undefined) return inner as T;
    return outer.data as T;
  }
  return (raw as T) ?? fallback;
};

export const usePartners = () =>
  useQuery({
    queryKey: [partnersKey],
    queryFn: () =>
      api
        .get(API_ENDPOINTS.PARTNERS.BASE)
        .then((res) => unwrap<Partner[]>(res.data, [])),
  });

export interface PartnerWebhooksPage {
  data: PartnerWebhookRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const usePartnerWebhooks = (params: {
  partner_id?: string;
  status?: string;
  page?: number;
  limit?: number;
}) =>
  useQuery({
    queryKey: [partnerWebhooksKey, params],
    queryFn: () =>
      api
        .get(API_ENDPOINTS.PARTNERS.WEBHOOKS, { params })
        .then((res) =>
          unwrap<PartnerWebhooksPage>(res.data, {
            data: [],
            total: 0,
            page: 1,
            limit: 20,
            totalPages: 1,
          }),
        ),
  });

export const usePartnerActions = () => {
  const client = useQueryClient();
  const invalidate = () => {
    client.invalidateQueries({ queryKey: [partnersKey] });
    client.invalidateQueries({ queryKey: [partnerWebhooksKey] });
  };

  const createPartner = useMutation({
    mutationFn: (dto: CreatePartnerDto) =>
      api
        .post(API_ENDPOINTS.PARTNERS.BASE, dto)
        .then((res) => unwrap<{ id: string; api_key: string }>(res.data, {
          id: "",
          api_key: "",
        })),
    onSuccess: invalidate,
  });

  const updatePartner = useMutation({
    mutationFn: (params: { id: string; dto: UpdatePartnerDto }) =>
      api
        .patch(API_ENDPOINTS.PARTNERS.BY_ID(params.id), params.dto)
        .then((res) => res.data),
    onSuccess: invalidate,
  });

  const rotateKey = useMutation({
    mutationFn: (id: string) =>
      api
        .post(API_ENDPOINTS.PARTNERS.ROTATE_KEY(id))
        .then((res) => unwrap<{ id: string; api_key: string }>(res.data, {
          id: "",
          api_key: "",
        })),
    onSuccess: invalidate,
  });

  const setActive = useMutation({
    mutationFn: (params: { id: string; is_active: boolean }) =>
      api
        .post(API_ENDPOINTS.PARTNERS.STATUS(params.id), {
          is_active: params.is_active,
        })
        .then((res) => res.data),
    onSuccess: invalidate,
  });

  const retryWebhook = useMutation({
    mutationFn: (id: string) =>
      api
        .post(API_ENDPOINTS.PARTNERS.WEBHOOK_RETRY(id))
        .then((res) => res.data),
    onSuccess: invalidate,
  });

  /**
   * SINOV WEBHOOKI — haqiqiy buyurtmaga tegmaydi.
   *
   * Ilgari webhook sozlamasini tekshirishning yagona yo'li HAQIQIY sotuvni
   * kutish edi. Xato bo'lsa o'sha buyurtmaning hodisasi yo'qolardi.
   *
   * `url` berilsa saqlangan manzildan ustun turadi — yangi manzilni
   * SAQLASHDAN OLDIN sinash mumkin.
   */
  const testWebhook = useMutation({
    mutationFn: (params: { id: string; url?: string }) =>
      api
        .post(API_ENDPOINTS.PARTNERS.WEBHOOK_TEST(params.id), {
          url: params.url?.trim() || undefined,
        })
        .then((res) =>
          unwrap<WebhookTestResult>(res.data, {
            ok: false,
            url: "",
            used_saved_url: true,
            http_status: null,
            duration_ms: 0,
            response_body: null,
            error: "javob o'qilmadi",
            signature_sent: "",
            secret_configured: false,
            event_id: "",
          }),
        ),
    // Sinov hodisa YARATMAYDI — outbox jurnalini yangilash shart emas.
  });

  return {
    createPartner,
    updatePartner,
    rotateKey,
    setActive,
    retryWebhook,
    testWebhook,
  };
};
