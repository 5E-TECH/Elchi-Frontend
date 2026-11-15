// dizayn-v2: superadmin-ai-assistant-alerts
import { useTranslation } from "react-i18next";
import { TriangleAlert } from "lucide-react";
import { ruleName, type AdvisorTranslate, type AiAdvisorOverviewAlerts } from "../../../../entities/ai-advisor";
import { formatNumberLocalized } from "../../../../shared/lib/formatMoney";
import { Button } from "../../../../shared/ui/primitives";

export type CriticalBannerProps = {
  alerts: AiAdvisorOverviewAlerts;
  /** Jadvalda faqat jiddiylar (`?severity=critical`). */
  onlyCritical: boolean;
  /** Shu filtrdagi jami (ro'yxat javobi `meta.total`); hali kelmagan bo'lsa — `null`. */
  filteredTotal: number | null;
  onOnlyCritical: () => void;
  onShowAll: () => void;
};

/**
 * Jiddiy ogohlantirishlar banneri (D11, maket `superadmin-ai-assistant-alerts`): faqat KO'RIB CHIQILMAGAN jiddiylar
 * (`overview.alerts.critical` — `new`) bo'lsa. Ostida qoidalar nomi (`critical_rule_keys`, « · »); «Faqat jiddiylar»
 * jadvalni `severity=critical` ga toraytiradi — shunda matn «Jadvalda faqat jiddiylar: N ta» va «Hammasini
 * ko'rsatish» (jiddiylik filtrini olib tashlaydi; holatni yorliq aytadi — `aria-pressed` yo'q). `.el-alert.el-tone-danger` (CODE-MAP 2.7), amal o'ngda — tor
 * ekranda pastga o'raladi.
 */
export const CriticalBanner = ({ alerts, onlyCritical, filteredTotal, onOnlyCritical, onShowAll }: CriticalBannerProps) => {
  const { t, i18n } = useTranslation("aiAdvisor");
  const language = i18n.resolvedLanguage ?? i18n.language;
  if (alerts.critical <= 0) return null;

  const rules = alerts.critical_rule_keys.map((key) => ruleName(key, t as unknown as AdvisorTranslate)).join(" · ");
  const sub = onlyCritical
    ? filteredTotal === null
      ? t("alerts.banner.filtered")
      : t("alerts.banner.filteredTotal", { value: formatNumberLocalized(filteredTotal, { language }) })
    : rules;

  return (
    <div
      data-testid="ai-alerts-critical-banner"
      className="flex min-w-0 items-start gap-3 rounded-xl bg-danger-soft px-4 py-3 text-sm"
    >
      <TriangleAlert size={20} aria-hidden="true" className="mt-px shrink-0 text-danger-fg" />
      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-1 text-text">
        {/* Jonli hudud — faqat matn (tugma e'lon qilinmaydi). */}
        <div role="status" className="flex min-w-0 flex-col gap-0.5">
          <div className="font-bold">
            {t("alerts.banner.title", { count: alerts.critical, value: formatNumberLocalized(alerts.critical, { language }) })}
          </div>
          {sub ? <span className="text-[13px] leading-[18px]">{sub}</span> : null}
        </div>
        <Button
          variant="link"
          size="sm"
          className="max-md:-ml-1"
          onClick={onlyCritical ? onShowAll : onOnlyCritical}
        >
          {onlyCritical ? t("alerts.banner.showAll") : t("alerts.banner.onlyCritical")}
        </Button>
      </div>
    </div>
  );
};
