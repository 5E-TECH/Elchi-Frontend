import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";
import { silentErrorMeta, type SilentErrorOption } from "../../shared/lib/queryErrorEvents";

export {
  isRetryableSmsCampaignError,
  isSmsScheduleTooFar,
  minutesToHhmm,
  quietHoursNotice,
  smsCampaignErrorKind,
  smsCampaignStatus,
  smsDailyQuota,
  smsScheduleErrorKey,
  SMS_MAX_SCHEDULE_DAYS,
  tashkentMinuteOfDay,
  type QuietHours,
  type QuietNotice,
  type SmsCampaignErrorKind,
  type SmsDailyQuota,
} from "./model/campaign";

export type SmsMessageClass = "transactional" | "promo" | "security";
export type SmsLanguage = "uz" | "ru" | "en";

export interface SmsTariffs {
  transactional: number | null;
  promo: number | null;
  security: number | null;
}

export interface SmsStatus {
  enabled: boolean;
  provider: string;
  default_account: boolean;
  otp_account: boolean;
  credential_secret_configured: boolean;
  used_today: number;
  daily_cap: number;
  max_fanout: number;
  quiet_hours: { start: number; end: number };
  tariffs: SmsTariffs;
}

export interface SmsTemplate {
  id: string;
  code: string;
  message_class: SmsMessageClass;
  lang: SmsLanguage;
  text: string;
  required_vars: string[];
  provider_template_id: string | null;
  is_active: boolean;
  encoding: "GSM-7" | "UCS-2";
  parts: number;
  needs_provider_approval: boolean;
}

export interface SmsCampaignSegment {
  market_id?: string;
  region_id?: string;
  district_id?: string;
  last_order_from?: string;
  last_order_to?: string;
  min_orders?: number;
  phones?: string[];
}

export interface SmsCampaignInput {
  /**
   * Kampaniya FAQAT reklama (sVByLMnt): backend boshqa sinfni 400 `campaign_promo_only` bilan rad etadi. Xizmat
   * (transactional) va OTP SMS — faqat tizim hodisalaridan.
   */
  message_class?: "promo";
  text?: string;
  template_code?: string;
  lang?: SmsLanguage;
  vars?: Record<string, string>;
  segment?: SmsCampaignSegment;
  /**
   * KM-6 (2aS7PFX0): rejalashtirish — ISO + ANIQ zona (`2026-10-28T10:00:00+05:00`), ≤90 kun. Yo'q — darhol.
   * Reklama 18:00–09:00 oynasiga tushsa backend 09:00 ga suradi (`quiet_hours_shifted`).
   */
  scheduled_at?: string;
}

export interface SmsCampaignPreview {
  message_class: SmsMessageClass;
  text: string;
  sample_text: string;
  encoding: "GSM-7" | "UCS-2";
  parts: number;
  total: number;
  recipients: number;
  blocked_no_consent: number;
  skipped_invalid_phone: number;
  max_fanout: number;
  fanout_exceeded: boolean;
  tariff: number | null;
  estimated_cost: number | null;
  scheduled_for: string;
  sms_enabled: boolean;
  /** KM-6: admin so'ragan lahza (belgilangan vaqt yoki hozir). */
  requested_at?: string | null;
  /** KM-6: yuboriladigan lahza Toshkent vaqtida (`…+05:00`). */
  scheduled_for_tashkent?: string | null;
  /** KM-6: so'ralgan vaqt tungi taqiqqa tushib, oyna tugashiga surildi. */
  quiet_hours_shifted?: boolean;
}

/**
 * KM-6: kampaniya holati — `scheduled` (vaqti kutilmoqda, bekor qilish mumkin), `queued` (navbatga qo'yilgan),
 * `failed` (vaqti kelganda rad etildi — `last_error`), `cancelled`. Eski qatorlarda bo'lmasligi mumkin.
 */
export type SmsCampaignStatus = "scheduled" | "queued" | "failed" | "cancelled";

export const SMS_CAMPAIGN_STATUSES: readonly SmsCampaignStatus[] = ["scheduled", "queued", "failed", "cancelled"];

/** `POST …/campaigns` javobi: darhol — `queued`; kelajakdagi `scheduled_at` — `scheduled` (sonlar prognoz). */
export interface SmsCampaignCreated {
  campaign_id: string;
  status?: SmsCampaignStatus;
  queued: number;
  recipients?: number;
  blocked_no_consent: number;
  skipped_invalid_phone: number;
  estimated_cost?: number | string | null;
  scheduled_for?: string | null;
  scheduled_for_tashkent?: string | null;
  requested_at?: string | null;
  quiet_hours_shifted?: boolean;
}

export interface SmsCampaignHistoryItem {
  id: string;
  created_at: string;
  message_class: SmsMessageClass;
  text: string;
  total: number;
  queued: number;
  blocked: number;
  skipped: number;
  sent: number;
  delivered: number;
  failed: number;
  pending: number;
  estimated_cost: string | null;
  /** KM-6 maydonlari (eski backend javobida yo'q bo'lishi mumkin). */
  status?: SmsCampaignStatus | string;
  scheduled_at?: string | null;
  scheduled_for?: string | null;
  scheduled_for_tashkent?: string | null;
  requested_at?: string | null;
  quiet_hours_shifted?: boolean;
  started_at?: string | null;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  last_error?: string | null;
  can_cancel?: boolean;
}

export interface SmsReportDay {
  day: string;
  message_class: SmsMessageClass;
  total: number;
  delivered: number;
  failed: number;
  parts: number;
  cost: number;
  untariffed: number;
}

export interface SmsReport {
  days: SmsReportDay[];
  totals: {
    total: number;
    delivered: number;
    failed: number;
    parts: number;
    cost: number;
    untariffed: number;
    success_rate: number | null;
    tariff_configured: boolean;
  };
}

export interface SmsAccount {
  id: string;
  provider: string;
  sender_profile: "default" | "otp";
  login: string;
  sender: string;
  is_active: boolean;
}

/** Javob `{ data }` konvertida yoki to'g'ridan-to'g'ri keladi. */
const unwrap = <T,>(payload: unknown): T => {
  const record = payload as { data?: unknown } | null;
  return (record && typeof record === "object" && "data" in record ? record.data : payload) as T;
};

export const SMS_KEYS = {
  status: ["sms", "status"] as const,
  tariffs: ["sms", "tariffs"] as const,
  templates: ["sms", "templates"] as const,
  campaigns: ["sms", "campaigns"] as const,
  audience: (segmentKey: string) => ["sms", "campaign-audience", segmentKey] as const,
  accounts: ["sms", "accounts"] as const,
  report: (from: string, to: string) => ["sms", "report", from, to] as const,
};

export const useSmsStatus = (options?: SilentErrorOption) =>
  useQuery({
    queryKey: SMS_KEYS.status,
    queryFn: async () => unwrap<SmsStatus>((await api.get(API_ENDPOINTS.NOTIFICATIONS.SMS_STATUS)).data),
    staleTime: 30_000,
    ...silentErrorMeta(options),
  });

export const useSmsTariffs = () =>
  useQuery({
    queryKey: SMS_KEYS.tariffs,
    queryFn: async () => unwrap<SmsTariffs>((await api.get(API_ENDPOINTS.NOTIFICATIONS.SMS_TARIFFS)).data),
    staleTime: 5 * 60_000,
    meta: { silentError: true },
  });

export const useSmsTemplates = (options?: SilentErrorOption) =>
  useQuery({
    queryKey: SMS_KEYS.templates,
    queryFn: async () => unwrap<SmsTemplate[]>((await api.get(API_ENDPOINTS.NOTIFICATIONS.SMS_TEMPLATES)).data) ?? [],
    ...silentErrorMeta(options),
  });

export const useSmsCampaigns = (options?: SilentErrorOption) =>
  useQuery({
    queryKey: SMS_KEYS.campaigns,
    queryFn: async () =>
      unwrap<SmsCampaignHistoryItem[]>((await api.get(API_ENDPOINTS.NOTIFICATIONS.SMS_CAMPAIGNS)).data) ?? [],
    ...silentErrorMeta(options),
  });

export const useSmsAccounts = (enabled: boolean, options?: SilentErrorOption) =>
  useQuery({
    queryKey: SMS_KEYS.accounts,
    queryFn: async () => unwrap<SmsAccount[]>((await api.get(API_ENDPOINTS.NOTIFICATIONS.SMS_ACCOUNTS)).data) ?? [],
    enabled,
    ...silentErrorMeta(options),
  });

export const useSmsReport = (from: string, to: string, options?: SilentErrorOption) =>
  useQuery({
    queryKey: SMS_KEYS.report(from, to),
    queryFn: async () =>
      unwrap<SmsReport>((await api.get(API_ENDPOINTS.NOTIFICATIONS.SMS_REPORT, { params: { from, to } })).data),
    ...silentErrorMeta(options),
  });

export const previewSmsCampaign = async (input: SmsCampaignInput) =>
  unwrap<SmsCampaignPreview>((await api.post(API_ENDPOINTS.NOTIFICATIONS.SMS_CAMPAIGN_PREVIEW, input)).data);

/**
 * Jonli auditoriya uchun namuna matn. `POST …/campaigns/preview` matnsiz ishlamaydi (400 «Xabar matni bo'sh»),
 * auditoriya (qabul qiluvchilar, roziligi yo'qlar, noto'g'ri raqamlar) esa matnga bog'liq EMAS — shuning uchun
 * jonli son matn yozilmasdan ham shu neytral matn bilan so'raladi. Hech narsa yuborilmaydi; aniq narx, bo'laklar
 * va to'liq matn — «Ko'rib chiqish» dagi haqiqiy preview'da.
 */
export const SMS_AUDIENCE_PROBE_TEXT = "Elchi";
/** Filtr o'zgarishidan keyin kutish (ms) — har bosishda so'rov ketmasin. */
export const SMS_AUDIENCE_DEBOUNCE_MS = 400;

/**
 * JONLI AUDITORIYA (KM-1): mijozlar segmenti → `POST …/campaigns/preview` (debounce bilan). `segment = null` —
 * so'rov yo'q (masalan «Raqamlar» rejimi). Oldingi natija yangisi kelguncha qoladi (`keepPreviousData`);
 * `settled = false` — filtr o'zgargan, so'rov hali ketmagan.
 */
export const useSmsCampaignAudience = (
  segment: SmsCampaignSegment | null,
  delay: number = SMS_AUDIENCE_DEBOUNCE_MS,
) => {
  const key = segment ? JSON.stringify(segment) : null;
  const [debouncedKey, setDebouncedKey] = useState(key);
  useEffect(() => {
    if (key === debouncedKey) return undefined;
    const timer = setTimeout(() => setDebouncedKey(key), delay);
    return () => clearTimeout(timer);
  }, [debouncedKey, delay, key]);

  const query = useQuery({
    queryKey: SMS_KEYS.audience(debouncedKey ?? ""),
    queryFn: async () =>
      previewSmsCampaign({
        message_class: "promo",
        text: SMS_AUDIENCE_PROBE_TEXT,
        segment: JSON.parse(debouncedKey ?? "{}") as SmsCampaignSegment,
      }),
    enabled: key !== null && debouncedKey !== null,
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    meta: { silentError: true },
  });

  return { ...query, settled: key === debouncedKey };
};

export const useSendSmsCampaign = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ input, idempotencyKey }: { input: SmsCampaignInput; idempotencyKey: string }) =>
      unwrap<SmsCampaignCreated>(
        (
          await api.post(API_ENDPOINTS.NOTIFICATIONS.SMS_CAMPAIGNS, input, {
            headers: { "Idempotency-Key": idempotencyKey },
          })
        ).data,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SMS_KEYS.campaigns });
      void queryClient.invalidateQueries({ queryKey: SMS_KEYS.status });
    },
  });
};

/**
 * KM-6: rejalashtirilgan kampaniyani bekor qilish — `POST …/campaigns/:id/cancel` (faqat `scheduled`; boshqasi —
 * 409). Natijadan qat'i nazar tarix yangilanadi (409 da ham holat o'zgargan bo'ladi).
 */
export const useCancelSmsCampaign = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post(API_ENDPOINTS.NOTIFICATIONS.SMS_CAMPAIGN_CANCEL(id))).data,
    onSettled: () => void queryClient.invalidateQueries({ queryKey: SMS_KEYS.campaigns }),
  });
};

export const useUpsertSmsTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      code: string;
      message_class: SmsMessageClass;
      lang: SmsLanguage;
      text: string;
      is_active?: boolean;
    }) => unwrap<SmsTemplate>((await api.post(API_ENDPOINTS.NOTIFICATIONS.SMS_TEMPLATES, input)).data),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: SMS_KEYS.templates }),
  });
};

export const useApproveSmsTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, providerTemplateId }: { id: string; providerTemplateId: string }) =>
      (await api.patch(API_ENDPOINTS.NOTIFICATIONS.SMS_TEMPLATE_APPROVE(id), { provider_template_id: providerTemplateId }))
        .data,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: SMS_KEYS.templates }),
  });
};

export const useDeleteSmsTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(API_ENDPOINTS.NOTIFICATIONS.SMS_TEMPLATE_BY_ID(id))).data,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: SMS_KEYS.templates }),
  });
};

export const useUpsertSmsAccount = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      provider: "eskiz" | "playmobile";
      sender_profile: "default" | "otp";
      login: string;
      password: string;
      sender: string;
    }) => (await api.put(API_ENDPOINTS.NOTIFICATIONS.SMS_ACCOUNTS, input)).data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SMS_KEYS.accounts });
      void queryClient.invalidateQueries({ queryKey: SMS_KEYS.status });
    },
  });
};

export const useGrantSmsConsent = () =>
  useMutation({
    mutationFn: async (input: { phone: string; source: "shartnoma" | "veb-forma" | "buyurtma" | "operator"; customer_id?: string }) =>
      (await api.post(API_ENDPOINTS.NOTIFICATIONS.SMS_CONSENTS, input)).data,
  });

export const useRevokeSmsConsent = () =>
  useMutation({
    mutationFn: async (phone: string) => (await api.post(API_ENDPOINTS.NOTIFICATIONS.SMS_CONSENTS_REVOKE, { phone })).data,
  });
