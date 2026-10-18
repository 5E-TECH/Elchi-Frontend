// dizayn-v2: superadmin-notifications-sms-report
import { memo, useMemo, useState, type ReactNode } from "react";
import {
  BarChart3,
  CircleCheck,
  CircleX,
  Clock,
  Info,
  KeyRound,
  Megaphone,
  MessageSquareText,
  Table2,
  type LucideIcon,
} from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SmsMessageClass, SmsTariffs } from "../../../../entities/sms";
import { cx } from "../../../../shared/lib/cx";
import { RELATIVE_DAY_LABEL } from "../../../../shared/lib/formatDateTime";
import {
  CURRENCY_LABEL,
  formatMoneyLocalized,
  formatNumberLocalized,
  formatPercentLocalized,
  resolveMoneyLanguage,
} from "../../../../shared/lib/formatMoney";
import {
  Badge,
  Card,
  DataTable,
  SegmentedControl,
  type DataTableColumn,
} from "../../../../shared/ui/primitives";
import {
  addDays,
  deliveryZone,
  REPORT_CLASSES,
  tashkentDay,
  type ClassSummary,
  type DailyPoint,
  type ReportTotals,
} from "../../lib/smsReport";
import { useDayLabel } from "../../lib/useDayLabel";
import { useIsPhoneViewport } from "../../lib/useIsPhoneViewport";

/** Sinf ikonkasi va grafik rangi (kategorial palitra tartibi o'zgarmaydi — DESIGN_SYSTEM §3). */
const CLASS_ICON: Record<SmsMessageClass, LucideIcon> = {
  transactional: MessageSquareText,
  promo: Megaphone,
  security: KeyRound,
};

const CLASS_FILL: Record<SmsMessageClass, string> = {
  transactional: "var(--color-chart-1)",
  promo: "var(--color-chart-2)",
  security: "var(--color-chart-3)",
};

const CLASS_BG: Record<SmsMessageClass, string> = {
  transactional: "bg-chart-1",
  promo: "bg-chart-2",
  security: "bg-chart-3",
};

const AXIS_TICK = { fill: "var(--color-text-subtle)", fontSize: 12 } as const;

/** «Yumaloq» qadam: 1 · 2 · 2,5 · 5 · 10 × 10ⁿ (maket o'qi: 0 · 1 000 · 2 000 · 3 000 · 4 000). */
const niceStep = (raw: number) => {
  if (!(raw > 0)) return 1;
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 2.5 ? 2.5 : unit <= 5 ? 5 : 10) * power;
};

/** Y o'qi: 0 dan yumaloq qadam bilan ~4 bo'lak. */
const buildTicks = (max: number) => {
  const step = niceStep(max / 4);
  const ticks: number[] = [];
  for (
    let value = 0;
    value <= Math.max(step, Math.ceil(max / step) * step) + step / 2;
    value += step
  )
    ticks.push(value);
  return ticks;
};

/** Qisqa o'q yorlig'i: «24.09», bugun — «Bugun», kecha — «Kecha». */
const useAxisDay = () => {
  const { i18n } = useTranslation();
  const language = resolveMoneyLanguage(i18n.resolvedLanguage ?? i18n.language);
  const today = tashkentDay();
  const yesterday = addDays(today, -1);
  return (day: string) => {
    if (day === today) return RELATIVE_DAY_LABEL[language].today;
    if (day === yesterday) return RELATIVE_DAY_LABEL[language].yesterday;
    const [, month, date] = day.split("-");
    return `${date}.${month}`;
  };
};

/* ─────────────────────────────── Sparkline ─────────────────────────────── */

/** `.el-spark`: ingichka chiziq (`chart-1`) + oxirgi nuqta. Faqat bezak — ma'nosi `aria-label` da. */
export const Sparkline = ({
  values,
  label,
  inline = false,
}: {
  values: readonly number[];
  label: string;
  inline?: boolean;
}) => {
  const max = Math.max(...values, 0);
  const points = values.length > 1 ? values : [values[0] ?? 0, values[0] ?? 0];
  const y = (value: number) => (max > 0 ? 30 - (value / max) * 28 : 30);
  const path = points
    .map(
      (value, index) =>
        `${index === 0 ? "M" : "L"}${((index / (points.length - 1)) * 100).toFixed(2)} ${y(value).toFixed(2)}`,
    )
    .join(" ");
  const last = points[points.length - 1];
  return (
    <span
      role="img"
      aria-label={label}
      className={cx("relative block", inline ? "h-6 w-[72px]" : "h-8 w-full")}
    >
      <svg
        viewBox="0 0 100 32"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="size-full overflow-visible"
      >
        <path
          d={path}
          fill="none"
          stroke="var(--color-chart-1)"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span
        aria-hidden="true"
        className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-chart-1"
        style={{ left: "100%", top: `${(y(last) / 32) * 100}%` }}
      />
    </span>
  );
};

/* ─────────────────────────────── Gauge ─────────────────────────────── */

const GAUGE_TRACK = {
  success: "stroke-success-soft",
  warning: "stroke-warning-soft",
  danger: "stroke-danger-soft",
} as const;
const GAUGE_ARC = {
  success: "stroke-success",
  warning: "stroke-warning",
  danger: "stroke-danger",
} as const;
const CX = 156;
const CY = 150;
const R = 120;
const STROKE = 22;

const gaugePoint = (percent: number, radius = R) => {
  const angle = Math.PI * (1 - Math.max(0, Math.min(percent, 100)) / 100);
  return { x: CX + radius * Math.cos(angle), y: CY - radius * Math.sin(angle) };
};

const gaugeArc = (from: number, to: number) => {
  const start = gaugePoint(from);
  const end = gaugePoint(to);
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${R} ${R} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
};

/** «Yetkazilish» — yarim doira (`.el-gauge`, `tizim-charts`): ≥ 70 yashil, 40–70 sariq, < 40 qizil. */
export const DeliveryCard = ({
  totals,
  rangeText,
}: {
  totals: ReportTotals;
  rangeText: string;
}) => {
  const { t, i18n } = useTranslation("sms");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const rate = totals.deliveryRate ?? 0;
  const zone = deliveryZone(rate);
  const needle = gaugePoint(rate, R - STROKE - 10);
  const num = (value: number) => formatNumberLocalized(value, { language });
  const rateText = totals.deliveryRate === null ? "—" : formatPercentLocalized(rate, { language });
  const zoneText = t(
    zone === "success"
      ? "report.zoneGood"
      : zone === "warning"
        ? "report.zoneMid"
        : "report.zoneLow",
  );

  return (
    <Card
      divided={false}
      title={t("report.deliveryTitle")}
      description={t("report.deliverySub", { range: rangeText })}
      className="flex-[1_1_340px]"
    >
      <figure
        role="img"
        aria-label={t("report.deliveryAria", {
          rate: rateText,
          total: num(totals.total),
          delivered: num(totals.delivered),
          failed: num(totals.failed),
          pending: num(totals.pending),
        })}
        className="m-0 flex min-w-0 flex-col items-center gap-3"
      >
        <div aria-hidden="true" className="relative h-[176px] w-[312px] max-w-full flex-none">
          <svg viewBox="0 0 312 176" className="size-full overflow-visible">
            <path
              d={gaugeArc(0, 100)}
              fill="none"
              strokeWidth={STROKE}
              strokeLinecap="round"
              className={GAUGE_TRACK[zone]}
            />
            {rate > 0 ? (
              <path
                d={gaugeArc(0, rate)}
                fill="none"
                strokeWidth={STROKE}
                strokeLinecap="round"
                className={GAUGE_ARC[zone]}
              />
            ) : null}
            <line
              x1={CX}
              y1={CY}
              x2={needle.x}
              y2={needle.y}
              strokeWidth={4}
              strokeLinecap="round"
              className="stroke-text"
            />
            <circle cx={CX} cy={CY} r={9} strokeWidth={2} className="fill-text stroke-surface" />
          </svg>
          {[0, 25, 50, 75, 100].map((tick) => {
            const at = gaugePoint(tick, R + STROKE / 2 + 16);
            return (
              <span
                key={tick}
                className="absolute -translate-x-1/2 -translate-y-1/2 text-xs font-semibold text-text-subtle tabular-nums"
                style={{ left: at.x, top: at.y }}
              >
                {tick}
              </span>
            );
          })}
        </div>
        <figcaption className="flex flex-col items-center gap-1.5 text-center">
          <span className="text-[40px] leading-[44px] font-bold tracking-[-.02em] text-text proportional-nums max-md:text-4xl">
            {rateText}
          </span>
          <span className="text-[13px] text-text-muted">{t("report.deliveryLabel")}</span>
          {totals.deliveryRate !== null ? (
            <Badge
              tone={zone}
              icon={zone === "success" ? CircleCheck : zone === "warning" ? Clock : CircleX}
            >
              {zoneText}
            </Badge>
          ) : null}
        </figcaption>
      </figure>
      <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
        {(
          [
            ["success", CircleCheck, totals.delivered, t("report.delivered")],
            ["danger", CircleX, totals.failed, t("report.failed")],
          ] as const
        ).map(([tone, Icon, value, label]) => (
          <div key={label} className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className={cx(
                "inline-flex size-9 shrink-0 items-center justify-center rounded-full",
                tone === "success"
                  ? "bg-success-soft text-success-fg"
                  : "bg-danger-soft text-danger-fg",
              )}
            >
              <Icon size={18} />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="font-bold text-text tabular-nums">
                {t("count", { value: num(value) })}
              </span>
              <span className="text-xs text-text-muted">{label}</span>
            </span>
          </div>
        ))}
      </div>
      {totals.pending > 0 ? (
        <p className="m-0 flex items-start gap-2 text-xs text-text-muted">
          <Info aria-hidden="true" size={16} className="mt-px shrink-0" />
          <span className="min-w-0">{t("report.pendingNote", { value: num(totals.pending) })}</span>
        </p>
      ) : null}
    </Card>
  );
};

/* ─────────────────────────────── Kunlik grafik ─────────────────────────────── */

type DailyTooltipProps = {
  active?: boolean;
  payload?: Array<{ payload?: DailyPoint }>;
};

const DailyLegend = () => {
  const { t } = useTranslation("sms");
  return (
    <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 border-t border-border p-0 pt-3 text-xs text-text-muted">
      {REPORT_CLASSES.map((messageClass) => (
        <li key={messageClass} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={cx("size-2.5 rounded-[3px]", CLASS_BG[messageClass])}
          />
          {t(`class.${messageClass}`)}
        </li>
      ))}
    </ul>
  );
};

export const DailyCard = memo(
  ({ points, rangeText }: { points: readonly DailyPoint[]; rangeText: string }) => {
    const { t, i18n } = useTranslation("sms");
    const language = i18n.resolvedLanguage ?? i18n.language;
    const isPhone = useIsPhoneViewport();
    const [view, setView] = useState<"chart" | "table">("chart");
    const dayLabel = useDayLabel();
    const axisDay = useAxisDay();
    const num = (value: number) => formatNumberLocalized(value, { language });
    const shown = isPhone ? points.slice(-7) : points;
    const max = Math.max(0, ...points.map((point) => point.total));
    const yTicks = buildTicks(Math.max(...shown.map((point) => point.total), 1));
    const tableRows = useMemo(() => [...points].reverse(), [points]);

    const columns = useMemo<DataTableColumn<DailyPoint>[]>(
      () => [
        {
          id: "day",
          header: t("report.col.day"),
          cellClassName: "whitespace-nowrap",
          cell: (row) => dayLabel(row.day),
        },
        ...REPORT_CLASSES.map<DataTableColumn<DailyPoint>>((messageClass) => ({
          id: messageClass,
          header: t(`class.${messageClass}`),
          align: "end",
          cell: (row) => num(row[messageClass]),
        })),
        {
          id: "total",
          header: t("report.col.total"),
          align: "end",
          cell: (row) => <span className="font-semibold">{num(row.total)}</span>,
        },
      ],
      // eslint-disable-next-line react-hooks/exhaustive-deps -- formatlovchilar faqat tilga bog'liq
      [language, t],
    );

    const DailyTooltip = ({ active, payload }: DailyTooltipProps) => {
      const point = payload?.[0]?.payload;
      if (!active || !point) return null;
      return (
        <div className="flex min-w-[200px] flex-col gap-1.5 rounded-xl border border-border bg-raised px-3 py-2.5 shadow-xl">
          <span className="text-xs font-semibold whitespace-nowrap text-text-muted">
            {dayLabel(point.day)}
          </span>
          {REPORT_CLASSES.map((messageClass) => (
            <div
              key={messageClass}
              className="flex items-center gap-2 text-[13px] whitespace-nowrap"
            >
              <span
                aria-hidden="true"
                className={cx("size-2.5 rounded-[3px]", CLASS_BG[messageClass])}
              />
              <span className="font-bold text-text">
                {t("count", { value: num(point[messageClass]) })}
              </span>
              <span className="text-text-muted">{t(`class.${messageClass}`)}</span>
            </div>
          ))}
          <div className="h-px bg-border" />
          <span className="text-[13px] whitespace-nowrap text-text-muted">
            <Trans
              t={t}
              i18nKey="report.tooltipTotal"
              values={{
                value: num(point.total),
                cost: formatMoneyLocalized(point.cost, { language }),
              }}
              components={{ b: <span className="font-bold text-text" /> }}
            />
          </span>
        </div>
      );
    };

    const viewToggle = (
      <SegmentedControl
        ariaLabel={t("report.viewLabel")}
        value={view}
        onValueChange={setView}
        size={isPhone ? "md" : "sm"}
        fullWidth="phone"
        options={[
          { value: "chart", label: t("report.viewChart"), icon: BarChart3 },
          { value: "table", label: t("report.viewTable"), icon: Table2 },
        ]}
      />
    );

    // Ustun ustidagi jami (telefon): oddiy `<text>` — recharts `Text` bo'shliqda (minglik ajratkich) qatorga bo'lib yubormasin.
    const renderTotalLabel = (props: {
      x?: number | string;
      y?: number | string;
      width?: number | string;
      value?: unknown;
    }) => {
      const x = Number(props.x) + Number(props.width) / 2;
      const y = Number(props.y) - 6;
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      return (
        <text
          x={x}
          y={y}
          textAnchor="middle"
          fill="var(--color-text)"
          fontSize={12}
          fontWeight={600}
        >
          {num(Number(props.value))}
        </text>
      );
    };

    // O'q yorlig'i: 30 kunda har 7-kun (oxirgisi doim), telefonda (7 kun) hammasi.
    const tickEvery = shown.length > 10 ? 7 : 1;
    const ticks = shown
      .filter((_, index) => (shown.length - 1 - index) % tickEvery === 0)
      .map((point) => point.day);

    return (
      <Card
        divided={false}
        title={t("report.dailyTitle")}
        description={t("report.dailySub", { days: num(points.length) })}
        className="flex-[2_1_560px]"
        // Telefonda (maket) «Grafik | Jadval» sarlavha ostida to'liq enli, kompyuterda — sarlavha o'ngida.
        actions={isPhone ? undefined : viewToggle}
      >
        {isPhone ? viewToggle : null}
        {view === "table" ? (
          <div className="min-w-0 overflow-hidden rounded-xl border border-border md:max-h-[340px] md:overflow-y-auto">
            <DataTable
              rows={tableRows}
              columns={columns}
              density="compact"
              getRowKey={(row) => row.day}
              label={t("report.dailyTitle")}
              renderCard={(row) => (
                <div className="flex flex-col gap-1 px-4 py-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="font-semibold text-text">{dayLabel(row.day)}</span>
                    <span className="font-semibold whitespace-nowrap text-text">
                      {t("count", { value: num(row.total) })}
                    </span>
                  </div>
                  <span className="flex flex-wrap gap-x-3 text-xs text-text-muted">
                    {REPORT_CLASSES.map((messageClass) => (
                      <span key={messageClass}>
                        {t(`class.${messageClass}`)} {num(row[messageClass])}
                      </span>
                    ))}
                  </span>
                </div>
              )}
            />
          </div>
        ) : (
          <div className="flex min-w-0 flex-col gap-2">
            {isPhone ? (
              <span className="text-xs text-text-muted">{t("report.lastDays")}</span>
            ) : null}
            <div
              role="img"
              aria-label={t("report.dailyAria", { range: rangeText, max: num(max) })}
              className="h-[320px] min-w-0 max-md:h-[200px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={shown}
                  margin={{ top: isPhone ? 20 : 8, right: isPhone ? 4 : 20, bottom: 0, left: 0 }}
                  barCategoryGap={isPhone ? "22%" : "18%"}
                >
                  <CartesianGrid vertical={false} stroke="var(--color-border)" />
                  <XAxis
                    dataKey="day"
                    ticks={ticks}
                    interval={0}
                    tickFormatter={axisDay}
                    tick={AXIS_TICK}
                    tickLine={false}
                    axisLine={{ stroke: "var(--color-border)" }}
                  />
                  {isPhone ? null : (
                    <YAxis
                      tick={AXIS_TICK}
                      tickLine={false}
                      axisLine={false}
                      width={48}
                      allowDecimals={false}
                      ticks={yTicks}
                      domain={[0, yTicks[yTicks.length - 1]]}
                      tickFormatter={(value: number) => num(value)}
                    />
                  )}
                  {isPhone ? null : (
                    <Tooltip
                      cursor={{ fill: "var(--color-row-hover)" }}
                      content={<DailyTooltip />}
                    />
                  )}
                  {REPORT_CLASSES.map((messageClass, index) => (
                    <Bar
                      key={messageClass}
                      dataKey={messageClass}
                      stackId="sms"
                      fill={CLASS_FILL[messageClass]}
                      maxBarSize={24}
                      isAnimationActive={false}
                    >
                      {isPhone && index === REPORT_CLASSES.length - 1 ? (
                        <LabelList dataKey="total" content={renderTotalLabel} />
                      ) : null}
                    </Bar>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <DailyLegend />
          </div>
        )}
      </Card>
    );
  },
);
DailyCard.displayName = "DailyCard";

/* ─────────────────────────────── Xarajat va holat ─────────────────────────────── */

const ClassName = ({
  messageClass,
  extra,
}: {
  messageClass: SmsMessageClass;
  extra?: ReactNode;
}) => {
  const { t } = useTranslation("sms");
  const Icon = CLASS_ICON[messageClass];
  return (
    <span className="inline-flex min-w-0 items-center gap-2 font-semibold text-text">
      <Icon aria-hidden="true" size={16} className="shrink-0 text-text-subtle" />
      <span className="min-w-0">{t(`class.${messageClass}`)}</span>
      {extra}
    </span>
  );
};

export const CostCard = ({
  classes,
  totalCost,
  tariffs,
}: {
  classes: readonly ClassSummary[];
  totalCost: number;
  tariffs: SmsTariffs | undefined;
}) => {
  const { t, i18n } = useTranslation("sms");
  const language = resolveMoneyLanguage(i18n.resolvedLanguage ?? i18n.language);
  const num = (value: number) => formatNumberLocalized(value, { language });
  const money = (value: number) => formatMoneyLocalized(value, { language });

  return (
    <Card
      divided={false}
      title={t("report.costTitle")}
      description={t("report.costCardSub")}
      className="flex-[1_1_340px]"
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-text-muted">{t("report.costTotal")}</span>
        <span className="text-[28px] leading-9 font-bold tracking-[-.01em] whitespace-nowrap text-text max-md:text-[22px] max-md:leading-[30px]">
          {formatMoneyLocalized(totalCost, { language, withCurrency: false })}
          <span className="sr-only"> </span>
          <span className="ml-1 text-sm font-semibold tracking-normal text-text-muted">
            {CURRENCY_LABEL[language]}
          </span>
        </span>
      </div>
      <ul className="m-0 flex list-none flex-col p-0">
        {classes.map((item) => {
          const tariff = tariffs?.[item.messageClass] ?? null;
          const className = t(`class.${item.messageClass}`);
          return (
            <li key={item.messageClass} className="flex flex-col gap-2 border-t border-border py-3">
              <div className="flex items-center justify-between gap-3">
                <ClassName messageClass={item.messageClass} />
                {item.notCounted ? (
                  <span className="whitespace-nowrap text-text-muted">
                    —<span className="sr-only"> {t("report.untariffedTitle")}</span>
                  </span>
                ) : (
                  <span className="font-semibold whitespace-nowrap text-text tabular-nums">
                    {money(item.cost)}
                  </span>
                )}
              </div>
              <div
                role="meter"
                aria-label={
                  item.notCounted
                    ? t("report.notCountedAria", { class: className })
                    : t("report.shareAria", {
                        class: className,
                        share: formatPercentLocalized(item.costShare, { language }),
                      })
                }
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Number(item.costShare.toFixed(1))}
                className="h-2 overflow-hidden rounded-full bg-sunken"
              >
                {item.costShare > 0 ? (
                  <span
                    className={cx("block h-full rounded-full", CLASS_BG[item.messageClass])}
                    style={{ width: `${item.costShare}%` }}
                  />
                ) : null}
              </div>
              <div className="flex justify-between gap-3 text-xs text-text-muted">
                <span className="min-w-0">
                  {item.notCounted
                    ? t("report.untariffedClass", { parts: num(item.parts) })
                    : tariff !== null
                      ? t("report.partsTimesTariff", {
                          parts: num(item.parts),
                          tariff: money(tariff),
                        })
                      : t("report.partsOnly", { parts: num(item.parts) })}
                </span>
                {item.notCounted ? (
                  <Link
                    to="/notifications/sms?tab=settings"
                    className="font-semibold whitespace-nowrap text-action-fg underline-offset-2 hover:text-action-hover hover:underline max-md:-my-3.5 max-md:inline-flex max-md:min-h-11 max-md:items-center"
                  >
                    {t("report.tariffLink")}
                  </Link>
                ) : (
                  <span className="whitespace-nowrap tabular-nums">
                    {formatPercentLocalized(item.costShare, { language })}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
};

const STATUS_PARTS = [
  ["delivered", "bg-success"],
  ["pending", "bg-warning"],
  ["failed", "bg-danger"],
] as const;

export const StatusCard = ({ classes }: { classes: readonly ClassSummary[] }) => {
  const { t, i18n } = useTranslation("sms");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const num = (value: number) => formatNumberLocalized(value, { language });

  return (
    <Card
      divided={false}
      title={t("report.statusTitle")}
      description={t("report.statusSub")}
      className="flex-[2_1_560px]"
    >
      <ul className="m-0 flex list-none flex-col p-0">
        {classes.map((item) => (
          <li key={item.messageClass} className="flex flex-col gap-2 border-t border-border py-3.5">
            <div className="flex items-center justify-between gap-3">
              <ClassName
                messageClass={item.messageClass}
                extra={
                  <span className="text-xs font-normal text-text-muted">
                    {t("count", { value: num(item.total) })}
                  </span>
                }
              />
              <span className="font-semibold whitespace-nowrap text-text">
                {item.deliveryRate === null
                  ? "—"
                  : formatPercentLocalized(item.deliveryRate, { language })}
              </span>
            </div>
            <div
              role="img"
              aria-label={t("report.statusAria", {
                class: t(`class.${item.messageClass}`),
                delivered: num(item.delivered),
                pending: num(item.pending),
                failed: num(item.failed),
              })}
              className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-sunken"
            >
              {STATUS_PARTS.map(([key, bg]) =>
                item[key] > 0 ? (
                  <span
                    key={key}
                    className={cx("h-full", bg)}
                    style={{ flex: `${item[key]} 1 0` }}
                  />
                ) : null,
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
              <span>{t("report.statusDelivered", { value: num(item.delivered) })}</span>
              <span>{t("report.statusPending", { value: num(item.pending) })}</span>
              <span>{t("report.statusFailed", { value: num(item.failed) })}</span>
            </div>
          </li>
        ))}
      </ul>
      <ul className="m-0 mt-auto flex list-none flex-wrap gap-x-4 gap-y-1 border-t border-border p-0 pt-3 text-xs text-text-muted">
        {(
          [
            ["bg-success", CircleCheck, t("report.delivered")],
            ["bg-warning", Clock, t("report.pending")],
            ["bg-danger", CircleX, t("report.failed")],
          ] as const
        ).map(([bg, Icon, label]) => (
          <li key={label} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className={cx("size-2.5 rounded-[3px]", bg)} />
            <Icon aria-hidden="true" size={14} className="shrink-0" />
            {label}
          </li>
        ))}
      </ul>
    </Card>
  );
};
