// dizayn-v2: superadmin-payments-main-cashbox, admin-payments-main-cashbox, manager-payments-main-cashbox
import { memo, useMemo, type ReactElement, type ReactNode } from "react";
import { ChartLine } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDateLocalized } from "../../../shared/lib/formatDateTime";
import {
  formatCompactMoneyLocalized,
  formatMoneyLocalized,
  formatSignedMoneyLocalized,
} from "../../../shared/lib/formatMoney";
import {
  DataTable,
  EmptyState,
  ErrorState,
  SkeletonChart,
  type DataTableColumn,
} from "../../../shared/ui/primitives";
import { buildTicks } from "./lib/chartScale";
import { parseIsoDate, toIsoDate, type DailyBalancePoint } from "./lib/mainCashboxStats";

/**
 * «KASSA BALANSI» GRAFIGI — kun oxiridagi qoldiq (maket `superadmin-payments-main-cashbox`, `.el-plot is-direct`;
 * `tizim-charts`: «Grafik | Jadval» egizagi).
 *
 * Chiziq + maydon (`chart-1`, maydon 10%), gorizontal to'r, Y o'qi ixcham («20 mln»), X o'qi «KK.OO», oxirgi
 * nuqta «Bugun»; oxirgi qiymat yorlig'i va katta nuqta. Maslahat (kompyuterda): sana, kun oxiridagi qoldiq,
 * kirim / chiqim. Jadval ko'rinishi: Sana · Kun oxirida · Kirim · Chiqim (yangisi tepada).
 * Holatlar: yuklanish — skelet, xato — «Qayta urinish», < 2 nuqta — «Grafik uchun ma'lumot yetarli emas».
 * Balans yashirilgan bo'lsa (`hidden`) — summalar ko'rsatilmaydi (o'q yorliqlari, maslahat, jadval «••••••»).
 *
 * Ranglar CSS tokenlaridan (`var(--color-*)`) — kunduzgi va tungi mavzuda bir xil kod.
 */

export type BalanceChartView = "chart" | "table";

type Props = {
  points: readonly DailyBalancePoint[];
  view: BalanceChartView;
  hidden?: boolean;
  isLoading?: boolean;
  isError?: boolean;
  error?: unknown;
  onRetry?: () => void;
  /** Grafik mazmuni (ekran o'quvchi) — boshqa kassa/daftar uchun; sukut «Asosiy kassa balansi…». */
  chartLabelKey?: string;
  /** Jadval nomi; sukut «Kun oxiridagi qoldiq». */
  tableLabel?: string;
  /** Bo'sh holat izohi (masalan kunlik qoldiq hali tayyorlanmoqda). */
  emptyHint?: string;
};

const MASK = "••••••";

const AXIS_TICK = { fill: "var(--color-text-subtle)", fontSize: 12 } as const;

type TooltipProps = {
  active?: boolean;
  payload?: Array<{ payload?: DailyBalancePoint }>;
  language: string;
  labels: { endOfDay: string; income: string; expense: string };
};

/** `.el-tip` — `RAISED` karta: avval qiymat, keyin yorliq. */
const BalanceTooltip = ({ active, payload, language, labels }: TooltipProps) => {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  const date = parseIsoDate(point.date);
  return (
    <div className="flex min-w-[200px] flex-col gap-1.5 rounded-xl border border-border bg-raised px-3 py-2.5 shadow-xl">
      <span className="whitespace-nowrap text-xs font-semibold text-text-muted">
        {date ? formatDateLocalized(date, { language }) : point.date}
      </span>
      <div className="flex items-center gap-2 whitespace-nowrap text-[13px]">
        <span aria-hidden="true" className="h-0.5 w-3 rounded-full bg-chart-1" />
        <span className="font-bold text-text">{formatMoneyLocalized(point.balance, { language })}</span>
        <span className="text-text-muted">{labels.endOfDay}</span>
      </div>
      <div className="h-px bg-border" />
      <div className="flex items-center gap-2 whitespace-nowrap text-[13px]">
        <span aria-hidden="true" className="size-2.5 rounded-[3px] bg-chart-1" />
        <span className="font-bold text-text">{formatSignedMoneyLocalized(point.income, { language })}</span>
        <span className="text-text-muted">{labels.income}</span>
      </div>
      <div className="flex items-center gap-2 whitespace-nowrap text-[13px]">
        <span aria-hidden="true" className="size-2.5 rounded-[3px] bg-chart-8" />
        <span className="font-bold text-text">{formatSignedMoneyLocalized(-point.expense, { language })}</span>
        <span className="text-text-muted">{labels.expense}</span>
      </div>
    </div>
  );
};

const MainCashboxBalanceChart = ({
  points,
  view,
  hidden = false,
  isLoading = false,
  isError = false,
  error,
  onRetry,
  chartLabelKey = "v2MainCashbox.balance.chartLabel",
  tableLabel,
  emptyHint,
}: Props) => {
  const { t, i18n } = useTranslation("payments");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const todayKey = toIsoDate(new Date());
  const tableName = tableLabel ?? t("v2MainCashbox.balance.tableLabel");

  const axisDate = (value: string) => {
    if (value === todayKey) return t("v2MainCashbox.balance.today");
    const [, month, day] = value.split("-");
    return month && day ? `${day}.${month}` : value;
  };
  const fullDate = (value: string) => {
    const date = parseIsoDate(value);
    return date ? formatDateLocalized(date, { language }) : value;
  };
  const compact = (value: number) => formatCompactMoneyLocalized(value, { language, withCurrency: false });
  const money = (value: number) => (hidden ? MASK : formatMoneyLocalized(value, { language }));

  const tableRows = useMemo(() => [...points].reverse(), [points]);
  const columns = useMemo<DataTableColumn<DailyBalancePoint>[]>(
    () => [
      {
        id: "date",
        header: t("v2MainCashbox.balance.columns.date"),
        className: "whitespace-nowrap",
        cell: (row) => fullDate(row.date),
      },
      {
        id: "balance",
        header: t("v2MainCashbox.balance.columns.endOfDay"),
        align: "end",
        cell: (row) => <span className="font-semibold">{money(row.balance)}</span>,
      },
      {
        id: "income",
        header: t("v2MainCashbox.balance.columns.income"),
        align: "end",
        cell: (row) => (
          <span className={row.income > 0 ? "text-success-fg" : "text-text-muted"}>
            {hidden ? MASK : formatSignedMoneyLocalized(row.income, { language })}
          </span>
        ),
      },
      {
        id: "expense",
        header: t("v2MainCashbox.balance.columns.expense"),
        align: "end",
        cell: (row) => (
          <span className={row.expense > 0 ? "text-danger-fg" : "text-text-muted"}>
            {hidden ? MASK : formatSignedMoneyLocalized(-row.expense, { language })}
          </span>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- formatlovchilar til va `hidden` ga bog'liq
    [hidden, language, t],
  );

  if (isLoading) {
    return (
      <div role="status" aria-label={t("v2MainCashbox.balance.loading")}>
        <SkeletonChart className="h-[280px] max-md:h-40" bars={12} />
      </div>
    );
  }
  if (isError) {
    return <ErrorState size="chart" error={error} title={t("v2MainCashbox.balance.loadError")} onRetry={onRetry} />;
  }
  if (points.length < 2) {
    return (
      <EmptyState
        size="chart"
        icon={ChartLine}
        title={t("v2MainCashbox.balance.chartEmpty")}
        description={emptyHint ?? t("v2MainCashbox.balance.chartEmptyHint")}
      />
    );
  }

  if (view === "table") {
    return (
      <div className="min-w-0 overflow-hidden rounded-xl border border-border md:max-h-[320px] md:overflow-y-auto">
        <DataTable
          rows={tableRows}
          columns={columns}
          density="compact"
          getRowKey={(row) => row.date}
          label={tableName}
          cardsLabel={tableName}
          renderCard={(row) => (
            <div className="flex flex-col gap-1 px-4 py-3 text-sm">
              <div className="flex justify-between gap-2">
                <span className="font-semibold text-text">{fullDate(row.date)}</span>
                <span className="whitespace-nowrap font-semibold text-text">{money(row.balance)}</span>
              </div>
              <div className="flex flex-wrap justify-end gap-x-3 text-[13px]">
                <span className={row.income > 0 ? "text-success-fg" : "text-text-muted"}>
                  {hidden ? MASK : formatSignedMoneyLocalized(row.income, { language })}
                </span>
                <span className={row.expense > 0 ? "text-danger-fg" : "text-text-muted"}>
                  {hidden ? MASK : formatSignedMoneyLocalized(-row.expense, { language })}
                </span>
              </div>
            </div>
          )}
        />
      </div>
    );
  }

  const ticks = buildTicks(points.map((point) => point.balance));
  const first = points[0];
  const last = points[points.length - 1];
  const lastIndex = points.length - 1;
  const ariaLabel = t(chartLabelKey, {
    from: fullDate(first.date),
    to: fullDate(last.date),
    first: money(first.balance),
    last: money(last.balance),
  });

  const renderDot = (props: { cx?: number; cy?: number; index?: number }): ReactNode => {
    const { cx, cy, index } = props;
    if (index !== lastIndex || cx === undefined || cy === undefined) return <g key={`dot-${index}`} />;
    return (
      <circle
        key={`dot-${index}`}
        cx={cx}
        cy={cy}
        r={5}
        fill="var(--color-chart-1)"
        stroke="var(--color-surface)"
        strokeWidth={2}
      />
    );
  };

  const renderEndLabel = (props: { x?: number | string; y?: number | string; index?: number }): ReactElement | null => {
    const x = Number(props.x);
    const y = Number(props.y);
    if (hidden || props.index !== lastIndex || !Number.isFinite(x) || !Number.isFinite(y)) return null;
    return (
      <text x={x + 10} y={y} dy={4} fill="var(--color-text)" fontSize={13} fontWeight={700}>
        {compact(last.balance)}
      </text>
    );
  };

  return (
    <figure className="m-0 min-w-0" role="img" aria-label={ariaLabel}>
      <div className="h-[280px] min-w-0 max-md:h-40" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points as DailyBalancePoint[]} margin={{ top: 12, right: 64, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--color-border)" />
            <XAxis
              dataKey="date"
              tickFormatter={axisDate}
              tickLine={false}
              axisLine={false}
              tick={AXIS_TICK}
              interval="preserveStartEnd"
              minTickGap={24}
              tickMargin={8}
            />
            <YAxis
              tickFormatter={(value: number) => (hidden ? "" : compact(value))}
              width={hidden ? 8 : 64}
              tickLine={false}
              axisLine={false}
              tick={AXIS_TICK}
              ticks={ticks}
              domain={[ticks[0], ticks[ticks.length - 1]]}
              interval={0}
            />
            {hidden ? null : (
              <Tooltip
                cursor={{ stroke: "var(--color-border-strong)" }}
                wrapperClassName="max-md:hidden"
                content={
                  <BalanceTooltip
                    language={language}
                    labels={{
                      endOfDay: t("v2MainCashbox.balance.endOfDay"),
                      income: t("v2MainCashbox.balance.income"),
                      expense: t("v2MainCashbox.balance.expense"),
                    }}
                  />
                }
              />
            )}
            <Area
              type="monotone"
              dataKey="balance"
              stroke="var(--color-chart-1)"
              strokeWidth={2}
              fill="var(--color-chart-1)"
              fillOpacity={0.1}
              dot={renderDot}
              activeDot={hidden ? false : { r: 5, fill: "var(--color-chart-1)", stroke: "var(--color-surface)" }}
              label={renderEndLabel}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
};

export default memo(MainCashboxBalanceChart);
