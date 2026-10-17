// dizayn-v2: superadmin-regions-map, admin-regions-map
import { memo, useEffect, useMemo, useState } from "react";
import Highcharts from "highcharts/highmaps";
import HighchartsReact from "highcharts-react-official";
import uzTopology from "@highcharts/map-collection/countries/uz/uz-all.topo.json";
import { mapStepOf, STEP_VAR, type RegionMetric, type RegionRow } from "../model/regionsModel";

export interface UzbekistanRegionMapProps {
  rows: RegionRow[];
  metric: RegionMetric;
  maxRevenue: number;
  /** Viloyat yorlig'i ostidagi qiymat (`row.id` → «112», «81,3%», «18,5 mln»). */
  valueLabels: ReadonlyMap<string, string>;
  /** Tooltip HTML'i (matnlar chaqiruvchida, foydalanuvchi matni `escapeHtml` bilan). */
  tooltipHtml: (row: RegionRow) => string;
  onSelect: (row: RegionRow) => void;
  /** Xaritaning matnli tavsifi (ekran o'quvchi; bosish — yonidagi reyting orqali ham). */
  ariaLabel: string;
}

type MapPointOptions = Highcharts.SeriesMapDataOptions & { rowId: string };

/**
 * Sharqdagi kichik viloyatlar yorliqlari bir-birini yopmasin — maketdagidek chetga suriladi (px, xarita
 * kengligi ≥ 560 da; telefonda yorliq yo'q).
 */
const LABEL_OFFSET: Record<string, { x: number; y: number }> = {
  "uz-tk": { x: -52, y: -12 },
  "uz-ta": { x: 22, y: -52 },
  "uz-ng": { x: 4, y: -28 },
  "uz-an": { x: 30, y: 6 },
  "uz-fa": { x: -6, y: 24 },
  "uz-si": { x: -10, y: 28 },
};

const readCssColor = (name: string) =>
  typeof window === "undefined"
    ? ""
    : getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Mavzu almashsa (`html.dark`) xarita ranglari qayta o'qiladi. */
const useThemeKey = () => {
  const [key, setKey] = useState(() =>
    typeof document === "undefined"
      ? "light"
      : document.documentElement.classList.contains("dark")
        ? "dark"
        : "light",
  );
  useEffect(() => {
    const read = () =>
      setKey(document.documentElement.classList.contains("dark") ? "dark" : "light");
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return key;
};

/**
 * Highcharts sozlamalari (komponentdan tashqarida — formatterlarda `this` = nuqta). Ranglar har chaqiruvda
 * CSS o'zgaruvchilaridan o'qiladi; `theme` — mavzu almashganda qayta qurish uchun (`chart.className`).
 */
const buildMapOptions = (
  {
    rows,
    metric,
    maxRevenue,
    valueLabels,
    tooltipHtml,
    onSelect,
  }: Pick<
    UzbekistanRegionMapProps,
    "rows" | "metric" | "maxRevenue" | "valueLabels" | "tooltipHtml" | "onSelect"
  >,
  theme: string,
): Highcharts.Options => {
  const color = (name: string) => readCssColor(name);
  const label = color("--color-region-map-label");
  const onDark = color("--color-surface");
  const rowsById = new Map(rows.map((row) => [row.id, row]));
  const data: MapPointOptions[] = rows
    .filter((row) => row.hcKey)
    .map((row) => {
      const step = mapStepOf(row, metric, maxRevenue);
      return {
        "hc-key": row.hcKey as string,
        rowId: row.id,
        value: row.orders,
        name: row.short,
        color: color(STEP_VAR[step]),
        // Eng to'q pog'onada yorliq yuza rangida (kontrast), qolganida `region-map-label`.
        dataLabels: {
          ...LABEL_OFFSET[row.hcKey as string],
          // Surilgan yorliq viloyat tashqarisida turadi — matn rangi doim `region-map-label`.
          style: { color: step === 4 && !LABEL_OFFSET[row.hcKey as string] ? onDark : label },
        },
      };
    });

  return {
    chart: {
      map: uzTopology as unknown as Highcharts.GeoJSON,
      className: `region-map-${theme}`,
      backgroundColor: "transparent",
      height: "62%",
      spacing: [8, 0, 8, 0],
      animation: false,
      style: { fontFamily: "inherit" },
    },
    title: { text: undefined },
    credits: { enabled: false },
    legend: { enabled: false },
    mapNavigation: { enabled: false },
    tooltip: {
      useHTML: true,
      backgroundColor: "transparent",
      borderWidth: 0,
      shadow: false,
      padding: 0,
      hideDelay: 80,
      formatter: function (this: Highcharts.Point) {
        const id = (this as unknown as { rowId?: string }).rowId;
        const row = id ? rowsById.get(id) : undefined;
        return row ? tooltipHtml(row) : false;
      },
    },
    plotOptions: { series: { animation: false } },
    series: [
      {
        type: "map",
        data,
        joinBy: "hc-key",
        nullColor: color("--color-sunken"),
        borderColor: color("--color-region-map-stroke"),
        borderWidth: 1,
        cursor: "pointer",
        dataLabels: {
          enabled: true,
          allowOverlap: true,
          crop: false,
          padding: 0,
          useHTML: false,
          formatter: function (this: Highcharts.Point) {
            const id = (this as unknown as { rowId?: string }).rowId;
            if (!id) return "";
            const value = valueLabels.get(id);
            return value ? `${this.name}<br/>${value}` : String(this.name ?? "");
          },
          style: { fontSize: "12px", fontWeight: "600", textOutline: "none", textAlign: "center" },
        },
        states: {
          hover: { brightness: 0, borderColor: color("--color-action"), borderWidth: 2 },
          inactive: { enabled: false },
        },
        point: {
          events: {
            click: function (this: Highcharts.Point) {
              const id = (this as unknown as { rowId?: string }).rowId;
              const row = id ? rowsById.get(id) : undefined;
              if (row) onSelect(row);
            },
          },
        },
      },
    ],
    responsive: {
      // Telefonda (maket) xaritada yorliq yo'q — qiymatlar ostidagi reytingda.
      rules: [
        {
          condition: { maxWidth: 560 },
          chartOptions: { series: [{ type: "map", dataLabels: { enabled: false } }] },
        },
      ],
    },
  };
};

/**
 * O'ZBEKISTON VILOYATLARI XARITASI (Highcharts highmaps — og'ir, faqat `lazy` bilan yuklanadi; §9 savol 11
 * sukuti). Ranglar faqat `--color-region-map-*` tokenlaridan (`getComputedStyle`), buyurtmasiz viloyat —
 * `sunken`. Yorliqlar: qisqa nom + qiymat (telefonda yashirin). Viloyat bosilsa `onSelect`
 * (`RegionDetailDialog`). Bu faylda faqat xarita: KPI, legenda, reyting — `RegionsMapCard`.
 */
const UzbekistanRegionMap = ({
  rows,
  metric,
  maxRevenue,
  valueLabels,
  tooltipHtml,
  onSelect,
  ariaLabel,
}: UzbekistanRegionMapProps) => {
  const theme = useThemeKey();
  // `tooltipHtml` / `onSelect` chaqiruvchida barqaror (`useCallback`) — `options` faqat ma'lumot, mavzu
  // yoki matn o'zgarganda qayta quriladi.
  const options = useMemo(
    () => buildMapOptions({ rows, metric, maxRevenue, valueLabels, tooltipHtml, onSelect }, theme),
    [rows, metric, maxRevenue, valueLabels, tooltipHtml, onSelect, theme],
  );

  return (
    <div role="img" aria-label={ariaLabel} className="min-w-0">
      <HighchartsReact highcharts={Highcharts} constructorType="mapChart" options={options} />
    </div>
  );
};

export default memo(UzbekistanRegionMap);
