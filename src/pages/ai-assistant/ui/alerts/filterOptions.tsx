// dizayn-v2: superadmin-ai-assistant-alerts, superadmin-ai-assistant-alerts-filters-mobile
import type { TFunction } from "i18next";
import {
  AI_ADVISOR_ALERT_STATUSES,
  AI_ADVISOR_RULE_KEYS,
  AI_ADVISOR_SEVERITIES,
  type AiAdvisorAlertStatus,
  type AiAdvisorRuleKey,
  type AiAdvisorSeverity,
} from "../../../../entities/ai-advisor";
import { formatNumberLocalized } from "../../../../shared/lib/formatMoney";
import type { SegmentedOption, SelectOption } from "../../../../shared/ui/primitives";

/** Segmentdagi «Barchasi» (URL'da — bo'sh). */
export const ALL = "all";

export type StatusCounts = Partial<Record<AiAdvisorAlertStatus, number>>;

/** `.el-tab-count` — segment ichidagi son (maket «Yangi 3», «Ko'rildi 3»). */
const COUNT_PILL =
  "ml-1 inline-flex h-5 min-w-[22px] items-center justify-center rounded-full bg-sunken px-1.5 align-middle " +
  "text-xs font-semibold text-text-muted";

/** Son faqat ochiq holatlarda (maketdagidek: «Hal qilindi», «Ahamiyatsiz» — sonsiz). */
const COUNTED: ReadonlySet<AiAdvisorAlertStatus> = new Set(["new", "seen"]);

/** «Holat» segmenti: Barchasi · Yangi N · Ko'rildi N · Hal qilindi · Ahamiyatsiz. */
export const statusSegmentOptions = (
  t: TFunction,
  counts: StatusCounts | undefined,
  language: string,
): SegmentedOption<AiAdvisorAlertStatus | typeof ALL>[] => [
  { value: ALL, label: t("alerts.filters.all") },
  ...AI_ADVISOR_ALERT_STATUSES.map((status) => {
    const count = COUNTED.has(status) ? counts?.[status] : undefined;
    return {
      value: status,
      label:
        count === undefined ? (
          t(`alerts.status.${status}`)
        ) : (
          <>
            {t(`alerts.status.${status}`)}{" "}
            <span className={COUNT_PILL}>{formatNumberLocalized(count, { language })}</span>
          </>
        ),
    };
  }),
];

/** «Holat» ro'yxati (telefon asboblar qatori). */
export const statusSelectOptions = (t: TFunction): SelectOption<AiAdvisorAlertStatus | "">[] => [
  { value: "", label: t("alerts.filters.all") },
  ...AI_ADVISOR_ALERT_STATUSES.map((status) => ({ value: status, label: t(`alerts.status.${status}`) })),
];

/** «Jiddiylik»: Barchasi · Jiddiy · Diqqat (maket tartibi). */
const SEVERITY_ORDER: readonly AiAdvisorSeverity[] = [...AI_ADVISOR_SEVERITIES].reverse();

export const severitySelectOptions = (t: TFunction): SelectOption<AiAdvisorSeverity | "">[] => [
  { value: "", label: t("alerts.filters.all") },
  ...SEVERITY_ORDER.map((severity) => ({ value: severity, label: t(`alerts.severity.${severity}`) })),
];

export const severitySegmentOptions = (t: TFunction): SegmentedOption<AiAdvisorSeverity | typeof ALL>[] => [
  { value: ALL, label: t("alerts.filters.all") },
  ...SEVERITY_ORDER.map((severity) => ({ value: severity, label: t(`alerts.severity.${severity}`) })),
];

/** «Turi»: Barchasi + 8 qoida (R1–R8 tartibida). */
export const ruleSelectOptions = (t: TFunction): SelectOption<AiAdvisorRuleKey | "">[] => [
  { value: "", label: t("alerts.filters.all") },
  ...AI_ADVISOR_RULE_KEYS.map((rule) => ({ value: rule, label: t(`rules.${rule}.name`) })),
];
