import { keepPreviousData, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/config/queryKeys";
import {
  getAdvisorAlert,
  getAdvisorAlerts,
  getAdvisorOverview,
  getAdvisorSettings,
} from "../api/aiAdvisorApi";
import { classifyProbeError, type AdvisorUnavailableReason } from "./advisorErrors";
import { isAlertId } from "./advisorRules";
import type {
  AiAdvisorAlertListParams,
  AiAdvisorOverview,
  AiAdvisorSettings,
} from "./advisorTypes";

/**
 * AI maslahatchi so'rovlari. Backend hali hamma muhitda yo'q — `overview` va `settings` ZOND (D2/D3): natija xato
 * emas, ittifoq (`available | unavailable`) sifatida keshlanadi, shuning uchun mavjud bo'lmagan backend bitta
 * so'rovdan keyin qayta-qayta so'ralmaydi:
 *   - `absent` (404/405/501, boshqa shakl) va `forbidden` (401/403) — sessiya davomida (`staleTime: Infinity`);
 *   - `transient` (tarmoq, vaqt, 5xx, 429) — 5 daqiqa; keyingi ochilishda qayta so'raladi;
 *   - `available` — 60 s poll (faqat sahifa ko'rinib turganda) va oyna fokusida;
 *   - avval `available` bo'lgan zond keyin yiqilsa — xato tashlanadi: React Query eski ma'lumotni saqlaydi, tab
 *     sessiya o'rtasida yo'qolmaydi.
 * Hammasi `retry: false` (ilova sukuti 5xx ni bir marta qayta so'rardi) va `meta.silentError` (xato sahifada).
 */

export type AdvisorProbe<T> = { kind: "available"; data: T } | { kind: "unavailable"; reason: AdvisorUnavailableReason };
export type AdvisorAvailability = AdvisorProbe<AiAdvisorOverview>;
export type AdvisorSettingsState = AdvisorProbe<AiAdvisorSettings>;

/** `available` zondning yangilik muddati (fokus va qayta ochilishda shundan eski bo'lsa so'raladi). */
export const ADVISOR_AVAILABLE_STALE_MS = 30_000;
/** Vaqtinchalik xatodan keyin qayta zond — keyingi ochilishda, shundan keyin. */
export const ADVISOR_TRANSIENT_STALE_MS = 5 * 60_000;
/** `overview` poll'i (sahifa ochiq va ko'rinib turganda). */
export const ADVISOR_OVERVIEW_POLL_MS = 60_000;

/** Zond natijasining yangilik muddati: mavjud — 30 s, vaqtinchalik — 5 daqiqa, yo'q / ruxsatsiz — sessiya davomida. */
export const advisorProbeStaleTime = (data: AdvisorProbe<unknown> | undefined): number => {
  if (!data) return 0;
  if (data.kind === "available") return ADVISOR_AVAILABLE_STALE_MS;
  return data.reason === "transient" ? ADVISOR_TRANSIENT_STALE_MS : Infinity;
};

const isAvailable = (data: AdvisorProbe<unknown> | undefined) => data?.kind === "available";

/**
 * Zond: muvaffaqiyat — `available`; xato — tasnif (`unavailable`). Avval `available` bo'lgan bo'lsa — xato
 * tashlanadi (eski ma'lumot saqlanadi, keyingi poll yana urinadi).
 */
export const runAdvisorProbe = async <T>(fetcher: () => Promise<T>, previous: AdvisorProbe<T> | undefined): Promise<AdvisorProbe<T>> => {
  try {
    return { kind: "available", data: await fetcher() };
  } catch (error) {
    if (previous?.kind === "available") throw error;
    return { kind: "unavailable", reason: classifyProbeError(error) };
  }
};

/** `overview` zondi — `/ai-assistant` sahifasining yagona mavjudlik manbai (tablar, «Sozlamalar», banner, nishon). */
export const fetchAdvisorAvailability = (queryClient: QueryClient) =>
  runAdvisorProbe(
    () => getAdvisorOverview(),
    queryClient.getQueryData<AdvisorAvailability>(queryKeys.aiAdvisor.overview),
  );

export const useAdvisorAvailability = ({ enabled = true }: { enabled?: boolean } = {}) => {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: queryKeys.aiAdvisor.overview,
    queryFn: () => fetchAdvisorAvailability(queryClient),
    enabled,
    retry: false,
    gcTime: Infinity,
    staleTime: (query) => advisorProbeStaleTime(query.state.data),
    refetchInterval: (query) => (isAvailable(query.state.data) ? ADVISOR_OVERVIEW_POLL_MS : false),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: (query) => isAvailable(query.state.data),
    refetchOnReconnect: (query) => isAvailable(query.state.data),
    meta: { silentError: true },
  });
};

/** Sozlamalar zondi (D3) — faqat `overview` mavjud bo'lsa yoqiladi; «Sozlamalar» tugmasi shundan. */
export const fetchAdvisorSettings = (queryClient: QueryClient) =>
  runAdvisorProbe(
    () => getAdvisorSettings(),
    queryClient.getQueryData<AdvisorSettingsState>(queryKeys.aiAdvisor.settings),
  );

export const useAdvisorSettings = ({ enabled = true }: { enabled?: boolean } = {}) => {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: queryKeys.aiAdvisor.settings,
    queryFn: () => fetchAdvisorSettings(queryClient),
    enabled,
    retry: false,
    gcTime: Infinity,
    staleTime: (query) => advisorProbeStaleTime(query.state.data),
    refetchOnWindowFocus: (query) => isAvailable(query.state.data),
    refetchOnReconnect: (query) => isAvailable(query.state.data),
    meta: { silentError: true },
  });
};

/** Ro'yxat: filtr/sahifa almashganda eski sahifa ko'rinib turadi (`keepPreviousData`). */
export const useAdvisorAlerts = (params: AiAdvisorAlertListParams, { enabled = true }: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: queryKeys.aiAdvisor.alertList(params),
    queryFn: () => getAdvisorAlerts(params),
    enabled,
    placeholderData: keepPreviousData,
    meta: { silentError: true },
  });

export type AdvisorAlertCountParams = Omit<AiAdvisorAlertListParams, "page" | "limit">;

/** Filtr bo'yicha soni (telefon filtr varag'idagi «Natijalarni ko'rsatish (N)») — `limit: 1`, `meta.total`. */
export const useAdvisorAlertCount = (params: AdvisorAlertCountParams, { enabled = true }: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: queryKeys.aiAdvisor.alertCount(params),
    queryFn: () => getAdvisorAlerts({ ...params, page: 1, limit: 1 }),
    select: (data) => data.meta.total,
    enabled,
    meta: { silentError: true },
  });

/**
 * Tafsilot. ⚠️ GET ogohlantirishni «Ko'rildi» qiladi — prefetch qilinmaydi, `enabled` faqat ID to'g'ri bo'lsa.
 * `pollMs` (> 0) — izoh `pending` bo'lsa shu oraliqda qayta so'raladi (60 s chegarasini chaqiruvchi boshqaradi).
 */
export const useAdvisorAlert = (id: string | null, { pollMs = 0 }: { pollMs?: number } = {}) =>
  useQuery({
    queryKey: queryKeys.aiAdvisor.alert(id ?? ""),
    queryFn: () => getAdvisorAlert(id as string),
    enabled: isAlertId(id),
    staleTime: 0,
    refetchInterval: (query) => (pollMs > 0 && query.state.data?.explanation_status === "pending" ? pollMs : false),
    meta: { silentError: true },
  });
