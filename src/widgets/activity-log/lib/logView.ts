import {
  humanizeActivityAction,
  type ActivityLog,
  type ActivityLogParams,
} from "../../../entities/activity-log";
import { getUserRoleLabelKey, USER_ROLE_LABEL_KEYS } from "../../../entities/user/lib/role";
import { ORDER_STATUS_NS, ORDER_STATUS_REGISTRY, resolveDisplayOrderStatus } from "../../../entities/order";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";

/**
 * Faoliyat jurnali — qatorni ko'rinishga tayyorlash (maket `superadmin-activity-logs-list`):
 * «Kim» (ism + rol), «Amal» (yorliq), «Obyekt» (tur + raqam, ostida nom), «Xizmat», tafsilot (maydon
 * o'zgarishlari va qo'shimcha ma'lumot). API bermaydigan narsa chizilmaydi (masalan buyurtmada mijoz ismi —
 * gateway `entity` da faqat `id/status/total_price…`).
 */

/** `useTranslation("activityLogs").t` (kalit + parametrlar → matn). */
export type Translate = (key: string, options?: Record<string, unknown>) => string;

export type LogFilters = {
  search: string;
  service: string;
  action: string;
  entityType: string;
  userId: string;
  dateFrom: string;
  dateTo: string;
};

export const EMPTY_LOG_FILTERS: LogFilters = {
  search: "",
  service: "",
  action: "",
  entityType: "",
  userId: "",
  dateFrom: "",
  dateTo: "",
};

/** Sheet'dagi (telefon) filtrlar soni: xizmat, amal, obyekt turi, foydalanuvchi ID. */
export const countSheetFilters = (filters: LogFilters) =>
  [filters.service, filters.action, filters.entityType.trim(), filters.userId.trim()].filter(Boolean).length;

/** `YYYY-MM-DD` → mahalliy kun boshi / oxiri (ISO) — avvalgi `dayjs().startOf/endOf("day")` bilan bir xil. */
const dayBoundary = (iso: string, end: boolean): string | undefined => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return undefined;
  const [, y, m, d] = match.map(Number);
  const date = end ? new Date(y, m - 1, d, 23, 59, 59, 999) : new Date(y, m - 1, d, 0, 0, 0, 0);
  return date.toISOString();
};

export const buildLogParams = (filters: LogFilters, debouncedSearch: string, page: number, limit: number) => {
  const next: ActivityLogParams = { page, limit };
  if (debouncedSearch) next.search = debouncedSearch;
  if (filters.service) next.service = filters.service;
  if (filters.action) next.action = filters.action;
  if (filters.entityType.trim()) next.entity_type = filters.entityType.trim();
  if (filters.userId.trim()) next.user_id = filters.userId.trim();
  const from = dayBoundary(filters.dateFrom, false);
  const to = dayBoundary(filters.dateTo, true);
  if (from) next.from = from;
  if (to) next.to = to;
  return next;
};

const text = (value: unknown) => (value == null ? "" : String(value).trim());

export const actorName = (log: ActivityLog, t: Translate) =>
  text(log.actor?.name) || text(log.user_name) || (log.actor_status === "system" ? t("system") : text(log.user_id)) || "—";

/** Rol yorlig'i (`users:role*`); noma'lum rol — o'zi (yangi backend roli yashirilmaydi). */
export const actorRole = (log: ActivityLog, t: Translate) => {
  const role = text(log.actor?.role) || text(log.user_role);
  if (!role) return "";
  return role in USER_ROLE_LABEL_KEYS ? t(getUserRoleLabelKey(role), { ns: "users" }) : role;
};

export const serviceLabel = (service: string | null, t: Translate) =>
  service ? t(`services.${service}`, { defaultValue: service }) : "";

export const entityTypeLabel = (type: string, t: Translate) => (type ? t(`entityTypes.${type}`, { defaultValue: type }) : "—");

/** Buyurtma — «№10227», qolganlari — «#48» (maket). */
export const entityRef = (log: ActivityLog) => {
  if (!log.entity_id) return "";
  return log.entity_type === "Order" ? `№${log.entity_id}` : `#${log.entity_id}`;
};

/** Obyekt nomi: gateway `entity` xulosasidan (foydalanuvchi, filial, mahsulot — `name`). */
export const entityName = (log: ActivityLog) => text(log.entity?.name) || text(log.entity?.title);

/** «Buyurtma №10227» — chevron nomi va kartadagi sarlavha uchun. */
export const entityTitle = (log: ActivityLog, t: Translate) =>
  [entityTypeLabel(log.entity_type, t), entityRef(log)].filter(Boolean).join(" ");

/**
 * Amal yorlig'i: asosiy 16 fe'l — tarjima (`actions.*`); qolgani — o'zbekchada backend reyestri
 * (`action_meta.label` / katalog), boshqa tillarda o'qiladigan ko'rinish.
 */
export const actionLabel = (
  action: string,
  t: Translate,
  language: string,
  registry?: ReadonlyMap<string, string>,
  metaLabel?: string,
) => {
  if (!action) return "—";
  if (!action.includes(".")) {
    const translated = t(`actions.${action}`, { defaultValue: "" });
    if (translated) return translated;
  }
  const backendLabel = metaLabel || registry?.get(action);
  if (backendLabel && language.startsWith("uz")) return backendLabel;
  return humanizeActivityAction(action);
};

/** Ikki holat orasida o'zgargan maydonlar (avvalgi `changedKeys` qoidasi). */
export const changedKeys = (before: Record<string, unknown> | null, after: Record<string, unknown> | null) => {
  const keys = new Set<string>([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  return [...keys].filter((key) => rawText(before?.[key]) !== rawText(after?.[key]));
};

const rawText = (value: unknown): string => {
  if (value == null) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** Tafsilotdagi qiymat: sana — «Bugun, 14:32», buyurtma holati — yorliq, mantiqiy — «Ha/Yo'q». */
export const displayValue = (
  value: unknown,
  { key, entityType, t, language }: { key: string; entityType: string; t: Translate; language: string },
): string => {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? t("detail.yes") : t("detail.no");
  if (typeof value === "string" && ISO_DATE_TIME.test(value)) return formatDateTimeLocalized(value, { language });
  if (key === "status" && entityType === "Order") {
    const status = resolveDisplayOrderStatus(value);
    if (status) return t(ORDER_STATUS_REGISTRY[status].labelKey, { ns: ORDER_STATUS_NS });
  }
  return rawText(value);
};

/** Qo'shimcha ma'lumot qatorlari (metadata — kalit/qiymat, bo'sh qiymatlarsiz). */
export const metadataEntries = (log: ActivityLog) =>
  Object.entries(log.metadata ?? {}).filter(([, value]) => value !== null && value !== undefined && value !== "");

/** Ochiladigan qator: maydon o'zgarishi yoki qo'shimcha ma'lumot bo'lsa (o'zgarishsiz yozuvda chevron yo'q). */
export const hasLogDetails = (log: ActivityLog) =>
  changedKeys(log.old_value, log.new_value).length > 0 || metadataEntries(log).length > 0;

export const logRowKey = (log: ActivityLog) => `${log.service ?? ""}-${log.id}`;
