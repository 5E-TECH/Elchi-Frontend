import type { TFunction } from "i18next";
import type Highcharts from "highcharts/highmaps";

/**
 * Viloyatlar xaritasining skrin-rider e'lonlari — Highcharts `lang.accessibility` (fYgDe3MW). Ular sukutda
 * inglizcha; xaritada chiqadiganlari `region:v2.map.a11y` dan (uz/ru/en). `{…}` — Highcharts o'rinbosarlari.
 */
export const buildMapA11yLang = (t: TFunction): Highcharts.LangAccessibilityOptions => ({
  defaultChartTitle: t("v2.map.title"),
  chartContainerLabel: t("v2.map.a11y.chartContainerLabel"),
  svgContainerLabel: t("v2.map.a11y.svgContainerLabel"),
  graphicContainerLabel: "",
  credits: "",
  screenReaderSection: {
    beforeRegionLabel: "",
    afterRegionLabel: "",
    endOfChartMarker: t("v2.map.a11y.endOfChartMarker"),
  },
  series: {
    summary: { map: t("v2.map.a11y.seriesSummary") },
    nullPointValue: t("v2.map.a11y.nullPointValue"),
  },
});
