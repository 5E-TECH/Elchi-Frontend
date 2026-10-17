// dizayn-v2: superadmin-dashboard-main, admin-dashboard-main, registrator-dashboard-main
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import {
  formatCompactMoneyLocalized,
  formatNumberLocalized,
  formatPercentLocalized,
} from "../../../shared/lib/formatMoney";
import { regionStep, STEP_CLASS, type RegionMetric, type RegionRow } from "../lib/regionModel";
import { REGION_TILE_COLUMNS, REGION_TILES } from "../lib/regionTileLayout";

export interface RegionTilesProps {
  rows: readonly RegionRow[];
  metric: RegionMetric;
  ariaLabel: string;
  /** Daromad ko'rsatilsinmi (registratorda yo'q). */
  showRevenue: boolean;
  /** Katak bosilganda (berilmasa kataklar bosilmaydi). */
  onSelect?: (row: RegionRow) => void;
}

/**
 * HUDUDLAR KARTOGRAMMASI (`.el-tilemap`, `.el-tile`): 14 katak, 7 ustun, rang — `region-map-*` ketma-ket
 * shkala, katakda son. Telefonda qisqa nomlar («TSh»). Hover/fokusda maslahat (desktop): nom, buyurtma,
 * sotuv foizi va daromad. Highcharts yo'q — oddiy CSS grid.
 */
const RegionTiles = ({ rows, metric, ariaLabel, showRevenue, onSelect }: RegionTilesProps) => {
  const { t, i18n } = useTranslation("dashboard");
  const language = i18n.language;
  const byKey = new Map(rows.filter((row) => row.tile).map((row) => [row.tile!.key, row]));
  const maxRevenue = Math.max(0, ...rows.map((row) => row.revenue));

  const valueText = (row: RegionRow | undefined) => {
    if (!row) return "0";
    if (metric === "success") return formatPercentLocalized(row.rate, { language, fractionDigits: 0 });
    if (metric === "revenue") return formatCompactMoneyLocalized(row.revenue, { language, withCurrency: false });
    return formatNumberLocalized(row.orders, { language });
  };

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${REGION_TILE_COLUMNS}, minmax(0, 1fr))` }}
    >
      {REGION_TILES.map((tile) => {
        const row = byKey.get(tile.key);
        const step = row ? regionStep(row, metric, maxRevenue) : 0;
        const orders = formatNumberLocalized(row?.orders ?? 0, { language });
        const label = t("v2Dashboard.region.tileAria", { name: tile.label, count: orders });
        const tipRight = tile.col >= 5;
        const content = (
          <>
            <span className="hyphens-manual break-words text-xs font-semibold leading-[14px] max-md:hidden">{tile.tileLabel ?? tile.label}</span>
            <span className="hidden text-xs font-semibold leading-[14px] max-md:inline">{tile.short}</span>
            <span className="text-sm font-bold proportional-nums">{valueText(row)}</span>
            {row ? (
              <span
                aria-hidden="true"
                className={cx(
                  "pointer-events-none absolute top-full z-10 mt-1.5 hidden w-max max-w-[240px] flex-col gap-1 rounded-xl border border-border bg-raised px-3 py-2.5 text-left shadow-xl group-hover:flex group-focus-visible:flex max-md:group-hover:hidden max-md:group-focus-visible:hidden",
                  tipRight ? "right-0" : "left-0",
                )}
              >
                <span className="whitespace-nowrap text-xs font-semibold text-text-muted">{tile.label}</span>
                <span className="whitespace-nowrap text-[13px] text-text">
                  <span className="font-bold">{t("v2Charts.countTa", { value: orders })}</span>{" "}
                  <span className="text-text-muted">{t("v2Dashboard.region.ordersWord")}</span>
                </span>
                <span className="whitespace-nowrap text-[13px] text-text">
                  <span className="font-bold">{formatPercentLocalized(row.rate, { language })}</span>{" "}
                  <span className="text-text-muted">
                    {showRevenue
                      ? t("v2Dashboard.region.soldWithRevenue", {
                          revenue: formatCompactMoneyLocalized(row.revenue, { language }),
                        })
                      : t("v2Dashboard.region.soldWord")}
                  </span>
                </span>
              </span>
            ) : null}
          </>
        );
        const className = cx(
          "group relative flex min-h-[72px] min-w-0 flex-col justify-between gap-0.5 rounded-lg px-2 py-1.5 text-left max-md:min-h-12",
          STEP_CLASS[step],
        );
        const style = { gridRow: tile.row, gridColumn: tile.span ? `${tile.col} / span ${tile.span}` : tile.col };
        return onSelect && row ? (
          <button
            key={tile.key}
            type="button"
            aria-label={label}
            data-region-tile={tile.key}
            className={cx(className, "cursor-pointer transition-[box-shadow] duration-150 hover:ring-2 hover:ring-text hover:ring-inset motion-reduce:transition-none")}
            style={style}
            onClick={() => onSelect(row)}
          >
            {content}
          </button>
        ) : (
          <div key={tile.key} role="img" aria-label={label} data-region-tile={tile.key} className={className} style={style}>
            {content}
          </div>
        );
      })}
    </div>
  );
};

export default memo(RegionTiles);
