import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/config/queryKeys";
import { isCampaignActive, type CampaignPayload } from "../model/campaign";
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
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.notificationCampaigns.lists }),
        // Yuboruvchi o'zi ham auditoriyada bo'lishi mumkin.
        queryClient.invalidateQueries({ queryKey: queryKeys.notificationsInbox.all }),
      ]);
    },
  });
};

/** Kampaniya progressi — faol bo'lsa har 3 s (`CAMPAIGN_PROGRESS_INTERVAL_MS`). */
export const useCampaign = (id: string | null | undefined) =>
  useQuery({
    queryKey: queryKeys.notificationCampaigns.detail(id ?? ""),
    queryFn: () => getCampaign(id as string),
    enabled: Boolean(id),
    refetchInterval: (query) =>
      !query.state.data || isCampaignActive(query.state.data.status)
        ? CAMPAIGN_PROGRESS_INTERVAL_MS
        : false,
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
