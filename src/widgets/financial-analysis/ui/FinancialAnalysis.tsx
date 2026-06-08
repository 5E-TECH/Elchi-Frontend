import { memo, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AreaChart,
  BarChart,
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Wallet,
  Store,
  Bike,
  Scale,
  BarChart2,
} from "lucide-react";
import { useDashboard, type RevenuePoint } from "../../../entities/dashboard";
import {
  formatCompactMoney,
  toneAccent,
  toneSoftBg,
  type Tone,
  TYPO,
  TEXT,
} from "../../../shared/config/designSystem";

/**
 * FinancialAnalysis — moliyaviy tahlil bo'limi.
 *
 * Eski versiyada bu yerda DashboardStatistics bilan TAKRORLANADIGAN kartalar
 * bor edi (bugungi daromad/buyurtma, haftalik daromad, davr statistikasi).
 * Ular olib tashlandi. Endi bu bo'lim FAQAT noyob ma'lumotni ko'rsatadi:
 *   1) Kassa balansi holati (Pochta / marketlar / kuryerlar / joriy holat),
 *   2) Daromad trendi grafigi.
 */

type ChartType = "Area" | "Bar" | "Combo";
export type RevenuePeriod = "daily" | "weekly" | "monthly" | "yearly";

const CHART_TYPES: ChartType[] = ["Area", "Bar", "Combo"];
const PERIODS: RevenuePeriod[] = ["daily", "weekly", "monthly", "yearly"];

const MAIN_COLOR = "var(--color-main)";
const GREEN_COLOR = "var(--color-success)";

const AXIS_PROPS = {
  tick: { fill: "var(--color-dashboard-chart-axis)", fontSize: 12, fontWeight: 600 },
  axisLine: false as const,
  tickLine: false as const,
};

const GRID_PROPS = {
  stroke: "var(--color-dashboard-chart-grid)",
  strokeDasharray: "4 4",
  vertical: false,
};

const formatCurrency = (value: number) => value.toLocaleString("uz-UZ");

// ─── CustomTooltip ────────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: any) => {
  const { t } = useTranslation("dashboard");
  if (!active || !payload?.length) return null;
  return (
    <div className="el-card-soft rounded-xl px-3 py-2 text-[11px]">
      <p className="mb-1 font-semibold" style={{ color: TEXT.strong }}>
        {label}
      </p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="font-bold" style={{ color: entry.color }}>
          {t("currency_value", { value: formatCurrency(Number(entry.value ?? 0)) })}
        </p>
      ))}
    </div>
  );
};

// ─── Chart Variants ───────────────────────────────────────────────────────────

const AreaVariant = ({ data }: { data: Array<{ date: string; revenue: number }> }) => (
  <AreaChart data={data}>
    <defs>
      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={MAIN_COLOR} stopOpacity={0.3} />
        <stop offset="100%" stopColor={MAIN_COLOR} stopOpacity={0} />
      </linearGradient>
    </defs>
    <CartesianGrid {...GRID_PROPS} />
    <XAxis dataKey="date" {...AXIS_PROPS} interval={2} />
    <YAxis tickFormatter={formatCurrency} {...AXIS_PROPS} />
    <Tooltip content={<CustomTooltip />} />
    <Area
      type="monotone"
      dataKey="revenue"
      stroke={MAIN_COLOR}
      strokeWidth={2}
      fill="url(#revenueGrad)"
      dot={false}
      activeDot={{ r: 5, fill: MAIN_COLOR, stroke: "var(--color-primary)", strokeWidth: 2 }}
    />
  </AreaChart>
);

const BarVariant = ({ data }: { data: Array<{ date: string; revenue: number }> }) => (
  <BarChart data={data} barSize={10}>
    <CartesianGrid {...GRID_PROPS} />
    <XAxis dataKey="date" {...AXIS_PROPS} interval={2} />
    <YAxis tickFormatter={formatCurrency} {...AXIS_PROPS} />
    <Tooltip content={<CustomTooltip />} />
    <Bar dataKey="revenue" fill={MAIN_COLOR} fillOpacity={0.7} radius={[3, 3, 0, 0]} />
  </BarChart>
);

const ComboVariant = ({ data }: { data: Array<{ date: string; revenue: number }> }) => (
  <ComposedChart data={data} barSize={10}>
    <CartesianGrid {...GRID_PROPS} />
    <XAxis dataKey="date" {...AXIS_PROPS} interval={2} />
    <YAxis tickFormatter={formatCurrency} {...AXIS_PROPS} />
    <Tooltip content={<CustomTooltip />} />
    <Bar dataKey="revenue" fill={MAIN_COLOR} fillOpacity={0.35} radius={[3, 3, 0, 0]} />
    <Line
      type="monotone"
      dataKey="revenue"
      stroke={GREEN_COLOR}
      strokeWidth={2}
      dot={false}
      activeDot={{ r: 4, fill: GREEN_COLOR }}
    />
  </ComposedChart>
);

// ─── RevenueChart ─────────────────────────────────────────────────────────────

const RevenueChart = memo(({ data }: { data: Array<{ date: string; revenue: number }> }) => {
  const { t } = useTranslation("dashboard");
  const [activeType, setActiveType] = useState<ChartType>("Area");

  const chart = useCallback(() => {
    if (activeType === "Bar") return <BarVariant data={data} />;
    if (activeType === "Combo") return <ComboVariant data={data} />;
    return <AreaVariant data={data} />;
  }, [activeType, data]);

  return (
    <div className="el-card flex h-full flex-col rounded-2xl p-5">
      <div className="mb-5 flex items-center justify-between">
        <h3 className={`${TYPO.sectionTitle} text-maindark dark:text-primary`}>
          {t("chart.title")}
        </h3>
        <div className="el-segmented">
          {CHART_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setActiveType(type)}
              className={`el-segmented-button px-3.5 py-1 text-xs font-semibold ${
                activeType === type ? "el-segmented-button-active" : ""
              }`}
            >
              {t(`chart.types.${type.toLowerCase()}`)}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        {chart()}
      </ResponsiveContainer>

      <p className="mt-3 text-center text-[13px] tracking-[0.2px]" style={{ color: TEXT.strong }}>
        {t("chart.description")}
      </p>
    </div>
  );
});

RevenueChart.displayName = "RevenueChart";

// ─── FinancialAnalysis ────────────────────────────────────────────────────────

export interface FinancialAnalysisProps {
  startDate?: string;
  endDate?: string;
}

const FinancialAnalysis = memo(({ startDate, endDate }: FinancialAnalysisProps) => {
  const { t } = useTranslation("dashboard");
  const { getRevenue } = useDashboard();
  const [period, setPeriod] = useState<RevenuePeriod>("daily");

  const revenueParams = useMemo(() => {
    const params: Record<string, string> = { period };
    if (startDate) {
      params.startDate = startDate;
      params.start_day = startDate;
    }
    if (endDate) {
      params.endDate = endDate;
      params.end_day = endDate;
    }
    return params;
  }, [endDate, period, startDate]);

  const { data } = getRevenue(revenueParams);
  const revenuePayload = data?.data;

  // Daromad grafigi nuqtalari
  const rawRevenuePoints = Object.values(revenuePayload ?? {}).filter(
    (item): item is RevenuePoint =>
      typeof item === "object" &&
      item !== null &&
      "label" in item &&
      "revenue" in item &&
      "ordersCount" in item,
  );
  const chartData =
    revenuePayload?.chart?.labels?.length && revenuePayload?.chart?.values?.length
      ? revenuePayload.chart.labels.map((label, index) => ({
          date: label,
          revenue: Number(revenuePayload.chart?.values?.[index] ?? 0),
        }))
      : rawRevenuePoints.map((item) => ({
          date: item.label,
          revenue: Number(item.revenue ?? 0),
        }));

  // Noyob moliyaviy balans ma'lumotlari (kassa holati) — DashboardStatistics'da YO'Q
  const finance = revenuePayload?.finance;
  const hasFinance = Boolean(finance);
  const mainBalance = Number(finance?.main?.balance ?? 0);
  const marketsBalance = Number(finance?.markets?.marketsTotalBalans ?? 0);
  const couriersBalance = Number(finance?.couriers?.couriersTotalBalanse ?? 0);
  const currentSituation = Number(finance?.currentSituation ?? 0);

  const balanceRows: Array<{
    title: string;
    value: number;
    icon: React.ReactNode;
    tone: Tone;
  }> = [
    { title: t("balance.main"), value: mainBalance, icon: <Wallet size={16} />, tone: "brand" },
    { title: t("balance.markets"), value: marketsBalance, icon: <Store size={16} />, tone: "info" },
    { title: t("balance.couriers"), value: couriersBalance, icon: <Bike size={16} />, tone: "warning" },
    {
      title: t("balance.current"),
      value: currentSituation,
      icon: <Scale size={16} />,
      tone: currentSituation < 0 ? "danger" : "success",
    },
  ];

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 size={18} style={{ color: "var(--color-main)" }} />
          <div>
            <h2 className={`${TYPO.sectionTitle} text-maindark dark:text-primary`}>
              {t("financial_analysis.title")}
            </h2>
            <p className="mt-1 text-xs" style={{ color: TEXT.soft }}>
              {t("financial_analysis.subtitle")}
            </p>
          </div>
        </div>

        <div className="el-segmented">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`el-segmented-button px-3.5 py-1.5 text-xs font-semibold ${
                period === p ? "el-segmented-button-active" : ""
              }`}
            >
              {t(`periods.${p}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Bento: keng daromad grafigi + tor kassa balansi paneli */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className={hasFinance ? "lg:col-span-8" : "lg:col-span-12"}>
          <RevenueChart data={chartData} />
        </div>
        {hasFinance && (
          <div className="lg:col-span-4">
            <FinanceBalancePanel
              title={t("balance.title")}
              rows={balanceRows}
              currency={t("currency_sum")}
            />
          </div>
        )}
      </div>
    </section>
  );
});

// ─── FinanceBalancePanel ──────────────────────────────────────────────────────
// Kassa balanslari — gorizontal mini-bar ko'rinishida (grafiklar xilma-xilligi).

interface FinanceBalancePanelProps {
  title: string;
  currency: string;
  rows: Array<{ title: string; value: number; icon: React.ReactNode; tone: Tone }>;
}

const FinanceBalancePanel = memo(({ title, currency, rows }: FinanceBalancePanelProps) => {
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  return (
    <div className="el-card flex h-full flex-col rounded-2xl p-5">
      <div className="mb-5 flex items-center gap-2">
        <Wallet size={16} style={{ color: "var(--color-main)" }} />
        <h3 className={`${TYPO.sectionTitle} text-maindark dark:text-primary`}>{title}</h3>
      </div>

      <div className="flex flex-1 flex-col justify-between gap-4">
        {rows.map((r) => {
          const accent = toneAccent(r.tone);
          const width = Math.max(6, (Math.abs(r.value) / maxAbs) * 100);
          return (
            <div key={r.title}>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-2 text-[12px] font-semibold" style={{ color: TEXT.strong }}>
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-lg"
                    style={{ background: toneSoftBg(r.tone, 16), color: accent }}
                  >
                    {r.icon}
                  </span>
                  {r.title}
                </span>
                <span className="text-[13px] font-bold text-maindark dark:text-primary">
                  {formatCompactMoney(r.value)}
                  <span className="ml-1 text-[10px] font-semibold uppercase" style={{ color: TEXT.soft }}>
                    {currency}
                  </span>
                </span>
              </div>
              <div
                className="h-2 w-full overflow-hidden rounded-full"
                style={{ background: toneSoftBg(r.tone, 14) }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${width}%`, background: accent }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

FinanceBalancePanel.displayName = "FinanceBalancePanel";

FinancialAnalysis.displayName = "FinancialAnalysis";

export default FinancialAnalysis;
