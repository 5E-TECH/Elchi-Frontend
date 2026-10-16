// dizayn-v2: superadmin-neworders-incoming-sources, admin-neworders-incoming-sources, manager-new-orders-incoming-sources
import type { TFunction } from "i18next";
import type { Waiting } from "../lib";

/**
 * Manba ranglari — grafik palitrasi tartibida (`--chart-1…6`, aylantirilmaydi), «Boshqa» — `chart-muted`.
 * Klass nomlari to'liq yozilgan: Tailwind ularni shu satrlardan topadi.
 */
const CHART_BG = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5", "bg-chart-6"] as const;
const CHART_STROKE = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
] as const;

export const chartBg = (colorIndex: number | null) =>
  colorIndex === null ? "bg-chart-muted" : CHART_BG[colorIndex % CHART_BG.length];

export const chartStroke = (colorIndex: number | null) =>
  colorIndex === null ? "var(--color-chart-muted)" : CHART_STROKE[colorIndex % CHART_STROKE.length];

/** Kutish matni: «3 soat», «4 kun», «bugun», «hozir»; sana yo'q — «—». */
export const waitingText = (t: TFunction, waiting: Waiting): string => {
  switch (waiting.unit) {
    case "now":
      return t("incoming.waitNow");
    case "today":
      return t("incoming.waitToday");
    case "hours":
      return t("incoming.waitHours", { count: waiting.count });
    case "days":
      return t("incoming.waitDays", { count: waiting.count });
    default:
      return "—";
  }
};
