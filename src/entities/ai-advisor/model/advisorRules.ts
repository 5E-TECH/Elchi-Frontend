import {
  AI_ADVISOR_ALERT_STATUSES,
  AI_ADVISOR_RULE_KEYS,
  type AiAdvisorAlertStatus,
  type AiAdvisorFieldLimit,
  type AiAdvisorLimitUnit,
  type AiAdvisorRuleKey,
  type AiAdvisorRuleLimits,
  type AiAdvisorSeverity,
  type AiAdvisorThresholdField,
} from "./advisorTypes";

/**
 * Qoidalar R1–R8 haqidagi doimiylar — backend #644 (`advisor.contract.ts`) bilan bir xil: sukut darajasi (Q1 —
 * superadmin tanlamaydi), Telegram sukuti (Q2 c — R7 `false`), chegaralar (`limits`, server bermasa — zaxira) va
 * sozlama oynasidagi maydonlar tartibi.
 */

const RULE_KEY_SET = new Set<string>(AI_ADVISOR_RULE_KEYS);
const STATUS_SET = new Set<string>(AI_ADVISOR_ALERT_STATUSES);

export const isRuleKey = (value: unknown): value is AiAdvisorRuleKey => typeof value === "string" && RULE_KEY_SET.has(value);

export const isAlertStatus = (value: unknown): value is AiAdvisorAlertStatus =>
  typeof value === "string" && STATUS_SET.has(value);

/** Ogohlantirish ID'si (gateway naqshi `^\d{1,18}$`): boshqasi so'ralmaydi — 400 o'rniga «topilmadi». */
export const isAlertId = (value: unknown): value is string => typeof value === "string" && /^\d{1,18}$/.test(value);

/** Ochiq (amal qilsa bo'ladi): `new`, `seen`. Yopilgani (`resolved`, `dismissed`) — qaytmaydi. */
export const isAlertOpen = (status: AiAdvisorAlertStatus) => status === "new" || status === "seen";

/** Qoida darajasi — qotirilgan (Q1, #644 `AI_ADVISOR_RULE_SEVERITY`): R2, R6, R7 — jiddiy. */
export const RULE_SEVERITY_DEFAULT: Readonly<Record<AiAdvisorRuleKey, AiAdvisorSeverity>> = Object.freeze({
  R1: "warning",
  R2: "critical",
  R3: "warning",
  R4: "warning",
  R5: "warning",
  R6: "critical",
  R7: "critical",
  R8: "warning",
});

/** `rules.<R>.telegram` sukuti (Q2 c): R7 jiddiy, lekin Telegram'ga yuborilmaydi. */
export const RULE_TELEGRAM_DEFAULT: Readonly<Record<AiAdvisorRuleKey, boolean>> = Object.freeze({
  R1: true,
  R2: true,
  R3: true,
  R4: true,
  R5: true,
  R6: true,
  R7: false,
  R8: true,
});

const uzs = (value: number): AiAdvisorFieldLimit => ({ min: 1, max: 1_000_000_000, step: 1, unit: "uzs", default: value });
const days = (value: number): AiAdvisorFieldLimit => ({ min: 1, max: 60, step: 1, unit: "days", default: value });

/**
 * Chegaralar zaxirasi — #644 `AI_ADVISOR_RULE_LIMITS` nusxasi. Forma avval serverdagi `limits` ni o'qiydi; server
 * maydon bermasa (eski javob) — shu.
 */
export const DEFAULT_RULE_LIMITS: Readonly<Record<AiAdvisorRuleKey, AiAdvisorRuleLimits>> = Object.freeze({
  R1: {
    shortage_uzs: uzs(50_000),
    consecutive_negative: { min: 2, max: 30, step: 1, unit: "count", default: 3 },
  },
  R2: { balance_uzs: uzs(2_000_000), growth_days: days(3), no_handover_days: days(3) },
  R3: { mad_multiplier: { min: 1, max: 10, step: 0.1, unit: "multiplier", default: 3 } },
  R4: { days_without_payout: days(7) },
  R5: { balance_uzs: uzs(5_000_000), days_without_transfer: days(3) },
  R6: {},
  R7: {},
  // `min_count` — ega qarori 2026-11-14 (#653 review): haftada kamida N ta tuzatish bo'lmasa jim (UI'da yo'q, Q12).
  R8: {
    ratio: { min: 1.1, max: 10, step: 0.1, unit: "multiplier", default: 2 },
    min_count: { min: 1, max: 50, step: 1, unit: "count", default: 3 },
  },
});

export type ThresholdInputMode = "numeric" | "decimal";

/** Sozlama oynasidagi bitta chegara maydoni (maket `superadmin-ai-assistant-settings-rules-dialog`). */
export interface ThresholdFieldSpec {
  field: AiAdvisorThresholdField;
  /** `aiAdvisor:` kaliti — maydon yorlig'i. */
  labelKey: string;
  unit: AiAdvisorLimitUnit;
  /** Butun son — `numeric` klaviatura, `step: 0.1` — `decimal` (§7.6). */
  inputMode: ThresholdInputMode;
  /** Doimiy izoh (`{{value}}` — joriy qiymat): R3 «Mediana + 3 × mediana og'ishi», R4 «Qarz bo'lsa». */
  hintKey?: string;
  /**
   * Q12: R8 `ratio` va `min_count` sozlamada bor, maketda maydon yo'q — UI ko'rsatmaydi va PATCH ga kiritmaydi
   * (backend qisman birlashtiradi — saqlangan qiymat o'zgarmaydi), lekin normalizator saqlaydi.
   */
  hidden?: boolean;
}

const spec = (
  rule: AiAdvisorRuleKey,
  field: AiAdvisorThresholdField,
  unit: AiAdvisorLimitUnit,
  extra: Partial<Pick<ThresholdFieldSpec, "hintKey" | "hidden">> = {},
): ThresholdFieldSpec => ({
  field,
  labelKey: `rules.${rule}.fields.${field}`,
  unit,
  inputMode: unit === "multiplier" ? "decimal" : "numeric",
  ...extra,
});

/** Har qoidaning chegara maydonlari — maketdagi tartibda (R6/R7 — faqat kalit). */
export const THRESHOLD_FIELDS: Readonly<Record<AiAdvisorRuleKey, readonly ThresholdFieldSpec[]>> = Object.freeze({
  R1: [spec("R1", "shortage_uzs", "uzs"), spec("R1", "consecutive_negative", "count")],
  R2: [spec("R2", "balance_uzs", "uzs"), spec("R2", "growth_days", "days"), spec("R2", "no_handover_days", "days")],
  R3: [spec("R3", "mad_multiplier", "multiplier", { hintKey: "rules.R3.hints.mad_multiplier" })],
  R4: [spec("R4", "days_without_payout", "days", { hintKey: "rules.R4.hints.days_without_payout" })],
  R5: [spec("R5", "balance_uzs", "uzs"), spec("R5", "days_without_transfer", "days")],
  R6: [],
  R7: [],
  R8: [spec("R8", "ratio", "multiplier", { hidden: true }), spec("R8", "min_count", "count", { hidden: true })],
});

/** Izoh so'rovidan keyin poll: oraliq sukuti, eng kichigi va kutish chegarasi (D15). */
export const ADVISOR_EXPLAIN_POLL_DEFAULT_MS = 2_000;
export const ADVISOR_EXPLAIN_POLL_MIN_MS = 1_000;
export const ADVISOR_EXPLAIN_POLL_MAX_WAIT_MS = 60_000;

/** Server bergan poll oralig'i (`explanation_poll_after_ms` / `poll_after_ms`) → ishlatiladigan ms (≥ 1 s). */
export const explanationPollInterval = (value: number | null | undefined): number =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.max(ADVISOR_EXPLAIN_POLL_MIN_MS, Math.round(value))
    : ADVISOR_EXPLAIN_POLL_DEFAULT_MS;
