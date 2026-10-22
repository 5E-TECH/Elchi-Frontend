import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/config/queryKeys";
import { getErrorStatus } from "../../../shared/lib/errorKind";
import {
  campaignDisplayStatus,
  isCampaignActive,
  type Campaign,
  type CampaignPayload,
} from "../model/campaign";
import type { AudienceTarget } from "../model/audience";
import {
  cancelCampaign,
  createAudienceSegment,
  createCampaign,
  deleteAudienceSegment,
  getAudienceSegments,
  getCampaign,
  getSchedulePolicy,
  previewAudience,
  type CreateSegmentInput,
} from "./campaignApi";

/** Filtr o'zgarishidan keyin kutish (ms) — har bosishda sanash so'rovi ketmasin. */
export const AUDIENCE_PREVIEW_DEBOUNCE_MS = 400;
/** Kampaniya progressi shu oraliqda yangilanadi (backend partiyalari ~2–3 s qadam bilan). */
export const CAMPAIGN_PROGRESS_INTERVAL_MS = 3_000;
/** Rejalashtirilgan (masalan, tungi taqiq bilan 09:00 ga surilgan) kampaniya — kamroq so'rov. */
export const CAMPAIGN_SCHEDULED_INTERVAL_MS = 60_000;

type PreviewTarget = AudienceTarget | { broadcast: true };

/**
 * JONLI AUDITORIYA (KM-2): nishon → `POST notifications/audience/preview` (debounce bilan). `target = null` — so'rov
 * yo'q (konstruktor tayyor emas). Oldingi natija yangisi kelguncha qoladi (`keepPreviousData`); `settled = false` —
 * nishon o'zgargan, so'rov hali ketmagan (UI «hisoblanmoqda» deydi va eski sonni yuborishga ishlatmaydi).
 */
export const useAudiencePreview = (
  target: PreviewTarget | null,
  delay: number = AUDIENCE_PREVIEW_DEBOUNCE_MS,
) => {
  const key = target ? JSON.stringify(target) : null;
  const [debouncedKey, setDebouncedKey] = useState(key);
  useEffect(() => {
    if (key === debouncedKey) return undefined;
    const timer = setTimeout(() => setDebouncedKey(key), delay);
    return () => clearTimeout(timer);
  }, [debouncedKey, delay, key]);

  const query = useQuery({
    queryKey: queryKeys.notificationCampaigns.audience(debouncedKey ?? ""),
    queryFn: () => previewAudience(JSON.parse(debouncedKey ?? "{}") as PreviewTarget),
    enabled: key !== null && debouncedKey !== null,
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    meta: { silentError: true },
  });

  const settled = key !== null && key === debouncedKey;
  /** Natija aynan joriy nishonga tegishli (eski nishonniki emas). */
  const current = settled && !query.isPlaceholderData && query.isSuccess;
  return { ...query, settled, current };
};

/**
 * Kampaniya yaratish 400 berganda (backend yaratishda qayta sanaydi — son o'zgargan bo'lishi mumkin): o'sha nishonni
 * keshni chetlab qayta sanaydi. Natija jonli son keshiga yoziladi — «Kimga» bloki va «Yuborish» darhol yangilanadi.
 */
export const useRecountAudience = () => {
  const queryClient = useQueryClient();
  return (target: PreviewTarget) => {
    const key = JSON.stringify(target);
    return queryClient.fetchQuery({
      queryKey: queryKeys.notificationCampaigns.audience(key),
      queryFn: () => previewAudience(JSON.parse(key) as PreviewTarget),
      staleTime: 0,
      retry: false,
    });
  };
};

/** «Namunani ko'rish» — 20 ta maskalangan qator (oyna ochilganda). */
export const useAudienceSample = (target: AudienceTarget | null, enabled: boolean) => {
  const key = target ? JSON.stringify(target) : "";
  return useQuery({
    queryKey: queryKeys.notificationCampaigns.sample(key),
    queryFn: () => previewAudience(target as AudienceTarget, { withSample: true }),
    enabled: enabled && Boolean(target),
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    meta: { silentError: true },
  });
};

export const useAudienceSegments = (enabled = true) =>
  useQuery({
    queryKey: queryKeys.notificationCampaigns.segments,
    queryFn: getAudienceSegments,
    enabled,
    staleTime: 60_000,
    meta: { silentError: true },
  });

export const useCreateAudienceSegment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSegmentInput) => createAudienceSegment(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.notificationCampaigns.segments }),
  });
};

export const useDeleteAudienceSegment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAudienceSegment(id),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.notificationCampaigns.segments }),
  });
};

/**
 * ⚠️ `retry: 0` — ATAYLAB: kampaniya yaratish qayta urinishi faqat qo'lda va AYNI `Idempotency-Key` bilan
 * (javob kelmasa kampaniya baribir yaratilgan bo'lishi mumkin).
 */
export const useCreateCampaign = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      payload,
      idempotencyKey,
    }: {
      payload: CampaignPayload;
      idempotencyKey: string;
    }) => createCampaign(payload, idempotencyKey),
    retry: 0,
    // Oflayn bo'lsa navbatda «osilib» qolmasin (tasdiq oynasi yopilmay qoladi, internet qaytganda kutilmaganda ketadi):
    // darhol tarmoq xatosi → «Javob kelmadi» + «Qayta urinish» ayni kalit bilan.
    networkMode: "always",
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.notificationCampaigns.lists }),
        // Yuboruvchi o'zi ham auditoriyada bo'lishi mumkin.
        queryClient.invalidateQueries({ queryKey: queryKeys.notificationsInbox.all }),
      ]);
    },
  });
};

/**
 * Progress so'rovi oralig'i: 403/404 (va boshqa 4xx) — to'xtaydi (har 3 s xato so'rash befoyda); javob hali yo'q yoki
 * faol — 3 s; rejalashtirilgan (`display_status = scheduled`) — 60 s; yakunlangan — yo'q.
 */
export const campaignRefetchInterval = (state: {
  data: Campaign | undefined;
  error: unknown;
}): number | false => {
  const status = state.error ? getErrorStatus(state.error) : undefined;
  if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) return false;
  const campaign = state.data;
  if (!campaign) return CAMPAIGN_PROGRESS_INTERVAL_MS;
  if (!isCampaignActive(campaign.status)) return false;
  return campaignDisplayStatus(campaign) === "scheduled"
    ? CAMPAIGN_SCHEDULED_INTERVAL_MS
    : CAMPAIGN_PROGRESS_INTERVAL_MS;
};

/** Kampaniya progressi — faol bo'lsa har 3 s (`campaignRefetchInterval`). */
export const useCampaign = (id: string | null | undefined) =>
  useQuery({
    queryKey: queryKeys.notificationCampaigns.detail(id ?? ""),
    queryFn: () => getCampaign(id as string),
    enabled: Boolean(id),
    refetchInterval: (query) => campaignRefetchInterval(query.state),
    refetchIntervalInBackground: false,
    meta: { silentError: true },
  });

export const useCancelCampaign = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelCampaign(id),
    onSuccess: (campaign) => {
      if (campaign.id)
        queryClient.setQueryData(queryKeys.notificationCampaigns.detail(campaign.id), campaign);
    },
    onSettled: (_data, _error, id) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.notificationCampaigns.detail(id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.notificationCampaigns.lists }),
      ]),
  });
};

/** Reklama tungi taqiqi: «Darhol» hozir yuborilsa surilsa — qachonga (tasdiq oynasi). */
export const useSchedulePolicy = (
  params: { scheduled_at?: string; category?: string },
  enabled: boolean,
) =>
  useQuery({
    queryKey: queryKeys.notificationCampaigns.schedulePolicy(params),
    queryFn: () => getSchedulePolicy(params),
    enabled,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    meta: { silentError: true },
  });
