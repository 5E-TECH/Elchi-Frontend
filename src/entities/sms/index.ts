import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";

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
  message_class?: "promo" | "transactional";
  text?: string;
  template_code?: string;
  lang?: SmsLanguage;
  vars?: Record<string, string>;
  segment?: SmsCampaignSegment;
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
  accounts: ["sms", "accounts"] as const,
  report: (from: string, to: string) => ["sms", "report", from, to] as const,
};

export const useSmsStatus = () =>
  useQuery({
    queryKey: SMS_KEYS.status,
    queryFn: async () => unwrap<SmsStatus>((await api.get(API_ENDPOINTS.NOTIFICATIONS.SMS_STATUS)).data),
    staleTime: 30_000,
  });

export const useSmsTariffs = () =>
  useQuery({
    queryKey: SMS_KEYS.tariffs,
    queryFn: async () => unwrap<SmsTariffs>((await api.get(API_ENDPOINTS.NOTIFICATIONS.SMS_TARIFFS)).data),
    staleTime: 5 * 60_000,
    meta: { silentError: true },
  });

export const useSmsTemplates = () =>
  useQuery({
    queryKey: SMS_KEYS.templates,
    queryFn: async () => unwrap<SmsTemplate[]>((await api.get(API_ENDPOINTS.NOTIFICATIONS.SMS_TEMPLATES)).data) ?? [],
  });

export const useSmsCampaigns = () =>
  useQuery({
    queryKey: SMS_KEYS.campaigns,
    queryFn: async () =>
      unwrap<SmsCampaignHistoryItem[]>((await api.get(API_ENDPOINTS.NOTIFICATIONS.SMS_CAMPAIGNS)).data) ?? [],
  });

export const useSmsAccounts = (enabled: boolean) =>
  useQuery({
    queryKey: SMS_KEYS.accounts,
    queryFn: async () => unwrap<SmsAccount[]>((await api.get(API_ENDPOINTS.NOTIFICATIONS.SMS_ACCOUNTS)).data) ?? [],
    enabled,
  });

export const useSmsReport = (from: string, to: string) =>
  useQuery({
    queryKey: SMS_KEYS.report(from, to),
    queryFn: async () =>
      unwrap<SmsReport>((await api.get(API_ENDPOINTS.NOTIFICATIONS.SMS_REPORT, { params: { from, to } })).data),
  });

export const previewSmsCampaign = async (input: SmsCampaignInput) =>
  unwrap<SmsCampaignPreview>((await api.post(API_ENDPOINTS.NOTIFICATIONS.SMS_CAMPAIGN_PREVIEW, input)).data);

export const useSendSmsCampaign = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ input, idempotencyKey }: { input: SmsCampaignInput; idempotencyKey: string }) =>
      unwrap<{ campaign_id: string; queued: number; blocked_no_consent: number; skipped_invalid_phone: number }>(
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
