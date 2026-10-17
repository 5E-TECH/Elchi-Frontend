// dizayn-v2: manager-branch-dashboard-main
import { ChevronRight, Clock, Store, Truck } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { share } from "../../../entities/dashboard/lib/period";
import { cx } from "../../../shared/lib/cx";
import {
  formatCompactMoneyLocalized,
  formatMoneyLocalized,
  formatNumberLocalized,
  formatPercentLocalized,
} from "../../../shared/lib/formatMoney";
import { ChartNote, HBarList, RankList, RingStat, SegBar, ViewToggle, type ChartView } from "../../../shared/ui/charts";
import { buttonClasses, Card, DataTable, EmptyState, SegmentedControl } from "../../../shared/ui/primitives";
import type { BranchCourierSummary, BranchMarketSummary, BranchPackageSummary } from "./branchDashboardAdapter";

/** «FAOL PAKETLAR»: yo'ldagi + qabul kutayotgan paketlar; havola faqat paketlar sahifasiga ruxsat bo'lsa. */
export const ActivePackagesCard = memo(({ packages, canOpenBatches }: { packages: BranchPackageSummary; canOpenBatches: boolean }) => {
  const { t, i18n } = useTranslation("branchDashboard");
  const language = i18n.language;
  const total = packages.onTheWay + packages.waiting;
  return (
    <Card divided={false} title={t("v2.packages.title")} description={t("v2.packages.sub")} bodyClassName="flex flex-col gap-4">
      <span className="whitespace-nowrap text-[28px] leading-9 font-bold tracking-[-.01em] text-text proportional-nums">
        {formatNumberLocalized(total, { language })}
        <span className="ml-1 text-sm font-semibold tracking-normal text-text-muted">{t("v2.packages.unit")}</span>
      </span>
      <SegBar
        ariaLabel={t("v2.packages.aria", {
          total: formatNumberLocalized(total, { language }),
          onTheWay: formatNumberLocalized(packages.onTheWay, { language }),
          waiting: formatNumberLocalized(packages.waiting, { language }),
        })}
        segments={[
          { key: "way", label: t("onTheWayPackages"), value: packages.onTheWay, tone: "warning", icon: Truck },
          { key: "waiting", label: t("waitingPackages"), value: packages.waiting, tone: "info", icon: Clock },
        ]}
      />
      {canOpenBatches ? (
        <Link to="/batches" className={cx(buttonClasses({ variant: "secondary", size: "sm" }), "self-start max-md:self-stretch")}>
          {t("packagePlaceholder")}
          <ChevronRight size={16} aria-hidden="true" />
        </Link>
      ) : null}
    </Card>
  );
});
ActivePackagesCard.displayName = "ActivePackagesCard";

/** «KURYERLAR»: bugun faol bo'lganlar ulushi (halqa) + filial kuryerlari va faol emaslar. */
export const CouriersCard = memo(({ couriers }: { couriers: BranchCourierSummary }) => {
  const { t, i18n } = useTranslation("branchDashboard");
  const language = i18n.language;
  const count = (value: number) => formatNumberLocalized(value, { language });
  const inactive = Math.max(0, couriers.total - couriers.active);
  return (
    <Card divided={false} title={t("v2.couriers.title")} description={t("v2.couriers.sub")} bodyClassName="flex flex-col gap-4">
      <RingStat
        size="lg"
        value={share(couriers.active, couriers.total)}
        label={t("activeCouriers")}
        valueText={t("v2.couriers.activeOf", { active: count(couriers.active), total: count(couriers.total) })}
      />
      <dl className="m-0 grid grid-cols-2 gap-3 border-t border-border pt-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-xs text-text-muted">{t("v2.couriers.total")}</dt>
          <dd className="m-0 text-sm font-semibold text-text">{t("v2.count", { value: count(couriers.total) })}</dd>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-xs text-text-muted">{t("v2.couriers.inactive")}</dt>
          <dd className="m-0 text-sm font-semibold text-text">{t("v2.count", { value: count(inactive) })}</dd>
        </div>
      </dl>
    </Card>
  );
});
CouriersCard.displayName = "CouriersCard";

type MarketMetric = "orders" | "amount";

/**
 * «MARKETLAR BO'YICHA»: «Buyurtmalar | Summa» + «Grafik | Jadval»; xulosa (jami summa, eng ko'p buyurtma,
 * eng katta summa), gorizontal ustunlar (telefonda reyting ro'yxati).
 */
export const MarketsBreakdownCard = memo(({ markets, className }: { markets: BranchMarketSummary[]; className?: string }) => {
  const { t, i18n } = useTranslation("branchDashboard");
  const language = i18n.language;
  const [metric, setMetric] = useState<MarketMetric>("orders");
  const [view, setView] = useState<ChartView>("chart");
  const count = (value: number) => formatNumberLocalized(value, { language });
  const money = (value: number) => formatCompactMoneyLocalized(value, { language });

  const sorted = useMemo(
    () => [...markets].sort((a, b) => (metric === "orders" ? b.orders - a.orders || b.amount - a.amount : b.amount - a.amount || b.orders - a.orders)),
    [markets, metric],
  );
  const totalAmount = markets.reduce((sum, market) => sum + market.amount, 0);
  const totalOrders = markets.reduce((sum, market) => sum + market.orders, 0);
  const topOrders = [...markets].sort((a, b) => b.orders - a.orders)[0];
  const topAmount = [...markets].sort((a, b) => b.amount - a.amount)[0];

  const ordersText = (market: BranchMarketSummary) => t("v2.count", { value: count(market.orders) });

  return (
    <Card
      divided={false}
      className={className}
      title={t("markets")}
      description={t("v2.markets.sub")}
      actions={
        <div className="flex flex-wrap items-center gap-2 max-md:w-full">
          <SegmentedControl<MarketMetric>
            ariaLabel={t("v2.markets.metricLabel")}
            value={metric}
            onValueChange={setMetric}
            options={[
              { value: "orders", label: t("v2.markets.byOrders") },
              { value: "amount", label: t("v2.markets.byAmount") },
            ]}
          />
          <ViewToggle value={view} onChange={setView} ariaLabel={t("v2.markets.viewLabel")} />
        </div>
      }
      bodyClassName="flex flex-col gap-4"
    >
      {markets.length === 0 ? (
        <EmptyState size="chart" icon={Store} title={t("emptyMarkets")} />
      ) : (
        <>
          <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(min(180px,100%),1fr))] gap-x-4 gap-y-3 rounded-xl bg-sunken px-4 py-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-xs text-text-muted">{t("v2.markets.totalAmount")}</dt>
              <dd className="m-0 text-sm font-semibold text-text">{money(totalAmount)}</dd>
              <dd className="m-0 text-xs text-text-muted max-md:hidden">
                {t("v2.markets.totalMeta", { markets: count(markets.length), orders: count(totalOrders) })}
              </dd>
            </div>
            {topOrders ? (
              <div className="flex min-w-0 flex-col gap-0.5">
                <dt className="text-xs text-text-muted">{t("v2.markets.topOrders")}</dt>
                <dd className="m-0 truncate text-sm font-semibold text-text">{topOrders.name}</dd>
                <dd className="m-0 text-xs text-text-muted">
                  {t("v2.markets.topOrdersMeta", {
                    count: count(topOrders.orders),
                    share: formatPercentLocalized(share(topOrders.orders, totalOrders), { language, fractionDigits: 0 }),
                  })}
                </dd>
              </div>
            ) : null}
            {topAmount ? (
              <div className="flex min-w-0 flex-col gap-0.5">
                <dt className="text-xs text-text-muted">{t("v2.markets.topAmount")}</dt>
                <dd className="m-0 truncate text-sm font-semibold text-text">{topAmount.name}</dd>
                <dd className="m-0 text-xs text-text-muted">
                  {t("v2.markets.topAmountMeta", {
                    amount: money(topAmount.amount),
                    average: formatMoneyLocalized(topAmount.orders > 0 ? topAmount.amount / topAmount.orders : 0, { language }),
                  })}
                </dd>
              </div>
            ) : null}
          </dl>

          {view === "chart" ? (
            <>
              <div className="max-md:hidden">
                <HBarList
                  ariaLabel={t("markets")}
                  rows={sorted.map((market) => ({
                    id: market.id,
                    label: market.name,
                    value: metric === "orders" ? market.orders : market.amount,
                    display: metric === "orders" ? ordersText(market) : money(market.amount),
                    sub: metric === "orders" ? money(market.amount) : ordersText(market),
                    tone: "action",
                  }))}
                />
              </div>
              <div className="hidden max-md:block">
                <RankList
                  ariaLabel={t("markets")}
                  limit={sorted.length}
                  items={sorted.map((market) => ({
                    id: market.id,
                    name: market.name,
                    value: metric === "orders" ? ordersText(market) : money(market.amount),
                    sub: metric === "orders" ? money(market.amount) : ordersText(market),
                  }))}
                />
              </div>
              <ChartNote>{metric === "orders" ? t("v2.markets.noteOrders") : t("v2.markets.noteAmount")}</ChartNote>
            </>
          ) : (
            <DataTable
              rows={sorted}
              getRowKey={(row, index) => `${row.id}-${index}`}
              label={t("markets")}
              density="compact"
              columns={[
                { id: "name", header: t("v2.markets.colMarket"), cell: (row) => row.name },
                { id: "orders", header: t("v2.markets.byOrders"), align: "end", cell: (row) => count(row.orders) },
                { id: "amount", header: t("v2.markets.byAmount"), align: "end", cell: (row) => formatMoneyLocalized(row.amount, { language }) },
              ]}
            />
          )}
        </>
      )}
    </Card>
  );
});
MarketsBreakdownCard.displayName = "MarketsBreakdownCard";
