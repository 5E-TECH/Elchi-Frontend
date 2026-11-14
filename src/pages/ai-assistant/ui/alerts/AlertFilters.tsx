// dizayn-v2: superadmin-ai-assistant-alerts, superadmin-ai-assistant-alerts-filters-mobile
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ListFilter } from "lucide-react";
import type { AiAdvisorAlertStatus } from "../../../../entities/ai-advisor";
import { formatNumberLocalized } from "../../../../shared/lib/formatMoney";
import { Button, SegmentedControl, Select } from "../../../../shared/ui/primitives";
import { useIsPhone } from "../../../../shared/ui/primitives/date/useIsPhone";
import { countSheetOnlyFilters, type AlertFilterValues, type AlertSearchPatch } from "../../model/alertFilters";
import { AlertFiltersSheet } from "./AlertFiltersSheet";
import {
  ALL,
  ruleSelectOptions,
  severitySelectOptions,
  statusSegmentOptions,
  statusSelectOptions,
  type StatusCounts,
} from "./filterOptions";

/** `.el-tab-count` + `action-soft` — «Filtrlar 2» (naqsh `pages/orders/list/OrderFilters.tsx`). */
const COUNT_PILL =
  "inline-flex h-5 min-w-[22px] items-center justify-center rounded-full bg-action-soft px-1.5 text-xs font-semibold text-action-fg";

/** Maket: `flex: 1 1 200px; max-width: 260px` (o'ram — `Select` ildizi flex elementi bo'ladi). */
const SELECT_SLOT = "min-w-0 flex-[1_1_200px] max-w-[260px]";

export type AlertFiltersProps = {
  values: AlertFilterValues;
  /** Holat segmentidagi sonlar (`counts.by_status`, ro'yxat javobidan). */
  counts?: StatusCounts;
  onChange: (patch: AlertSearchPatch) => void;
};

/**
 * «Ogohlantirishlar» filtrlari (maket `superadmin-ai-assistant-alerts`):
 *   ≥ 768 — «Holat» segmenti (Barchasi · Yangi N · Ko'rildi N · Hal qilindi · Ahamiyatsiz) + «Jiddiylik:» va
 *           «Turi:» ro'yxatlari (ichki yorliq); o'zgarish darhol qo'llanadi. Planshetda qator o'raladi.
 *   < 768 — ikki ustun: «Holat:» ro'yxati + «Filtrlar» (pastki varaqa — `AlertFiltersSheet`, qoralama bilan).
 */
export const AlertFilters = ({ values, counts, onChange }: AlertFiltersProps) => {
  const { t, i18n } = useTranslation("aiAdvisor");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const isPhone = useIsPhone();
  const [sheetOpen, setSheetOpen] = useState(false);

  if (isPhone) {
    const hidden = countSheetOnlyFilters(values);
    return (
      <div role="group" aria-label={t("alerts.filters.label")} className="grid min-w-0 grid-cols-2 gap-2">
        <Select<AiAdvisorAlertStatus | "">
          aria-label={t("alerts.filters.status")}
          inlineLabel={t("alerts.filters.status")}
          options={statusSelectOptions(t)}
          value={values.status}
          onChange={(next) => onChange({ status: next ?? "" })}
          placeholder={t("alerts.filters.all")}
          className="min-w-0"
        />
        <Button
          variant="secondary"
          leftIcon={ListFilter}
          className="min-w-0"
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
          onClick={() => setSheetOpen(true)}
        >
          {t("alerts.filters.button")}
          {hidden > 0 ? <span className={COUNT_PILL}>{formatNumberLocalized(hidden, { language })}</span> : null}
        </Button>
        <AlertFiltersSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          initial={values}
          counts={counts}
          onApply={(next) => onChange(next)}
        />
      </div>
    );
  }

  return (
    <div role="group" aria-label={t("alerts.filters.label")} className="flex min-w-0 flex-wrap items-center gap-3">
      <SegmentedControl<AiAdvisorAlertStatus | typeof ALL>
        ariaLabel={t("alerts.filters.status")}
        options={statusSegmentOptions(t, counts, language)}
        value={values.status || ALL}
        onValueChange={(next) => onChange({ status: next === ALL ? "" : next })}
      />
      <div className={SELECT_SLOT}>
        <Select
          aria-label={t("alerts.filters.severity")}
          inlineLabel={t("alerts.filters.severity")}
          options={severitySelectOptions(t)}
          value={values.severity}
          onChange={(next) => onChange({ severity: next ?? "" })}
          placeholder={t("alerts.filters.all")}
        />
      </div>
      <div className={SELECT_SLOT}>
        <Select
          aria-label={t("alerts.filters.rule")}
          inlineLabel={t("alerts.filters.rule")}
          options={ruleSelectOptions(t)}
          value={values.rule}
          onChange={(next) => onChange({ rule: next ?? "" })}
          placeholder={t("alerts.filters.all")}
        />
      </div>
    </div>
  );
};
