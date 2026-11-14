import {
  AI_ADVISOR_SEVERITIES,
  isAlertId,
  isAlertStatus,
  isRuleKey,
  ruleName,
  type AdvisorTranslate,
  type AiAdvisorAlertListParams,
  type AiAdvisorAlertStatus,
  type AiAdvisorRuleKey,
  type AiAdvisorSeverity,
} from "../../../entities/ai-advisor";

/**
 * «Ogohlantirishlar» filtrlari URL'da (D4, maket `superadmin-ai-assistant-alerts`):
 *   `?status=new|seen|resolved|dismissed` · `&severity=warning|critical` · `&rule=R1..R8` (API'da `rule_key`) ·
 *   `&page=N` (1 — yozilmaydi) · `&limit=25|50|100` (10 — sukut, yozilmaydi) · `&alert=:id` — ochiq oyna (S4).
 * Noto'g'ri qiymat e'tiborga olinmaydi va URL'dan olib tashlanadi (backend 400 bermasin); boshqa (begona) kalitlar —
 * `tab`, `conversation` — tegilmaydi. Filtr yoki sahifa o'lchami o'zgarsa — 1-sahifa.
 */

export type AlertFilterValues = {
  status: AiAdvisorAlertStatus | "";
  severity: AiAdvisorSeverity | "";
  rule: AiAdvisorRuleKey | "";
};

export type AlertSearch = {
  filters: AlertFilterValues;
  page: number;
  limit: number;
};

export type AlertSearchPatch = Partial<AlertFilterValues> & { page?: number; limit?: number };

export const EMPTY_ALERT_FILTERS: AlertFilterValues = { status: "", severity: "", rule: "" };

/** v2 `Pagination` o'lchamlari; birinchisi — sukut. */
export const ALERT_PAGE_SIZES = [10, 25, 50, 100] as const;
export const DEFAULT_ALERT_PAGE_SIZE = ALERT_PAGE_SIZES[0];

/** URL kalitlari (oyna — `ALERT_ID_PARAM`, S4 da o'qiladi). */
export const ALERT_URL_PARAMS = { status: "status", severity: "severity", rule: "rule", page: "page", limit: "limit" } as const;
export const ALERT_ID_PARAM = "alert";

const SEVERITY_SET = new Set<string>(AI_ADVISOR_SEVERITIES);
const isSeverity = (value: unknown): value is AiAdvisorSeverity => typeof value === "string" && SEVERITY_SET.has(value);

const isPageSize = (value: number): boolean => (ALERT_PAGE_SIZES as readonly number[]).includes(value);

/** `page` — butun son ≥ 1 (satrda faqat raqamlar: «2abc», «1e3» — noto'g'ri). */
const readPage = (raw: string | null): number | null => {
  if (raw === null || !/^\d{1,6}$/.test(raw)) return null;
  const value = Number(raw);
  return value >= 1 ? value : null;
};

const readLimit = (raw: string | null): number | null => {
  if (raw === null || !/^\d{1,3}$/.test(raw)) return null;
  const value = Number(raw);
  return isPageSize(value) ? value : null;
};

export const readAlertSearch = (params: URLSearchParams): AlertSearch => {
  const status = params.get(ALERT_URL_PARAMS.status);
  const severity = params.get(ALERT_URL_PARAMS.severity);
  const rule = params.get(ALERT_URL_PARAMS.rule);
  return {
    filters: {
      status: isAlertStatus(status) ? status : "",
      severity: isSeverity(severity) ? severity : "",
      rule: isRuleKey(rule) ? rule : "",
    },
    page: readPage(params.get(ALERT_URL_PARAMS.page)) ?? 1,
    limit: readLimit(params.get(ALERT_URL_PARAMS.limit)) ?? DEFAULT_ALERT_PAGE_SIZE,
  };
};

/** Ochiq oyna ID'si (`?alert=`): faqat `^\d{1,18}$`, aks holda `null`. */
export const readAlertId = (params: URLSearchParams): string | null => {
  const id = params.get(ALERT_ID_PARAM);
  return isAlertId(id) ? id : null;
};

/** URL'ga yoziladigan ko'rinish: bo'sh filtr, 1-sahifa va sukut o'lcham yozilmaydi. */
const writeSearch = (next: URLSearchParams, search: AlertSearch) => {
  const set = (key: string, value: string) => {
    if (value) next.set(key, value);
    else next.delete(key);
  };
  set(ALERT_URL_PARAMS.status, search.filters.status);
  set(ALERT_URL_PARAMS.severity, search.filters.severity);
  set(ALERT_URL_PARAMS.rule, search.filters.rule);
  set(ALERT_URL_PARAMS.page, search.page > 1 ? String(search.page) : "");
  set(ALERT_URL_PARAMS.limit, search.limit !== DEFAULT_ALERT_PAGE_SIZE ? String(search.limit) : "");
};

/**
 * Yangi URL parametrlari. Filtr qiymati yoki sahifa o'lchami haqiqatan o'zgarsa — 1-sahifa (o'sha qiymat qayta
 * yuborilsa sahifa saqlanadi). Begona kalitlar (`tab`, `conversation`, `alert`) saqlanadi.
 */
export const applyAlertSearch = (current: URLSearchParams, patch: AlertSearchPatch): URLSearchParams => {
  const was = readAlertSearch(current);
  const filters: AlertFilterValues = {
    status: patch.status !== undefined ? patch.status : was.filters.status,
    severity: patch.severity !== undefined ? patch.severity : was.filters.severity,
    rule: patch.rule !== undefined ? patch.rule : was.filters.rule,
  };
  const limit = patch.limit !== undefined && isPageSize(patch.limit) ? patch.limit : was.limit;
  const reset =
    filters.status !== was.filters.status ||
    filters.severity !== was.filters.severity ||
    filters.rule !== was.filters.rule ||
    limit !== was.limit;
  const page = patch.page !== undefined ? Math.max(1, Math.trunc(patch.page)) : reset ? 1 : was.page;
  const next = new URLSearchParams(current);
  writeSearch(next, { filters, page, limit });
  return next;
};

/**
 * URL'dagi noto'g'ri qiymatlar (`?status=foo`, `?page=0`, `?limit=7`, `?page=1`) — tozalangan nusxa; hammasi to'g'ri
 * bo'lsa `null` (qayta yozilmaydi).
 */
export const cleanAlertSearch = (current: URLSearchParams): URLSearchParams | null => {
  const next = new URLSearchParams(current);
  writeSearch(next, readAlertSearch(current));
  return next.toString() === current.toString() ? null : next;
};

/** API parametrlari (`rule` → `rule_key`; `limit` doim aniq). */
export const toAlertListParams = (search: AlertSearch): AiAdvisorAlertListParams => ({
  ...toAlertCountParams(search.filters),
  page: search.page,
  limit: search.limit,
});

/** Soni so'rovi uchun (telefon varag'idagi «Natijalarni ko'rsatish (N)»). */
export const toAlertCountParams = (filters: AlertFilterValues): Omit<AiAdvisorAlertListParams, "page" | "limit"> => {
  const params: Omit<AiAdvisorAlertListParams, "page" | "limit"> = {};
  if (filters.status) params.status = filters.status;
  if (filters.severity) params.severity = filters.severity;
  if (filters.rule) params.rule_key = filters.rule;
  return params;
};

/** Tanlangan filtrlar soni (holat ham — varaqa sarlavhasi «2 ta filtr tanlangan»). */
export const countActiveFilters = (filters: AlertFilterValues): number =>
  Number(Boolean(filters.status)) + Number(Boolean(filters.severity)) + Number(Boolean(filters.rule));

/** Telefon «Filtrlar» tugmasidagi son — varaqadagi, asboblar qatorida ko'rinmaydigan filtrlar (jiddiylik, turi). */
export const countSheetOnlyFilters = (filters: AlertFilterValues): number =>
  Number(Boolean(filters.severity)) + Number(Boolean(filters.rule));

/** Bo'sh holat izohi: «Jiddiy · Zarar · Yangi — hech narsa topilmadi.» (jiddiylik · turi · holat). */
export const filterSummary = (filters: AlertFilterValues, t: AdvisorTranslate): string =>
  [
    filters.severity ? t(`alerts.severity.${filters.severity}`) : "",
    filters.rule ? ruleName(filters.rule, t) : "",
    filters.status ? t(`alerts.status.${filters.status}`) : "",
  ]
    .filter(Boolean)
    .join(" · ");

/** Oyna havolasi (`?…&alert=<id>`) — joriy parametrlar saqlanadi (tab, filtrlar, sahifa). */
export const alertSearchWithId = (current: URLSearchParams, id: string): string => {
  const next = new URLSearchParams(current);
  next.set(ALERT_ID_PARAM, id);
  return `?${next.toString()}`;
};
