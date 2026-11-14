import { getErrorStatus } from "../../../shared/lib/errorKind";
import { isAdvisorShapeError } from "./advisorNormalize";
import {
  AI_ADVISOR_ALERT_STATUSES,
  AI_ADVISOR_ERROR_CODES,
  type AiAdvisorAlertStatus,
  type AiAdvisorBudgetPeriod,
  type AiAdvisorBudgetScope,
  type AiAdvisorErrorCode,
} from "./advisorTypes";

/**
 * Advisor xatosi: HTTP holati, kod (`AI_ADVISOR_*` — faqat `PUBLIC_ERROR_CODES` dagilar javobga chiqadi) va shu kodga
 * ruxsat etilgan maydonlar (§8). Kodsiz 400 (class-validator), 401/403 (`RolesGuard`), 504 — `code: null`.
 */
export interface AdvisorErrorFields {
  /** `INVALID_RULE` / `INVALID_SETTING`: `rules.R1.consecutive_negative`, `version` … */
  field: string | null;
  min: number | null;
  max: number | null;
  /** `NOTE_INVALID`: `required | too_short | too_long`; `AI_DISABLED`: `ai_disabled | feature_disabled | budget_unreadable`. */
  reason: string | null;
  min_length: number | null;
  max_length: number | null;
  /** `BUDGET_EXCEEDED`: qaysi budjet va davr, tiklanish vaqti. */
  scope: AiAdvisorBudgetScope | null;
  period: AiAdvisorBudgetPeriod | null;
  reset_at: string | null;
  retry_after_seconds: number | null;
  /** `ALERT_CLOSED`: ogohlantirishning joriy holati. */
  alert_status: AiAdvisorAlertStatus | null;
  /** `SETTINGS_CONFLICT`: joriy versiya. */
  version: number | null;
}

export interface AdvisorErrorInfo {
  status: number | undefined;
  code: AiAdvisorErrorCode | null;
  fields: AdvisorErrorFields;
}

const KNOWN_CODES = new Set<string>(Object.values(AI_ADVISOR_ERROR_CODES));

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);

/** axios xatosi (yoki `{ response: { status, data } }`) → holat, kod va maydonlar. */
export const readAdvisorError = (error: unknown): AdvisorErrorInfo => {
  const data = asRecord(asRecord(asRecord(error)?.response)?.data);
  const code = text(data?.code);
  const scope = data?.scope;
  const period = data?.period;
  const alertStatus = data?.alert_status;
  return {
    status: getErrorStatus(error),
    code: code && KNOWN_CODES.has(code) ? (code as AiAdvisorErrorCode) : null,
    fields: {
      field: text(data?.field),
      min: num(data?.min),
      max: num(data?.max),
      reason: text(data?.reason),
      min_length: num(data?.min_length),
      max_length: num(data?.max_length),
      scope: scope === "advisor" || scope === "global" ? scope : null,
      period: period === "month" || period === "day" ? period : null,
      reset_at: text(data?.reset_at),
      retry_after_seconds: num(data?.retry_after_seconds),
      alert_status: (AI_ADVISOR_ALERT_STATUSES as readonly unknown[]).includes(alertStatus)
        ? (alertStatus as AiAdvisorAlertStatus)
        : null,
      version: num(data?.version),
    },
  };
};

/** Zond natijasi: backend yo'q (`absent`), ruxsat yo'q (`forbidden`) yoki vaqtinchalik xato (`transient`). */
export type AdvisorUnavailableReason = "absent" | "forbidden" | "transient";

/** Endpoint umuman yo'q: 404 (marshrut yo'q), 405, 501 — yoki javob boshqa shaklda (`AdvisorShapeError`). */
const ABSENT_STATUSES = new Set([404, 405, 501]);

/**
 * Mavjudlik zondi xatosini tasniflaydi (D2): 404/405/501 va noto'g'ri shakl — `absent` (sessiya davomida keshda);
 * 401 (token yangilangandan keyin ham) va 403 — `forbidden` (ruxsat yo'q deb hisoblanadi); qolgani — tarmoq, vaqt
 * chegarasi, 5xx/504, 429 va boshqa — `transient` (5 daqiqadan keyin qayta so'raladi).
 */
export const classifyProbeError = (error: unknown): AdvisorUnavailableReason => {
  if (isAdvisorShapeError(error)) return "absent";
  const status = getErrorStatus(error);
  if (status !== undefined && ABSENT_STATUSES.has(status)) return "absent";
  if (status === 401 || status === 403) return "forbidden";
  return "transient";
};
