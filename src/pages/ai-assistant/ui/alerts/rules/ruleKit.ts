import { useTranslation } from "react-i18next";
import {
  DEFAULT_RULE_LIMITS,
  ruleConditionText,
  type AdvisorTranslate,
  type AiAdvisorAlertDetail,
  type AiAdvisorLink,
  type AiAdvisorRuleKey,
  type AiAdvisorThresholdField,
} from "../../../../../entities/ai-advisor";
import { formatDateTimeLocalized } from "../../../../../shared/lib/formatDateTime";
import {
  formatMoneyLocalized,
  formatNumberLocalized,
  formatSignedMoneyLocalized,
} from "../../../../../shared/lib/formatMoney";

/** Dalil jadvalidagi sarlavha katagi havolasi (`.el-cell-title` havola). */
export const TITLE_LINK = "font-semibold whitespace-nowrap text-text hover:text-action-fg hover:underline";

/** Qoida tanalari uchun umumiy formatlovchilar (til — i18n joriy tili). */
export const useRuleFormat = () => {
  const { t, i18n } = useTranslation("aiAdvisor");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const tt = t as unknown as AdvisorTranslate;
  return {
    t: tt,
    language,
    /** «2 840 000 so'm» */
    money: (value: number) => formatMoneyLocalized(value, { language }),
    /** «2 840 000» (valyutasiz — «qiymat / chegara so'm» juftligida birinchisi). */
    bare: (value: number) => formatMoneyLocalized(value, { language, withCurrency: false }),
    /** «+610 000 so'm» / «−380 000 so'm» (U+2212). */
    signed: (value: number) => formatSignedMoneyLocalized(value, { language }),
    /** «Bugun, 14:00» / «19.10.2026, 18:20». */
    at: (value: string) => formatDateTimeLocalized(value, { language }),
    /** Butun son («14»). */
    count: (value: number) => formatNumberLocalized(value, { language }),
    /** Nisbat, bir kasr xona («3,4», «2»). */
    ratio: (value: number) => formatNumberLocalized(value, { language, fractionDigits: 1 }),
    /** «4 kun» */
    days: (value: number) => tt("alerts.units.days", { count: value }),
    /** «3 kun» (… dan ortiq) */
    daysOver: (value: number) => tt("alerts.units.daysOver", { count: value }),
    /** «14 ta» */
    items: (value: number) => tt("alerts.units.items", { count: value }),
    /** Ochilgan paytdagi qoida sharti («Qoida» qatori). */
    condition: (alert: AiAdvisorAlertDetail) => ruleConditionText(alert.rule, tt, language),
  };
};

export type RuleFormat = ReturnType<typeof useRuleFormat>;

/** Ochilgan paytdagi chegara (`rule.thresholds`); yo'q bo'lsa — #644 sukuti; u ham yo'q — `null`. */
export const ruleThreshold = (alert: AiAdvisorAlertDetail, key: AiAdvisorRuleKey, field: AiAdvisorThresholdField): number | null =>
  alert.rule.thresholds[field] ?? DEFAULT_RULE_LIMITS[key][field]?.default ?? null;

/** O'lchagich toni — ogohlantirish jiddiyligidan (maketlar: R2 jiddiy — qizil, R3/R5 diqqat — sariq). */
export const severityTone = (alert: AiAdvisorAlertDetail): "danger" | "warning" =>
  alert.severity === "critical" ? "danger" : "warning";

/** Shu turdagi havola (`links[].kind`) — dalil qatorlari uchun (masalan kuryer kassasi). */
export const linkOfKind = (alert: AiAdvisorAlertDetail, kind: string): AiAdvisorLink | null =>
  alert.links.find((link) => link.kind === kind) ?? null;
