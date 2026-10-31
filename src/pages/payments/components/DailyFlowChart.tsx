// dizayn-v2: superadmin-payments-overview, admin-payments-overview, manager-payments-overview, superadmin-balance-analysis, admin-balance-analysis
import { memo, useMemo, useState } from "react";
import { ChartColumn } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toISODate } from "../../../shared/lib/dateRange";
import { formatDateLocalized } from "../../../shared/lib/formatDateTime";
import {
  MINUS_SIGN,
  formatCompactMoneyLocalized,
  formatSignedMoneyLocalized,
} from "../../../shared/lib/formatMoney";
import { DataTable, EmptyState, type DataTableColumn } from "../../../shared/ui/primitives";
import { buildTicks } from "./lib/chartScale";

export type DailyFlowPoint = { date: string; income: number; expense: number; net: number };

type PlotRow = { date: string; income: number; expense: number; net: number };

type DailyFlowChartProps = {
  days: readonly DailyFlowPoint[];
  view: "chart" | "table";
  /** Grafik mazmuni bir jumlada (ekran o'quvchi). */
  ariaLabel: string;
  tableLabel: string;
  /** «Sof oqim» chizig'i (maket `*-payments-overview`). «Kassa oqimi» va daftar grafigida — yo'q. */
  showNet?: boolean;
};

const AXIS_TICK = { fill: "var(--color-text-subtle)", fontSize: 12 } as const;

type TooltipLabels = { income: string; expense: string; net: string };

type FlowTooltipProps = {
  active?: boolean;
  payload?: Array<{ payload?: PlotRow }>;
  language: string;
  labels: TooltipLabels;
  showNet: boolean;
};

/** `.el-tip` — `RAISED` karta: avval qiymat, keyin yorliq. */
const FlowTooltip = ({ active, payload, language, labels, showNet }: FlowTooltipProps) => {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="flex min-w-[200px] flex-col gap-1.5 rounded-xl border border-border bg-raised px-3 py-2.5 shadow-xl">
      <span className="whitespace-nowrap text-xs font-semibold text-text-muted">{formatDateLocalized(row.date, { language })}</span>
      <div className="flex items-center gap-2 whitespace-nowrap text-[13px]">
        <span aria-hidden="true" className="size-2.5 rounded-[3px] bg-chart-1" />
        <span className="font-bold text-text">{formatSignedMoneyLocalized(row.income, { language })}</span>
        <span className="text-text-muted">{labels.income}</span>
      </div>
      <div className="flex items-center gap-2 whitespace-nowrap text-[13px]">
        <span aria-hidden="true" className="size-2.5 rounded-[3px] bg-chart-8" />
        <span className="font-bold text-text">{formatSignedMoneyLocalized(row.expense, { language })}</span>
        <span className="text-text-muted">{labels.expense}</span>
      </div>
      {showNet ? (
        <>
          <div className="h-px bg-border" />
          <div className="flex items-center gap-2 whitespace-nowrap text-[13px]">
            <span aria-hidden="true" className="h-0.5 w-3 rounded-full bg-text-muted" />
            <span className="font-bold text-text">{formatSignedMoneyLocalized(row.net, { language })}</span>
            <span className="text-text-muted">{labels.net}</span>
          </div>
        </>
      ) : null}
    </div>
  );
};

/**
 * KUNLIK KIRIM VA CHIQIM (`.el-plot` + `.el-bars`, `tizim-charts`): kirim noldan yuqoriga, chiqim pastga, ixtiyoriy
 * «Sof oqim» chizig'i; «Grafik | Jadval» egizagi (`view`). Oqim yo'q davr — `EmptyState` (bo'sh grafik chizilmaydi).
 * Telefonda maslahat yashirin: ustunga teginilsa pastdagi qatorda o'sha kun (sukut — oxirgi kun, maket
 * `manager-payments-overview`). Ranglar tokenlardan: kirim `chart-1`, chiqim `chart-8`, sof `text-muted`.
 */
const DailyFlowChart = ({ days, view, ariaLabel, tableLabel, showNet = false }: DailyFlowChartProps) => {
  const { t, i18n } = useTranslation("payments");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const todayKey = toISODate(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const rows = useMemo<PlotRow[]>(
    () => days.map((day) => ({ date: day.date, income: day.income, expense: -day.expense, net: day.net })),
    [days],
  );
  const hasFlow = days.some((day) => day.income !== 0 || day.expense !== 0);

  const signed = (value: number) => formatSignedMoneyLocalized(value, { language });
  const fullDate = (value: string) => formatDateLocalized(value, { language });
  const columns = useMemo<DataTableColumn<DailyFlowPoint>[]>(
    () => [
      {
        id: "date",
        header: t("v2Daily.table.date"),
        className: "whitespace-nowrap",
        cell: (row) => formatDateLocalized(row.date, { language }),
      },
      {
        id: "income",
        header: t("v2Daily.income"),
        align: "end",
        cell: (row) => (
          <span className={row.income > 0 ? "whitespace-nowrap text-success-fg" : "whitespace-nowrap text-text-muted"}>
            {formatSignedMoneyLocalized(row.income, { language })}
          </span>
        ),
      },
      {
        id: "expense",
        header: t("v2Daily.expense"),
        align: "end",
        cell: (row) => (
          <span className={row.expense > 0 ? "whitespace-nowrap text-danger-fg" : "whitespace-nowrap text-text-muted"}>
            {formatSignedMoneyLocalized(-row.expense, { language })}
          </span>
        ),
      },
      {
        id: "net",
        header: t("v2Daily.table.net"),
        align: "end",
        cell: (row) => (
          <span className="whitespace-nowrap font-semibold">{formatSignedMoneyLocalized(row.net, { language })}</span>
        ),
      },
    ],
    [language, t],
  );

  if (!hasFlow) {
    return (
      <EmptyState
        size="chart"
        icon={ChartColumn}
        title={t("v2Daily.flow.empty")}
        description={t("v2Daily.flow.emptyHint")}
      />
    );
  }

  if (view === "table") {
    return (
      <div className="min-w-0 overflow-hidden rounded-xl border border-border md:max-h-[320px] md:overflow-y-auto">
        <DataTable
          rows={[...days].reverse()}
          columns={columns}
          density="compact"
          getRowKey={(row) => row.date}
          label={tableLabel}
          cardsLabel={tableLabel}
          renderCard={(row) => (
            <div className="flex flex-col gap-1 px-4 py-3 text-sm">
              <div className="flex justify-between gap-2">
                <span className="font-semibold text-text">{fullDate(row.date)}</span>
                <span className="whitespace-nowrap font-semibold text-text">{signed(row.net)}</span>
              </div>
              <div className="flex flex-wrap justify-end gap-x-3 text-[13px]">
                <span className={row.income > 0 ? "text-success-fg" : "text-text-muted"}>{signed(row.income)}</span>
                <span className={row.expense > 0 ? "text-danger-fg" : "text-text-muted"}>{signed(-row.expense)}</span>
              </div>
            </div>
          )}
        />
      </div>
    );
  }

  const ticks = buildTicks(rows.flatMap((row) => [row.income, row.expense, ...(showNet ? [row.net] : [])]));
  const axisDate = (value: string) => {
    if (value === todayKey) return t("v2Daily.today");
    const [, month, day] = value.split("-");
    return month && day ? `${day}.${month}` : value;
  };
  const compact = (value: number) => {
    const text = formatCompactMoneyLocalized(Math.abs(value), { language, withCurrency: false });
    return value < 0 ? `${MINUS_SIGN}${text}` : text;
  };
  const selected = days.find((day) => day.date === selectedDate) ?? days[days.length - 1];
  const selectedLabel = selected.date === todayKey ? t("v2Daily.today") : axisDate(selected.date);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <figure className="m-0 min-w-0" role="img" aria-label={ariaLabel}>
        <div className="h-[290px] min-w-0 max-md:h-44" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={rows}
              stackOffset="sign"
              margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              onClick={(state) => {
                const label = state?.activeLabel;
                if (typeof label === "string") setSelectedDate(label);
              }}
            >
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
                tickFormatter={compact}
                width={64}
                tickLine={false}
                axisLine={false}
                tick={AXIS_TICK}
                ticks={ticks}
                domain={[ticks[0], ticks[ticks.length - 1]]}
                interval={0}
              />
              <Tooltip
                cursor={{ fill: "var(--color-row-hover)" }}
                wrapperClassName="max-md:hidden"
                content={
                  <FlowTooltip
                    language={language}
                    showNet={showNet}
                    labels={{
                      income: t("v2Daily.income"),
                      expense: t("v2Daily.expense"),
                      net: t("v2Daily.net"),
                    }}
                  />
                }
              />
              <ReferenceLine y={0} stroke="var(--color-border-strong)" />
              <Bar dataKey="income" stackId="flow" fill="var(--color-chart-1)" maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="expense" stackId="flow" fill="var(--color-chart-8)" maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              {showNet ? (
                <Line
                  type="monotone"
                  dataKey="net"
                  stroke="var(--color-text-muted)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
              ) : null}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </figure>
      <div
        role="status"
        className="hidden items-center justify-between gap-2 rounded-[10px] bg-sunken px-3 py-2.5 max-md:flex"
      >
        <span className="whitespace-nowrap text-[13px] font-semibold text-text">
          {t("v2Daily.selectedDay", { date: selectedLabel })}
        </span>
        <span className="flex gap-2.5 whitespace-nowrap text-[13px]">
          <span className="text-success-fg">
            {formatSignedMoneyLocalized(selected.income, { language, withCurrency: false })}
          </span>
          <span className="text-danger-fg">
            {formatSignedMoneyLocalized(-selected.expense, { language, withCurrency: false })}
          </span>
        </span>
      </div>
    </div>
  );
};

export default memo(DailyFlowChart);
