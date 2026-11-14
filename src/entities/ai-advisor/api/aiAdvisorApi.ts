import { api } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";
import {
  normalizeAlertDetail,
  normalizeAlertList,
  normalizeExplainResult,
  normalizeOverview,
  normalizeSettings,
} from "../model/advisorNormalize";
import type {
  AiAdvisorAlertDetail,
  AiAdvisorAlertListData,
  AiAdvisorAlertListParams,
  AiAdvisorAlertPatchRequest,
  AiAdvisorExplainResult,
  AiAdvisorOverview,
  AiAdvisorSettings,
  AiAdvisorSettingsPatch,
} from "../model/advisorTypes";

/**
 * AI maslahatchi API (shartnoma v0.3; FAQAT superadmin). Zond so'rovlari (`overview`, `settings`) — backend hali
 * deploy qilinmagan muhitda ham sahifani buzmasin: 15 s, `failFast` (60 s li jim qayta urinish yo'q),
 * `silentNetworkError` (har daqiqadagi fon so'rovi uzilishda global xabar ochmaydi). Yozuvlar (PATCH, explain) —
 * xato oynaning o'zida ko'rsatiladi, shuning uchun ham `silentNetworkError`.
 */
export const ADVISOR_PROBE_TIMEOUT_MS = 15_000;

const PROBE_CONFIG = { failFast: true, timeout: ADVISOR_PROBE_TIMEOUT_MS, silentNetworkError: true } as const;
const WRITE_CONFIG = { silentNetworkError: true } as const;

/** Tab nishonlari, banner va mavjudlik zondi (`GET ai/advisor/overview`). Boshqa shakl — `AdvisorShapeError`. */
export const getAdvisorOverview = async (): Promise<AiAdvisorOverview> => {
  const { data } = await api.get(API_ENDPOINTS.AI_ADVISOR.OVERVIEW, PROBE_CONFIG);
  return normalizeOverview(data);
};

/** Ro'yxat — faqat berilgan filtrlar; `page` va `limit` doim aniq (holatni o'zgartirmaydi). */
export const getAdvisorAlerts = async (params: AiAdvisorAlertListParams): Promise<AiAdvisorAlertListData> => {
  const query: Record<string, string | number> = { page: params.page, limit: params.limit };
  if (params.status) query.status = params.status;
  if (params.severity) query.severity = params.severity;
  if (params.rule_key) query.rule_key = params.rule_key;
  const { data } = await api.get(API_ENDPOINTS.AI_ADVISOR.ALERTS, { params: query });
  return normalizeAlertList(data);
};

/** ⚠️ Yon ta'sirli: `new` → `seen`. Faqat oyna ochilganda (prefetch / hover'da emas). */
export const getAdvisorAlert = async (id: string): Promise<AiAdvisorAlertDetail> => {
  const { data } = await api.get(API_ENDPOINTS.AI_ADVISOR.ALERT(id));
  return normalizeAlertDetail(data);
};

/** AI izohini so'rash — doim 202 (`pending` → poll, tayyori — `ready`). */
export const explainAdvisorAlert = async (id: string): Promise<AiAdvisorExplainResult> => {
  const { data } = await api.post(API_ENDPOINTS.AI_ADVISOR.ALERT_EXPLAIN(id), {}, WRITE_CONFIG);
  return normalizeExplainResult(data);
};

/** «Hal qilindi» / «Ahamiyatsiz» → yangilangan tafsilot (idempotent: ayni foydalanuvchi, ayni holat — 200). */
export const updateAdvisorAlert = async (id: string, body: AiAdvisorAlertPatchRequest): Promise<AiAdvisorAlertDetail> => {
  const { data } = await api.patch(API_ENDPOINTS.AI_ADVISOR.ALERT(id), body, WRITE_CONFIG);
  return normalizeAlertDetail(data);
};

/** Qoidalar sozlamasi va chegaralar (`limits`) — zond sifatida ham. */
export const getAdvisorSettings = async (): Promise<AiAdvisorSettings> => {
  const { data } = await api.get(API_ENDPOINTS.AI_ADVISOR.SETTINGS, PROBE_CONFIG);
  return normalizeSettings(data);
};

/** Qisman, hammasi yoki hech narsa (`version` majburiy) → to'liq sozlamalar. */
export const updateAdvisorSettings = async (body: AiAdvisorSettingsPatch): Promise<AiAdvisorSettings> => {
  const { data } = await api.patch(API_ENDPOINTS.AI_ADVISOR.SETTINGS, body, WRITE_CONFIG);
  return normalizeSettings(data);
};
