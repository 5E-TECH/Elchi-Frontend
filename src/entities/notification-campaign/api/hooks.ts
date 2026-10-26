import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/config/queryKeys";
import { getErrorStatus } from "../../../shared/lib/errorKind";
import {
  campaignDisplayStatus,
  isCampaignActive,
  isCampaignPaused,
  type Campaign,
  type CampaignListPage,
  type CampaignListParams,
  type CampaignPayload,
} from "../model/campaign";
import type { AudienceTarget } from "../model/audience";
import { campaignReportKey, type CampaignReportKind, type CampaignReportRef } from "../model/report";
import {
  cancelCampaign,
  createAudienceSegment,
  createCampaign,
  deleteAudienceSegment,
  downloadCampaignExport,
  exportCampaignUndelivered,
  getAudienceSegments,
  getCampaign,
  getCampaignExportJob,
  getCampaignReport,
  getCampaignUndelivered,
  getCampaigns,
  getSchedulePolicy,
  previewAudience,
  type AudiencePreviewExtras,
  type CreateSegmentInput,
} from "./campaignApi";

/** Filtr o'zgarishidan keyin kutish (ms) — har bosishda sanash so'rovi ketmasin. */
export const AUDIENCE_PREVIEW_DEBOUNCE_MS = 400;
/** Kampaniya progressi shu oraliqda yangilanadi (backend partiyalari ~2–3 s qadam bilan). */
export const CAMPAIGN_PROGRESS_INTERVAL_MS = 3_000;
/** Rejalashtirilgan (masalan, tungi taqiq bilan 09:00 ga surilgan) kampaniya — kamroq so'rov. */
export const CAMPAIGN_SCHEDULED_INTERVAL_MS = 60_000;

/** Nishon (+ KM-5: SMS tanlansa `channels`, `title`, `body` — javobda `sms` bloki). */
type PreviewTarget = (AudienceTarget | { broadcast: true }) & AudiencePreviewExtras;

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
      // Xatoni forma o'zi ko'rsatadi (inline) — global xabar ikkinchi marta chiqmasin (G6F68ti6, 14-band).
      meta: { silentError: true },
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
 * faol — 3 s; rejalashtirilgan (`display_status = scheduled`) yoki reklama tungi taqiqda to'xtagan (`paused_until`
 * kelajakda; backend uni «yuborilmoqda» deb beradi) — 60 s; yakunlangan — yo'q.
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
  return campaignDisplayStatus(campaign) === "scheduled" || isCampaignPaused(campaign)
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
        queryClient.invalidateQueries({ queryKey: queryKeys.notificationCampaigns.report(id) }),
      ]),
  });
};

/**
 * «KAMPANIYALAR TARIXI» (KM-3): `GET /notifications/campaigns?page&limit&state`. Yangilanish: sahifada yuborilayotgan
 * kampaniya bo'lsa — har 3 s (maket «Holat har 3 soniyada yangilanadi»), faqat rejalashtirilgan yoki tungi taqiqda
 * to'xtagan bo'lsa — 60 s, qolganida — yo'q. Sahifa almashganda eski qatorlar yangisi kelguncha qoladi. Xato —
 * kartaning o'zida (`QueryBoundary`), global xabar takrorlanmaydi.
 */
export const campaignListRefetchInterval = (
  page: CampaignListPage | undefined,
  now: number = Date.now(),
): number | false => {
  const items = page?.items ?? [];
  if (
    items.some(
      (item) =>
        isCampaignActive(item.status) && campaignDisplayStatus(item) === "sending" && !isCampaignPaused(item, now),
    )
  )
    return CAMPAIGN_PROGRESS_INTERVAL_MS;
  if (
    items.some(
      (item) =>
        campaignDisplayStatus(item) === "scheduled" || (isCampaignActive(item.status) && isCampaignPaused(item, now)),
    )
  )
    return CAMPAIGN_SCHEDULED_INTERVAL_MS;
  return false;
};

export const useCampaigns = (params: CampaignListParams) =>
  useQuery({
    queryKey: queryKeys.notificationCampaigns.list(params),
    queryFn: () => getCampaigns(params),
    placeholderData: keepPreviousData,
    refetchInterval: (query) => campaignListRefetchInterval(query.state.data),
    refetchIntervalInBackground: false,
    meta: { silentError: true },
  });

/**
 * Kampaniya hisoboti (oyna ochiq ekan — `enabled`; yopilish animatsiyasida kesh ko'rinib turadi, so'rov yo'q).
 * Yuborilayotgan kampaniyada — har 3 s. Xato — oynaning o'zida.
 */
export const useCampaignReport = (
  id: string | null,
  enabled = true,
  kind: CampaignReportKind = "notification",
) =>
  useQuery({
    queryKey: queryKeys.notificationCampaigns.report(id ? campaignReportKey({ id, kind }) : ""),
    queryFn: () => getCampaignReport(id as string, kind),
    enabled: Boolean(id) && enabled,
    refetchInterval: (query) =>
      query.state.data?.campaign.display_status === "sending" ? CAMPAIGN_PROGRESS_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
    meta: { silentError: true },
  });

/**
 * «Yetkazilmaganlar» sahifasi (`limit` ≤ 100). Oldingi sahifa faqat SHU kampaniya ichida ko'rinib turadi — boshqa
 * kampaniya ochilganda eski kampaniyaning qatorlari ko'rinmaydi (oyna doim o'rnatilgan, kuzatuvchi bitta).
 */
export const useCampaignUndelivered = (
  id: string | null,
  params: { page: number; limit: number },
  enabled = true,
  kind: CampaignReportKind = "notification",
) => {
  // SMS va bildirishnoma kampaniyasining id'lari bir xil bo'lishi mumkin — kalitda tur ham bor (`sms:<id>`).
  const key = id ? campaignReportKey({ id, kind }) : "";
  return useQuery({
    queryKey: queryKeys.notificationCampaigns.undelivered(key, params),
    queryFn: () => getCampaignUndelivered(id as string, params, kind),
    enabled: Boolean(id) && enabled,
    placeholderData: (previous, previousQuery) => (previousQuery?.queryKey[2] === key ? previous : undefined),
    meta: { silentError: true },
  });
};

/** Fon eksporti holatini so'rash oralig'i (navbatda / tayyorlanmoqda). */
export const CAMPAIGN_EXPORT_POLL_MS = 2_000;
/** Fon eksportini kutish chegarasi — oshsa «Fayl hali tayyor emas» (vazifa esa saqlanadi — keyingi bosishda davom etadi). */
export const CAMPAIGN_EXPORT_MAX_POLLS = 60;

export type CampaignExportOutcome =
  | { kind: "saved"; fileName: string }
  | { kind: "failed" }
  | { kind: "timeout" };

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Kampaniya → tugallanmagan (yoki kutish chegarasidan oshgan) fon eksporti. Backend tayyor faylni 7 kun saqlaydi va
 * faqat navbatdagi / ishlayotgan vazifani takrorlamaydi — id yo'qolsa, «keyinroq qayta urinish» butun CSV ni qaytadan
 * qurdirardi. Sahifa yangilanguncha yashaydi (ataylab — `localStorage` emas).
 */
const pendingExports = new Map<string, string>();

/** Testlar uchun: eslab qolingan fon eksportlarini tozalash. */
export const resetPendingCampaignExports = () => pendingExports.clear();

export type ExportCampaignOptions = {
  pollMs?: number;
  maxPolls?: number;
  /** Natija — oyna yopilgan bo'lsa ham chaqiriladi (mutatsiya darajasidagi qayta chaqiruv). */
  onOutcome?: (outcome: CampaignExportOutcome) => void;
  onError?: (error: unknown) => void;
};

/**
 * CSV eksport (faqat superadmin): ≤ 10 000 qator — fayl darhol; kattasi — fon vazifasi, holati har 2 s so'raladi va
 * tayyor bo'lgach fayl yuklab olinadi. Fon vazifasi id'si kampaniya bo'yicha eslab qolinadi: kutish chegarasidan
 * oshsa, keyingi bosish yangi vazifa ochmaydi — o'sha vazifani davom ettiradi (tayyor bo'lsa darhol yuklaydi); vazifa
 * xato bilan tugasa yoki fayl muddati o'tgan bo'lsa (404 / 410) — yangisi ochiladi. Fayl brauzer orqali saqlanadi
 * (`save`), xabarlar — `onOutcome` / `onError` (oyna yopilgan bo'lsa ham).
 */
export const useExportCampaignUndelivered = (
  save: (blob: Blob, fileName: string) => void,
  {
    pollMs = CAMPAIGN_EXPORT_POLL_MS,
    maxPolls = CAMPAIGN_EXPORT_MAX_POLLS,
    onOutcome,
    onError,
  }: ExportCampaignOptions = {},
) =>
  useMutation({
    mutationFn: async (target: string | CampaignReportRef): Promise<CampaignExportOutcome> => {
      // Satr — bildirishnoma kampaniyasi id'si (avvalgidek); SMS kampaniyasi — `{ id, kind: 'sms' }`.
      const ref: CampaignReportRef = typeof target === "string" ? { id: target, kind: "notification" } : target;
      /** Eslab qolingan fon vazifasi kaliti (SMS — `sms:<id>`). */
      const id = campaignReportKey(ref);
      const fallbackName = `${ref.kind === "sms" ? "sms-kampaniya" : "kampaniya"}-${ref.id}-yetkazilmaganlar.csv`;
      const pollJob = async (exportId: string): Promise<CampaignExportOutcome> => {
        for (let attempt = 0; attempt < maxPolls; attempt += 1) {
          if (attempt > 0) await wait(pollMs);
          const job = await getCampaignExportJob(exportId);
          if (job.status === "failed") {
            pendingExports.delete(id);
            return { kind: "failed" };
          }
          if (job.status === "done") {
            const file = await downloadCampaignExport(exportId);
            const fileName = file.fileName ?? job.filename ?? fallbackName;
            save(file.blob, fileName);
            pendingExports.delete(id);
            return { kind: "saved", fileName };
          }
        }
        return { kind: "timeout" };
      };

      const remembered = pendingExports.get(id);
      if (remembered) {
        try {
          return await pollJob(remembered);
        } catch (error) {
          // Vazifa topilmadi yoki fayl muddati o'tgan — yangisini ochamiz; boshqa xato — yuqoriga.
          const status = getErrorStatus(error);
          if (status !== 404 && status !== 410) throw error;
          pendingExports.delete(id);
        }
      }

      const result = await exportCampaignUndelivered(ref.id, ref.kind);
      if (result.kind === "file") {
        const fileName = result.fileName ?? fallbackName;
        save(result.blob, fileName);
        return { kind: "saved", fileName };
      }
      pendingExports.set(id, result.exportId);
      await wait(pollMs);
      return pollJob(result.exportId);
    },
    retry: 0,
    onSuccess: (outcome) => onOutcome?.(outcome),
    onError: (error) => onError?.(error),
  });

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

/**
 * Forma uchun siyosat (KM-3 «Yuborish vaqti»): reklama taqiq oynasi, `is_promo` va 90 kun chegarasi — kategoriya
 * bo'yicha, `scheduled_at` siz. Kamdan-kam o'zgaradi — 5 daqiqa yangi hisoblanadi.
 */
export const useSchedulePolicyInfo = (category: string, enabled: boolean) =>
  useQuery({
    queryKey: queryKeys.notificationCampaigns.schedulePolicy({ category }),
    queryFn: () => getSchedulePolicy({ category }),
    enabled,
    retry: 1,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    meta: { silentError: true },
  });
