// dizayn-v2: superadmin-ai-assistant-alerts-filters-mobile
import { useId, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  AI_ADVISOR_RULE_KEYS,
  useAdvisorAlertCount,
  type AiAdvisorAlertStatus,
  type AiAdvisorSeverity,
} from "../../../../entities/ai-advisor";
import { formatNumberLocalized } from "../../../../shared/lib/formatMoney";
import { Button, Dialog, Pressable, SegmentedControl } from "../../../../shared/ui/primitives";
import {
  countActiveFilters,
  EMPTY_ALERT_FILTERS,
  toAlertCountParams,
  type AlertFilterValues,
} from "../../model/alertFilters";
import { ALL, ruleSelectOptions, severitySegmentOptions, statusSegmentOptions, type StatusCounts } from "./filterOptions";

/**
 * «Filtrlar» pastki varaqasi — telefon (< 768), maket `superadmin-ai-assistant-alerts-filters-mobile` (naqsh —
 * `pages/orders/list/OrderFiltersSheet.tsx`). QORALAMA bilan ishlaydi: «Natijalarni ko'rsatish (N)» URL'ga bir marta
 * yozadi va yopadi; ×, fon yoki tutqich — o'zgarishlar bekor; «Tozalash» — faqat qoralamani tozalaydi. N — qoralama
 * bo'yicha `GET ai/advisor/alerts?limit=1` dagi `meta.total` (yuklanayotganda yoki xatoda son yozilmaydi).
 *
 * Bo'limlar: Holat (segment, ikki qatorga o'raladi: 3 + 2) → Jiddiylik (segment) → Turi (chiplar, bitta tanlov,
 * «8 ta qoida»).
 */

/** `.el-label` — `Field` yorlig'i bilan bir xil. */
const LABEL = "min-w-0 text-[13px] font-semibold text-text";

/** `.el-chip` (`aria-pressed`) — CODE-MAP 2.2; telefonda 44 px. */
const CHIP =
  "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border border-border-strong bg-surface px-3 " +
  "text-[13px] font-medium text-text transition-[background-color,border-color,color,box-shadow] duration-150 " +
  "motion-reduce:transition-none hover:border-text-subtle aria-pressed:border-action aria-pressed:bg-action-soft " +
  "aria-pressed:font-semibold aria-pressed:text-action-fg max-md:h-11";

/**
 * Holat segmenti maketdagidek ikki qatorda (`grid-template-columns: repeat(6, 1fr)`: 2 + 2 + 2 / 3 + 3) — besh
 * variant 358 px ga bir qatorda sig'maydi.
 */
const STATUS_GRID =
  "grid! grid-cols-6 [&>*:nth-child(-n+3)]:col-span-2 [&>*:nth-child(n+4)]:col-span-3";

export type AlertFiltersSheetProps = {
  open: boolean;
  onClose: () => void;
  /** Hozirgi (URL) qiymatlar — varaqa har ochilganda qoralama shundan boshlanadi. */
  initial: AlertFilterValues;
  /** Holat segmentidagi sonlar (`counts.by_status`). */
  counts?: StatusCounts;
  onApply: (values: AlertFilterValues) => void;
};

const Section = ({ labelId, label, aside, children }: { labelId: string; label: string; aside?: ReactNode; children: ReactNode }) => (
  <div role="group" aria-labelledby={labelId} className="flex min-w-0 flex-col gap-2">
    <div className="flex min-w-0 items-baseline justify-between gap-2">
      <span id={labelId} className={LABEL}>
        {label}
      </span>
      {aside}
    </div>
    {children}
  </div>
);

export const AlertFiltersSheet = ({ open, onClose, initial, counts, onApply }: AlertFiltersSheetProps) => {
  const { t, i18n } = useTranslation(["aiAdvisor", "ui"]);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const idBase = useId();
  const [draft, setDraft] = useState<AlertFilterValues>(initial);
  const [prevOpen, setPrevOpen] = useState(open);
  // Har ochilishda qoralama URL'dagi qiymatlardan boshlanadi (yopilganda kiritilgani bekor bo'lgan).
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) setDraft(initial);
  }

  // Son — yordamchi: xatoda yashirinadi (`meta.silentError` — umumiy xabar varaqa ustiga chiqmaydi).
  const preview = useAdvisorAlertCount(toAlertCountParams(draft), { enabled: open });
  const previewTotal = preview.isError || preview.data === undefined ? null : preview.data;

  const patch = (next: Partial<AlertFilterValues>) => setDraft((current) => ({ ...current, ...next }));

  const apply = () => {
    onApply(draft);
    onClose();
  };

  const ruleOptions = ruleSelectOptions(t);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("filters.sheetTitle", { ns: "ui" })}
      description={t("filters.sheetSelected", { ns: "ui", count: countActiveFilters(draft) })}
      closeLabel={t("filters.sheetClose", { ns: "ui" })}
      footerDivider
      footer={
        <>
          <Button variant="secondary" size="lg" className="max-md:flex-none!" onClick={() => setDraft(EMPTY_ALERT_FILTERS)}>
            {t("filters.reset", { ns: "ui" })}
          </Button>
          {/* Tor ekranda matn qisqaradi, son doim ko'rinadi (maket: `padding: 0 16px` — ixcham). */}
          <Button size="lg" compact className="min-w-0" onClick={apply}>
            <span className="flex min-w-0 items-center gap-1">
              <span className="min-w-0 truncate">{t("filters.apply", { ns: "ui" })}</span>
              {previewTotal === null ? null : (
                <span className="shrink-0">
                  {t("filters.applyTotal", { ns: "ui", total: formatNumberLocalized(previewTotal, { language }) })}
                </span>
              )}
            </span>
          </Button>
        </>
      }
    >
      <div className="flex min-w-0 flex-col gap-5">
        <Section labelId={`${idBase}-status`} label={t("alerts.filters.status")}>
          <SegmentedControl<AiAdvisorAlertStatus | typeof ALL>
            ariaLabel={t("alerts.filters.status")}
            fullWidth
            className={STATUS_GRID}
            options={statusSegmentOptions(t, counts, language)}
            value={draft.status || ALL}
            onValueChange={(value) => patch({ status: value === ALL ? "" : value })}
          />
        </Section>

        <Section labelId={`${idBase}-severity`} label={t("alerts.filters.severity")}>
          <SegmentedControl<AiAdvisorSeverity | typeof ALL>
            ariaLabel={t("alerts.filters.severity")}
            fullWidth
            options={severitySegmentOptions(t)}
            value={draft.severity || ALL}
            onValueChange={(value) => patch({ severity: value === ALL ? "" : value })}
          />
        </Section>

        <Section
          labelId={`${idBase}-rule`}
          label={t("alerts.filters.rule")}
          aside={
            <span className="shrink-0 text-xs text-text-muted">
              {t("alerts.filters.rulesCount", {
                count: AI_ADVISOR_RULE_KEYS.length,
                value: formatNumberLocalized(AI_ADVISOR_RULE_KEYS.length, { language }),
              })}
            </span>
          }
        >
          <div className="flex flex-wrap gap-2">
            {ruleOptions.map((option) => (
              <Pressable
                key={option.value || ALL}
                aria-pressed={draft.rule === option.value}
                onClick={() => patch({ rule: option.value })}
                className={CHIP}
              >
                {option.label}
              </Pressable>
            ))}
          </div>
        </Section>
      </div>
    </Dialog>
  );
};
