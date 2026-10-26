// dizayn-v2: (maket yo'q) superadmin-balance-analysis
import { memo, useState } from "react";
import { Bot, Cpu, PhoneCall, Receipt, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  ORDER_SOURCE_KEYS,
  useAiOrders,
  useAiUsageDashboard,
  type AiOrderItem,
  type AiOrderSources,
  type AiUsageDay,
  type AiUsageFeatureRow,
  type OrderSourceKey,
} from "../../../entities/ai-usage";
import { splitCompactMoney } from "../../../entities/dashboard/lib/period";
import { OrderStatusBadge } from "../../../entities/order";
import { cx } from "../../../shared/lib/cx";
import { getThisMonthRange, getThisWeekRange, getTodayRange, toISODate, type ISODateRange } from "../../../shared/lib/dateRange";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import {
  CURRENCY_LABEL,
  formatCompactMoneyLocalized,
  formatMoneyLocalized,
  formatNumberLocalized,
  formatPercentLocalized,
  formatUsdLocalized,
  resolveMoneyLanguage,
} from "../../../shared/lib/formatMoney";
import { ChartNote, HBarList, SegBar, StackedBars, ViewToggle, type ChartTone, type ChartView } from "../../../shared/ui/charts";
import {
  Badge,
  Card,
  DataTable,
  DateRange,
  EmptyState,
  ErrorState,
  Field,
  QueryBoundary,
  SegmentedControl,
  SkeletonChart,
  SkeletonTable,
  StatCard,
  type DataTableColumn,
} from "../../../shared/ui/primitives";
import { formatDay, formatRangeShort } from "../../../shared/ui/primitives/date/calendarMath";
import { useIsPhone } from "../../../shared/ui/primitives/date/useIsPhone";

/**
 * «AI XARAJAT» TABI (Celz3rKJ) — `/financial-balance?tab=ai` (superadmin, admin). Backend: `GET /ai-usage/dashboard`
 * (xarajat USD/so'm, funksiya va model kesimi, Toshkent kuni bo'yicha trend, buyurtma manbasi) va
 * `GET /ai-usage/ai-orders` (AI buyurtmalar). Karta matni bo'yicha alohida sahifa EMAS — «Balans» ichida tab
 * (BeePost naqshi).
 *
 * Maket yo'q (dizayn ziddiyati: maketda faqat «Umumiy ko'rinish · Tarix · Tahlil») — eng yaqini
 * `superadmin-balance-analysis` (davr tanlovi, grafik kartalari) va `tizim-charts`. Kunlik trend — `StackedBars`
 * (recharts emas) + «Grafik | Jadval»; telefonda jadvallar kartaga aylanadi (gorizontal skroll yo'q).
 */

type Period = "today" | "week" | "month" | "last30" | "custom";
type Preset = Exclude<Period, "custom">;

/** Oxirgi 30 kun (bugun bilan) — backend sukuti bilan bir xil. */
const getLast30DaysRange = (): ISODateRange => {
  const today = getTodayRange();
  const start = new Date(`${today.to}T00:00:00`);
  start.setDate(start.getDate() - 29);
  return { from: toISODate(start), to: today.to };
};

const PRESET_RANGE: Record<Preset, () => ISODateRange> = {
  today: getTodayRange,
  week: getThisWeekRange,
  month: getThisMonthRange,
  last30: getLast30DaysRange,
};

const sameRange = (a: ISODateRange, b: ISODateRange) => a.from === b.from && a.to === b.to;

const resolvePeriod = (range: ISODateRange, chosen: Preset | null): Period => {
  if (chosen && sameRange(PRESET_RANGE[chosen](), range)) return chosen;
  for (const key of ["today", "week", "month", "last30"] as const) {
    if (sameRange(PRESET_RANGE[key](), range)) return key;
  }
  return "custom";
};

/** Buyurtma manbasi — tartib va ton (AI — ko'k action, qolgani neytral/ma'lumot). */
const SOURCE_TONE: Record<OrderSourceKey, ChartTone> = {
  ai: "action",
  manual: "neutral",
  bot: "info",
  external: "warning",
  branch: "success",
};

/** Ma'lum funksiya kalitlari (backend: `order_extract_multi`, `order_extract_image`, `order_district`, `order_item_match`). */
const KNOWN_FEATURES = new Set(["order_extract_multi", "order_extract_image", "order_district", "order_item_match"]);

const AiCostTab = () => {
  const { t, i18n } = useTranslation("aiUsage");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const [range, setRange] = useState<ISODateRange>(getLast30DaysRange);
  const [preset, setPreset] = useState<Preset | null>("last30");
  const [trendView, setTrendView] = useState<ChartView>("chart");
  const isPhone = useIsPhone();
  const period = resolvePeriod(range, preset);

  const dashboardQuery = useAiUsageDashboard(range);
  const ordersQuery = useAiOrders(range);

  const money = (value: number) => formatMoneyLocalized(value, { language });
  const compact = (value: number) => formatCompactMoneyLocalized(value, { language });
  const usd = (value: number) => formatUsdLocalized(value, { language });
  const count = (value: number) => formatNumberLocalized(value, { language });
  const featureLabel = (feature: string) => (KNOWN_FEATURES.has(feature) ? t(`feature.${feature}`) : feature);
  const rangeText = formatRangeShort(range) ?? "";

  const changeRange = (next: ISODateRange, nextPreset: Preset | null) => {
    setPreset(nextPreset);
    setRange(next);
  };

  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      <div role="group" aria-label={t("period")} className="flex max-w-[680px] flex-wrap items-center gap-3">
        <Field label={t("period")} hideLabel labelAs="span" className="min-w-0 flex-[1_1_220px] max-md:basis-full">
          <DateRange value={range} onChange={(next) => changeRange(next, null)} presets={false} clearable={false} />
        </Field>
        <SegmentedControl<Period>
          ariaLabel={t("periodSeg")}
          className="flex-none max-md:w-full"
          value={period}
          onValueChange={(value) => {
            if (value === "custom") return;
            changeRange(PRESET_RANGE[value](), value);
          }}
          options={[
            { value: "today", label: t("presets.today") },
            { value: "week", label: t("presets.week") },
            { value: "month", label: t("presets.month") },
            { value: "last30", label: t("presets.last30") },
          ]}
        />
      </div>

      <QueryBoundary
        query={dashboardQuery}
        isEmpty={() => false}
        loadingLabel={t("loading")}
        loading={
          <>
            <section aria-label={t("kpi.label")} className="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-md:gap-3">
              {["cost", "calls", "orders", "average"].map((key) => (
                <StatCard key={key} label={t(`kpi.${key}`)} loading />
              ))}
            </section>
            <Card divided={false} title={t("trend.title")}>
              <SkeletonChart />
            </Card>
          </>
        }
        error={(error, retry) => <ErrorState framed error={error} title={t("loadFailed")} onRetry={retry} />}
      >
        {(dashboard, { isRefetching }) => {
          const { summary } = dashboard;
          const cost = splitCompactMoney(summary.totalCostUzs, language);
          const trendToggle = (
            <ViewToggle value={trendView} onChange={setTrendView} ariaLabel={t("trend.viewLabel")} className="max-md:w-full" />
          );
          return (
            <div className={cx("flex flex-col gap-6 transition-opacity max-md:gap-4", isRefetching && "opacity-60")}>
              <section aria-label={t("kpi.label")} className="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-md:gap-3">
                <StatCard
                  data-kpi="cost"
                  label={t("kpi.cost")}
                  icon={Receipt}
                  value={cost.value}
                  unit={cost.unit}
                  hint={usd(summary.totalCostUsd)}
                />
                <StatCard
                  data-kpi="calls"
                  label={t("kpi.calls")}
                  icon={PhoneCall}
                  value={count(summary.totalCalls)}
                  unit={t("unit.calls")}
                  hint={
                    summary.cacheSavedUzs > 0 ? t("kpi.cacheSaved", { value: compact(summary.cacheSavedUzs) }) : undefined
                  }
                />
                <StatCard
                  data-kpi="orders"
                  label={t("kpi.orders")}
                  icon={Sparkles}
                  value={count(summary.aiOrderCount)}
                  unit={t("unit.orders")}
                  hint={summary.aiOrderCount > 0 ? t("kpi.ordersCost", { value: compact(summary.orderCostUzs) }) : undefined}
                />
                <StatCard
                  data-kpi="average"
                  label={t("kpi.average")}
                  icon={Bot}
                  value={
                    summary.aiOrderCount > 0
                      ? formatMoneyLocalized(summary.avgCostPerAiOrderUzs, { language, withCurrency: false })
                      : "—"
                  }
                  unit={summary.aiOrderCount > 0 ? CURRENCY_LABEL[resolveMoneyLanguage(language)] : undefined}
                  hint={summary.aiOrderCount > 0 ? usd(summary.avgCostPerAiOrderUsd) : t("kpi.noOrders")}
                />
              </section>

              <div className="flex flex-wrap items-stretch gap-4">
                <Card
                  divided={false}
                  className="min-w-0 flex-[2_1_560px]"
                  title={t("trend.title")}
                  description={t("trend.subtitle", { range: rangeText })}
                  // Telefonda «Grafik | Jadval» sarlavha yonida siqilib qoladi — tana boshida to'liq enli (filial «Kunlik
                  // daromad» kartasidagi naqsh).
                  actions={isPhone ? undefined : trendToggle}
                  bodyClassName="flex flex-col gap-4"
                >
                  {isPhone ? trendToggle : null}
                  <DailyTrend days={dashboard.dailySeries} view={trendView} rangeText={rangeText} />
                </Card>
                <Card
                  divided={false}
                  className="min-w-0 flex-[1_1_320px]"
                  title={t("sources.title")}
                  description={t("sources.subtitle")}
                >
                  <SourcesBlock sources={dashboard.orderSources} onRetry={() => void dashboardQuery.refetch()} />
                </Card>
              </div>

              <div className="flex flex-wrap items-stretch gap-4">
                <Card
                  padding="none"
                  className="min-w-0 flex-[3_1_560px]"
                  title={t("features.title")}
                  description={t("features.subtitle")}
                >
                  <FeatureTable rows={dashboard.byFeature} featureLabel={featureLabel} />
                </Card>
                <Card divided={false} className="min-w-0 flex-[2_1_320px]" title={t("models.title")} description={t("models.subtitle")}>
                  {dashboard.byModel.length === 0 ? (
                    <EmptyState size="inline" icon={Cpu} title={t("models.empty")} />
                  ) : (
                    <HBarList
                      ariaLabel={t("models.title")}
                      rows={dashboard.byModel.map((row) => ({
                        id: row.model,
                        label: row.model,
                        value: row.costUzs,
                        display: compact(row.costUzs),
                        sub: t("models.sub", { calls: count(row.calls), usd: usd(row.costUsd) }),
                        tone: "action",
                      }))}
                      limit={5}
                      expandable
                    />
                  )}
                </Card>
              </div>

              {dashboard.usdUzsRate ? (
                <ChartNote>{t("rateNote", { rate: money(dashboard.usdUzsRate) })}</ChartNote>
              ) : null}
            </div>
          );
        }}
      </QueryBoundary>

      <AiOrdersCard query={ordersQuery} />
    </div>
  );
};

// ─── Kunlik trend ──────────────────────────────────────────────────────────────

const DailyTrend = ({ days, view, rangeText }: { days: AiUsageDay[]; view: ChartView; rangeText: string }) => {
  const { t, i18n } = useTranslation("aiUsage");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const money = (value: number) => formatMoneyLocalized(value, { language });
  const usd = (value: number) => formatUsdLocalized(value, { language });
  const count = (value: number) => formatNumberLocalized(value, { language });
  const hasData = days.some((day) => day.costUzs > 0 || day.calls > 0);
  if (!hasData) return <EmptyState size="chart" icon={Receipt} title={t("trend.empty")} />;

  if (view === "chart") {
    const today = toISODate(new Date());
    const total = days.reduce((sum, day) => sum + day.costUzs, 0);
    return (
      <StackedBars
        ariaLabel={t("trend.aria", { range: rangeText, total: money(total) })}
        series={[{ key: "cost", label: t("trend.cost"), tone: "action" }]}
        columns={days.map((day) => ({
          key: day.day,
          label: `${day.day.slice(8, 10)}.${day.day.slice(5, 7)}`,
          title: formatDay(day.day),
          values: { cost: day.costUzs },
          current: day.day === today,
        }))}
        formatValue={(value) => money(value)}
      />
    );
  }

  const columns: DataTableColumn<AiUsageDay>[] = [
    { id: "day", header: t("trend.date"), className: "whitespace-nowrap", cell: (row) => formatDay(row.day) },
    { id: "cost", header: t("trend.cost"), align: "end", cell: (row) => money(row.costUzs) },
    { id: "usd", header: "USD", align: "end", hideBelow: "lg", cell: (row) => usd(row.costUsd) },
    { id: "calls", header: t("trend.calls"), align: "end", cell: (row) => count(row.calls) },
    { id: "orders", header: t("trend.orders"), align: "end", cell: (row) => count(row.aiOrders) },
  ];
  return (
    <DataTable
      rows={days}
      columns={columns}
      getRowKey={(row) => row.day}
      label={t("trend.title")}
      density="compact"
      renderCard={(row) => (
        <div className="flex flex-col gap-1 px-4 py-3 text-sm text-text">
          <span className="flex justify-between gap-2">
            <span className="font-semibold">{formatDay(row.day)}</span>
            <span className="whitespace-nowrap font-semibold">{money(row.costUzs)}</span>
          </span>
          <span className="text-[13px] text-text-muted">
            {t("trend.cardMeta", { calls: count(row.calls), orders: count(row.aiOrders), usd: usd(row.costUsd) })}
          </span>
        </div>
      )}
    />
  );
};

// ─── Buyurtma manbasi ─────────────────────────────────────────────────────────

const SourcesBlock = ({ sources, onRetry }: { sources: AiOrderSources | null; onRetry: () => void }) => {
  const { t, i18n } = useTranslation("aiUsage");
  const language = i18n.resolvedLanguage ?? i18n.language;
  // `orderSources: null` — order-service javob bermadi (`degraded`): 0 lar emas, xato + «Qayta urinish».
  if (!sources) return <ErrorState size="chart" title={t("sources.failed")} onRetry={onRetry} />;
  if (sources.total === 0) return <EmptyState size="inline" icon={Sparkles} title={t("sources.empty")} />;
  const shareText = ORDER_SOURCE_KEYS.map(
    (key) => `${t(`sources.${key}`)} ${formatPercentLocalized(sources.shares[key], { language })}`,
  ).join(", ");
  return (
    <SegBar
      ariaLabel={t("sources.aria", { total: formatNumberLocalized(sources.total, { language }), list: shareText })}
      segments={ORDER_SOURCE_KEYS.map((key) => ({
        key,
        label: t(`sources.${key}`),
        value: sources.counts[key],
        tone: SOURCE_TONE[key],
      }))}
    />
  );
};

// ─── Funksiyalar ──────────────────────────────────────────────────────────────

const FeatureTable = ({ rows, featureLabel }: { rows: AiUsageFeatureRow[]; featureLabel: (feature: string) => string }) => {
  const { t, i18n } = useTranslation("aiUsage");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const money = (value: number) => formatMoneyLocalized(value, { language });
  const usd = (value: number) => formatUsdLocalized(value, { language });
  const count = (value: number) => formatNumberLocalized(value, { language });
  const columns: DataTableColumn<AiUsageFeatureRow>[] = [
    {
      id: "feature",
      header: t("features.col.feature"),
      cell: (row) => (
        <span className="flex min-w-0 flex-col">
          <span className="font-semibold">{featureLabel(row.feature)}</span>
          <span className="text-[13px] text-text-muted">{row.feature}</span>
        </span>
      ),
    },
    { id: "calls", header: t("features.col.calls"), align: "end", cell: (row) => count(row.calls) },
    {
      id: "tokens",
      header: t("features.col.tokens"),
      align: "end",
      hideBelow: "lg",
      cell: (row) => t("features.tokens", { input: count(row.inputTokens), output: count(row.outputTokens) }),
    },
    {
      id: "cost",
      header: t("features.col.cost"),
      align: "end",
      cell: (row) => (
        <span className="flex flex-col items-end">
          <span className="whitespace-nowrap font-semibold">{money(row.costUzs)}</span>
          <span className="text-[13px] text-text-muted">{usd(row.costUsd)}</span>
        </span>
      ),
    },
  ];
  if (rows.length === 0) {
    return <EmptyState icon={Cpu} title={t("features.empty")} />;
  }
  return (
    <DataTable
      rows={rows}
      columns={columns}
      getRowKey={(row, index) => `${row.feature}-${index}`}
      label={t("features.title")}
      cardsLabel={t("features.title")}
      renderCard={(row) => (
        <div className="flex flex-col gap-1 px-4 py-3 text-sm text-text">
          <span className="flex justify-between gap-2">
            <span className="min-w-0 font-semibold">{featureLabel(row.feature)}</span>
            <span className="whitespace-nowrap font-semibold">{money(row.costUzs)}</span>
          </span>
          <span className="text-[13px] text-text-muted">
            {t("features.cardMeta", { calls: count(row.calls), usd: usd(row.costUsd) })}
          </span>
        </div>
      )}
    />
  );
};

// ─── AI buyurtmalar ───────────────────────────────────────────────────────────

const AiOrdersCard = ({ query }: { query: ReturnType<typeof useAiOrders> }) => {
  const { t, i18n } = useTranslation("aiUsage");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const money = (value: number) => formatMoneyLocalized(value, { language });
  const orderRef = (item: AiOrderItem) => `№${item.orderNumber ?? item.orderId}`;
  const href = (item: AiOrderItem) => `/orders/edit/${encodeURIComponent(item.orderId)}`;
  const draftCost = (item: AiOrderItem) =>
    item.draftCostUzs == null
      ? "—"
      : item.draftOrders && item.draftOrders > 1
        ? t("orders.draftShared", { value: money(item.draftCostUzs), count: item.draftOrders })
        : money(item.draftCostUzs);

  const columns: DataTableColumn<AiOrderItem>[] = [
    {
      id: "order",
      header: t("orders.col.order"),
      cell: (row) => (
        <Link to={href(row)} className="font-semibold text-action-fg no-underline hover:underline">
          {orderRef(row)}
        </Link>
      ),
    },
    {
      id: "status",
      header: t("orders.col.status"),
      cell: (row) => (row.status ? <OrderStatusBadge status={row.status} /> : "—"),
    },
    {
      id: "total",
      header: t("orders.col.total"),
      align: "end",
      cell: (row) => (row.totalPrice == null ? "—" : money(row.totalPrice)),
    },
    { id: "model", header: t("orders.col.model"), hideBelow: "lg", cell: (row) => row.model ?? "—" },
    { id: "cost", header: t("orders.col.cost"), align: "end", cell: (row) => draftCost(row) },
    {
      id: "date",
      header: t("orders.col.date"),
      className: "whitespace-nowrap",
      cell: (row) => (row.createdAt ? formatDateTimeLocalized(row.createdAt, { language }) : "—"),
    },
  ];

  return (
    <Card
      padding="none"
      title={t("orders.title")}
      description={t("orders.subtitle")}
      actions={
        query.data ? <Badge>{t("orders.count", { value: formatNumberLocalized(query.data.total, { language }) })}</Badge> : null
      }
    >
      <QueryBoundary
        query={{
          data: query.data?.items ?? null,
          isLoading: query.isLoading,
          isError: query.isError,
          error: query.error,
          refetch: query.refetch,
        }}
        loadingLabel={t("orders.loading")}
        loading={
          <SkeletonTable
            framed={false}
            columns={[t("orders.col.order"), t("orders.col.status"), t("orders.col.total"), t("orders.col.cost")]}
            rows={4}
          />
        }
        empty={<EmptyState icon={Sparkles} title={t("orders.empty")} description={t("orders.emptyDescription")} />}
        error={(error, retry) => <ErrorState error={error} onRetry={retry} />}
      >
        {(items, { isRefetching }) => (
          <>
            {query.data?.degraded ? (
              <div className="px-5 pt-4 max-md:px-4">
                <ChartNote>{t("orders.degraded")}</ChartNote>
              </div>
            ) : null}
            <DataTable
              rows={items}
              columns={columns}
              getRowKey={(row) => row.orderId}
              label={t("orders.title")}
              cardsLabel={t("orders.title")}
              busy={isRefetching}
              renderCard={(row) => (
                <Link to={href(row)} className="flex flex-col gap-1.5 px-4 py-3 text-sm text-text no-underline">
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-action-fg">{orderRef(row)}</span>
                    {row.status ? <OrderStatusBadge status={row.status} /> : null}
                  </span>
                  <span className="flex justify-between gap-2 text-[13px] text-text-muted">
                    <span className="min-w-0">
                      {row.createdAt ? formatDateTimeLocalized(row.createdAt, { language }) : "—"}
                    </span>
                    <span className="whitespace-nowrap">{row.totalPrice == null ? "—" : money(row.totalPrice)}</span>
                  </span>
                  <span className="text-[13px] text-text-muted">{t("orders.cardCost", { value: draftCost(row) })}</span>
                </Link>
              )}
            />
          </>
        )}
      </QueryBoundary>
    </Card>
  );
};

export default memo(AiCostTab);
