// dizayn-v2: market-dashboard-home
import { BarChart3 } from "lucide-react";
import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatNumberLocalized, formatPercentLocalized } from "../../../shared/lib/formatMoney";
import { ChartLegend, HBarList, ViewToggle, type ChartTone, type ChartView } from "../../../shared/ui/charts";
import { Card, DataTable, EmptyState } from "../../../shared/ui/primitives";
import type { PerformerRow } from "../../../widgets/dashboard-top-performers/lib/rankItems";

export interface MarketSalesCardProps {
  rows: PerformerRow[];
  selfId?: string | number | null;
}

/** Sotuv foizi toni (maket legendasi): ≥ 70 — yaxshi, 50–69 — o'rtacha, < 50 — past. */
const salesTone = (rate: number): ChartTone => (rate >= 70 ? "success" : rate >= 50 ? "warning" : "danger");

/**
 * «MARKETLAR BO'YICHA SOTUV FOIZI» (market): gorizontal ustunlar, rang — sotuv foizi zonasi (so'z bilan
 * legenda), o'z qatori «Siz». Top 10 (telefonda 5) + «Yana ko'rsatish». «Grafik | Jadval» egizagi.
 */
const MarketSalesCard = ({ rows, selfId }: MarketSalesCardProps) => {
  const { t, i18n } = useTranslation("dashboard");
  const language = i18n.language;
  const [view, setView] = useState<ChartView>("chart");
  const self = selfId == null ? null : String(selfId);
  const partOfTotal = (row: PerformerRow) =>
    t("v2Dashboard.partOfTotal", {
      part: formatNumberLocalized(row.successful, { language }),
      total: formatNumberLocalized(row.total, { language }),
    });

  return (
    <Card
      divided={false}
      // Telefonda «Grafik | Jadval» to'liq en (tugmalar kesilmasin).
      className="max-md:[&>div:first-child>div:last-child]:w-full"
      title={t("v2Market.sales.title")}
      description={t("v2Market.sales.sub", { count: rows.length })}
      actions={
        <div className="max-md:w-full">
          <ViewToggle value={view} onChange={setView} ariaLabel={t("v2Market.sales.viewLabel")} />
        </div>
      }
      bodyClassName="flex flex-col gap-4"
    >
      {rows.length === 0 ? (
        <EmptyState size="chart" icon={BarChart3} title={t("v2Dashboard.top.emptyTitle")} description={t("v2Dashboard.top.emptyHint")} />
      ) : view === "chart" ? (
        <HBarList
          ariaLabel={t("v2Market.sales.title")}
          max={100}
          limit={10}
          mobileLimit={5}
          expandable
          rows={rows.map((row) => ({
            id: row.id,
            label: row.name,
            value: row.rate,
            display: formatPercentLocalized(row.rate, { language }),
            sub: partOfTotal(row),
            tone: salesTone(row.rate),
            badge: self != null && row.id === self ? t("v2Dashboard.top.you") : undefined,
          }))}
        />
      ) : (
        <DataTable
          rows={rows}
          getRowKey={(row, index) => `${row.id}-${index}`}
          label={t("v2Market.sales.title")}
          density="compact"
          columns={[
            {
              id: "name",
              header: t("v2Market.sales.colMarket"),
              cell: (row) => (self != null && row.id === self ? `${row.name} (${t("v2Dashboard.top.you")})` : row.name),
            },
            { id: "rate", header: t("v2Market.sales.colRate"), align: "end", cell: (row) => formatPercentLocalized(row.rate, { language }) },
            { id: "part", header: t("v2Market.sales.colPart"), align: "end", cell: (row) => partOfTotal(row) },
          ]}
        />
      )}
      <div className="border-t border-border pt-4">
        <ChartLegend
          items={[
            { key: "good", tone: "success", label: t("v2Market.sales.good") },
            { key: "mid", tone: "warning", label: t("v2Market.sales.mid") },
            { key: "low", tone: "danger", label: t("v2Market.sales.low") },
          ]}
        />
      </div>
    </Card>
  );
};

export default memo(MarketSalesCard);
