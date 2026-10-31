// dizayn-v2: superadmin-balance-analysis, admin-balance-analysis, tizim-charts
import { memo, useMemo, useState } from "react";
import { ChartColumn, Info, List } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import {
  formatCompactMoneyLocalized,
  formatMoneyLocalized,
  formatNumberLocalized,
  formatSignedMoneyLocalized,
} from "../../../shared/lib/formatMoney";
import { Card, DataTable, EmptyState, SegmentedControl, TONE_FG, type DataTableColumn } from "../../../shared/ui/primitives";
import { buildWaterfall, toPlotPercent, type AnalyticsSummary, type SourceBucket, type WaterfallStep } from "../lib/analytics";
import { toSourceTypeLabel } from "../lib/historyRow";

/** Ustun rangi: o'sish/kamayish uchun `--div-*` tokeni ilovada yo'q (CODE-MAP 0.1) — `chart-1` / `chart-8`, jami — `text-muted`. */
const BAR_CLASS: Record<WaterfallStep["kind"], string> = {
  start: "bg-text-muted",
  end: "bg-text-muted",
  up: "bg-chart-1",
  down: "bg-chart-8",
};

interface LedgerFlowProps {
  currentBalance: number | null;
  summary: AnalyticsSummary;
  positive: SourceBucket[];
  negative: SourceBucket[];
  /** Davr bugungacha (yoki «Barchasi») — davr boshi/oxiri hisoblanadi. */
  reachesToday: boolean;
  /** Serverdagi davr boshi/oxiri qoldig'i (`financial-balance/daily`) — o'tgan davrda ham sharshara boshi bor. */
  periodBalances?: { opening: number | null; closing: number | null } | null;
  /** Sarlavha ostidagi davr matni («01.10 – 08.10.2026» yoki «barcha vaqt»). */
  periodText: string;
  /** Fonda yangilanmoqda — grafik xiralashadi (`tizim-loading`). */
  dimmed?: boolean;
}

type View = "chart" | "table";

/**
 * «Daftar qoldig'i harakati» (maket `superadmin-balance-analysis`, `tizim-charts` sharshara):
 * 4 son (daftar qoldig'i, musbat/manfiy ta'sir, sof o'zgarish), sharshara — davr boshi → har kirim manbasi
 * (+) → har chiqim manbasi (−) → hozir; telefonda ro'yxat varianti; «Grafik | Jadval» egizagi.
 */
const LedgerFlow = ({
  currentBalance,
  summary,
  positive,
  negative,
  reachesToday,
  periodBalances = null,
  periodText,
  dimmed,
}: LedgerFlowProps) => {
  const { t, i18n } = useTranslation("payments");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const [view, setView] = useState<View>("chart");

  const money = (value: number) => formatMoneyLocalized(value, { language });
  const signed = (value: number) => formatSignedMoneyLocalized(value, { language });
  const compact = (value: number) => formatCompactMoneyLocalized(value, { language, withCurrency: false });
  const compactSigned = (value: number) => (value > 0 ? `+${compact(value)}` : compact(value));

  const waterfall = useMemo(
    () => buildWaterfall({ currentBalance, netChange: summary.netTotal, positive, negative, reachesToday, periodBalances }),
    [currentBalance, negative, periodBalances, positive, reachesToday, summary.netTotal],
  );

  const stepName = (step: WaterfallStep) =>
    step.kind === "start"
      ? t("v2Balance.analysis.flow.start")
      : step.kind === "end"
        ? t("v2Balance.analysis.flow.end")
        : toSourceTypeLabel(step.sourceType ?? "", t);
  const stepValue = (step: WaterfallStep) =>
    step.kind === "start" || step.kind === "end" ? compact(step.amount) : compactSigned(step.amount);
  const stepTone = (step: WaterfallStep) =>
    step.kind === "up" ? TONE_FG.success : step.kind === "down" ? TONE_FG.danger : "text-text";

  const ariaLabel = t("v2Balance.analysis.flow.aria", {
    period: periodText,
    steps: waterfall.steps
      .map((step) => `${stepName(step)} ${step.kind === "up" || step.kind === "down" ? signed(step.amount) : money(step.amount)}`)
      .join("; "),
  });

  const facts = [
    {
      key: "current",
      label: t("v2Balance.analysis.flow.current"),
      value: currentBalance === null ? "—" : money(currentBalance),
      hint: t("v2Balance.analysis.flow.currentHint"),
      tone: "text-text",
    },
    {
      key: "positive",
      label: t("v2Balance.analysis.flow.positive"),
      value: signed(summary.positiveTotal),
      hint: t("v2Balance.analysis.flow.positiveHint"),
      tone: summary.positiveTotal > 0 ? TONE_FG.success : "text-text",
    },
    {
      key: "negative",
      label: t("v2Balance.analysis.flow.negative"),
      value: signed(-summary.negativeTotal),
      hint: t("v2Balance.analysis.flow.negativeHint"),
      tone: summary.negativeTotal > 0 ? TONE_FG.danger : "text-text",
    },
    {
      key: "net",
      label: t("v2Balance.analysis.flow.net"),
      value: signed(summary.netTotal),
      hint: t("v2Balance.analysis.flow.netHint", { value: formatNumberLocalized(summary.totalCount, { language }) }),
      tone: "text-text",
    },
  ];

  const { steps, min, max } = waterfall;
  const y = (value: number) => toPlotPercent(value, min, max);
  const ups = steps.filter((step) => step.kind === "up");
  const downs = steps.filter((step) => step.kind === "down");
  const firstUp = steps.findIndex((step) => step.kind === "up");
  const firstDown = steps.findIndex((step) => step.kind === "down");

  // Jadval egizagi: bosqich, o'zgarish, keyingi qoldiq (davr boshi/oxiri chizilmasa — noldan yig'ilgan).
  const tableColumns: DataTableColumn<WaterfallStep>[] = [
    { id: "step", header: t("v2Balance.analysis.flow.step"), cell: (step) => <span className="font-semibold">{stepName(step)}</span> },
    {
      id: "change",
      header: t("v2Balance.analysis.flow.change"),
      align: "end",
      cell: (step) =>
        step.kind === "up" || step.kind === "down" ? (
          <span className={cx("font-semibold", stepTone(step))}>{signed(step.amount)}</span>
        ) : (
          <span className="text-text-subtle">—</span>
        ),
    },
    {
      id: "balance",
      header: t("v2Balance.analysis.flow.balance"),
      align: "end",
      cell: (step) => <span className="font-semibold text-text">{money(step.to)}</span>,
    },
  ];

  const hasSteps = steps.length > 0;
  const viewToggle = (
    <SegmentedControl<View>
      ariaLabel={t("v2Balance.analysis.flow.view")}
      value={view}
      onValueChange={setView}
      options={[
        { value: "chart", label: t("v2Balance.analysis.flow.chart"), icon: ChartColumn },
        { value: "table", label: t("v2Balance.analysis.flow.table"), icon: List },
      ]}
    />
  );

  return (
    <Card
      divided={false}
      title={t("v2Balance.analysis.flow.title")}
      description={t("v2Balance.analysis.flow.subtitle", { period: periodText })}
      actions={hasSteps ? <div className="max-md:hidden">{viewToggle}</div> : null}
    >
      <div className={cx("flex flex-col gap-4 transition-opacity motion-reduce:transition-none", dimmed && "opacity-45")}>
        {/* Telefonda «Grafik | Jadval» sarlavha ostida to'liq enda (`.el-chart-controls` max-md:w-full). */}
        {hasSteps ? <div className="md:hidden">{viewToggle}</div> : null}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(160px,100%),1fr))] gap-x-4 gap-y-3 max-md:hidden">
          {facts.map((fact) => (
            <div key={fact.key} className="flex min-w-0 flex-col gap-0.5">
              <span className="text-xs text-text-muted">{fact.label}</span>
              <span className={cx("whitespace-nowrap text-base font-bold", fact.tone)}>{fact.value}</span>
              <span className="text-xs text-text-muted">{fact.hint}</span>
            </div>
          ))}
        </div>
        <dl className="m-0 flex flex-col md:hidden">
          {facts.map((fact) => (
            <div key={fact.key} className="flex items-center justify-between gap-2 border-t border-border py-2 first:border-t-0">
              <dt className="text-[13px] text-text-muted">{fact.label}</dt>
              <dd className={cx("m-0 whitespace-nowrap text-sm font-semibold", fact.tone)}>{fact.value}</dd>
            </div>
          ))}
        </dl>

        {!hasSteps ? (
          <EmptyState
            size="chart"
            title={t("v2Balance.analysis.flow.empty")}
            description={t("v2Balance.analysis.flow.emptyDescription")}
          />
        ) : view === "table" ? (
          <DataTable
            rows={steps}
            columns={tableColumns}
            getRowKey={(step) => step.key}
            density="compact"
            label={t("v2Balance.analysis.flow.title")}
            renderCard={(step) => (
              <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="min-w-0 font-semibold text-text">{stepName(step)}</span>
                <span className="flex flex-col items-end">
                  {step.kind === "up" || step.kind === "down" ? (
                    <span className={cx("whitespace-nowrap font-semibold", stepTone(step))}>{signed(step.amount)}</span>
                  ) : null}
                  <span className="whitespace-nowrap text-[13px] text-text-muted">{money(step.to)}</span>
                </span>
              </div>
            )}
          />
        ) : (
          <>
            {/* Desktop/planshet: sharshara (`.el-waterfall`). */}
            <figure className="m-0 flex min-w-0 flex-col gap-2 pt-6 max-md:hidden">
              <div role="img" aria-label={ariaLabel} className="relative grid h-60 min-w-0 auto-cols-fr grid-flow-col">
                <span aria-hidden="true" className="absolute inset-x-0 border-t border-border" style={{ bottom: `${y(0)}%` }} />
                {steps.map((step, index) => {
                  const low = Math.min(step.from, step.to);
                  const high = Math.max(step.from, step.to);
                  const next = steps[index + 1];
                  return (
                    <div key={step.key} className="relative h-full min-w-0">
                      <span
                        aria-hidden="true"
                        className={cx("absolute left-1/2 -ml-3 w-6 min-h-[3px] rounded-[4px]", BAR_CLASS[step.kind])}
                        style={{ bottom: `${y(low)}%`, height: `${y(high) - y(low)}%` }}
                      />
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-0 -translate-y-full whitespace-nowrap pb-1 text-center text-xs font-bold text-text"
                        style={{ top: `${100 - y(high)}%` }}
                      >
                        {stepValue(step)}
                      </span>
                      {next ? (
                        <span
                          aria-hidden="true"
                          className="absolute left-[calc(50%+12px)] h-0 w-[calc(100%-24px)] border-t border-border"
                          style={{ bottom: `${y(step.to)}%` }}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <div aria-hidden="true" className="grid min-w-0 auto-cols-fr grid-flow-col gap-1">
                {steps.map((step) => (
                  <span key={step.key} className="text-center text-xs leading-4 text-text-muted">
                    {stepName(step)}
                  </span>
                ))}
              </div>
              {ups.length > 0 || downs.length > 0 ? (
                <div
                  aria-hidden="true"
                  className="grid min-w-0 gap-1"
                  style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
                >
                  {ups.length > 0 ? (
                    <div
                      className="flex flex-col items-center gap-1.5 px-3"
                      style={{ gridColumn: `${firstUp + 1} / span ${ups.length}` }}
                    >
                      <span className="h-2 self-stretch rounded-b-md border border-t-0 border-border" />
                      <span className="whitespace-nowrap text-xs font-semibold text-text">
                        {t("v2Balance.analysis.flow.income", { value: compactSigned(summary.positiveTotal) })}
                      </span>
                    </div>
                  ) : null}
                  {downs.length > 0 ? (
                    <div
                      className="flex flex-col items-center gap-1.5 px-3"
                      style={{ gridColumn: `${firstDown + 1} / span ${downs.length}` }}
                    >
                      <span className="h-2 self-stretch rounded-b-md border border-t-0 border-border" />
                      <span className="whitespace-nowrap text-xs font-semibold text-text">
                        {t("v2Balance.analysis.flow.expense", { value: compactSigned(-summary.negativeTotal) })}
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </figure>

            {/* Telefon: ro'yxat varianti — har bosqich o'z oralig'ida chiziq. */}
            <ol role="img" aria-label={ariaLabel} className="m-0 flex list-none flex-col gap-2.5 p-0 md:hidden">
              {steps.map((step, index) => {
                const low = Math.min(step.from, step.to);
                const high = Math.max(step.from, step.to);
                const groupStart = index > 0 && steps[index - 1].kind !== step.kind;
                return (
                  <li
                    key={step.key}
                    className={cx("flex flex-col gap-1.5", groupStart && "border-t border-border pt-2.5")}
                  >
                    <div className="flex justify-between gap-3">
                      <span className="text-[13px] text-text">{stepName(step)}</span>
                      <span className={cx("whitespace-nowrap text-[13px] font-semibold", stepTone(step))}>
                        {step.kind === "up" || step.kind === "down" ? signed(step.amount) : money(step.amount)}
                      </span>
                    </div>
                    <div className="flex h-2.5 min-w-0">
                      <span
                        className={cx("block min-w-1 rounded-[4px]", BAR_CLASS[step.kind])}
                        style={{ marginLeft: `${y(low)}%`, width: `${y(high) - y(low)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </div>

      {hasSteps ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-4">
          <ul className="m-0 flex list-none flex-wrap items-center gap-x-5 gap-y-2 p-0 text-[13px] text-text-muted">
            {waterfall.withTotals ? (
              <li className="inline-flex items-center gap-2 whitespace-nowrap">
                <span aria-hidden="true" className="size-2.5 rounded-[3px] bg-text-muted" />
                {t("v2Balance.analysis.flow.legendTotal")}
              </li>
            ) : null}
            <li className="inline-flex items-center gap-2 whitespace-nowrap">
              <span aria-hidden="true" className="size-2.5 rounded-[3px] bg-chart-1" />
              {t("v2Balance.analysis.flow.legendUp")}
            </li>
            <li className="inline-flex items-center gap-2 whitespace-nowrap">
              <span aria-hidden="true" className="size-2.5 rounded-[3px] bg-chart-8" />
              {t("v2Balance.analysis.flow.legendDown")}
            </li>
          </ul>
          <span className="flex-1" />
          {currentBalance !== null ? (
            <p className="m-0 flex items-start gap-2 text-xs leading-[18px] text-text-subtle">
              <Info aria-hidden="true" size={16} className="shrink-0" />
              <span>
                {waterfall.withTotals ? t("v2Balance.analysis.flow.note") : t("v2Balance.analysis.flow.pastNote")}
              </span>
            </p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
};

export default memo(LedgerFlow);
