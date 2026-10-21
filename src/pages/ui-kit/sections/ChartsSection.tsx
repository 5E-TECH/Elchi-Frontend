import { useTranslation } from "react-i18next";
import { ChartLegend, StackedBars, type StackedBarsColumn } from "../../../shared/ui/charts";
import { Card } from "../../../shared/ui/primitives/Card";
import { KitSection } from "../KitSection";
import { ThemePair } from "../ThemePair";

/** Maketdagi namunaviy qiymatlar (`investor-dashboard-home`): mart – oktabr 2026, mln so'm. */
const PAID = [3_600_000, 4_400_000, 5_000_000, 5_300_000, 4_900_000, 5_600_000, 0, 0];
const UNPAID = [0, 0, 0, 0, 0, 0, 6_200_000, 0];

const asList = (value: unknown): string[] => (Array.isArray(value) ? value.map(String) : []);

/**
 * «Grafiklar» bo'limi (`?section=charts`) — IN-1 da qo'shilgan `StackedBars` primitivi kunduzgi va tungi
 * mavzuda. Qolgan grafik bo'laklari (`Gauge`, `Donut`, `HBarList` …) o'z sahifalarida (dashboard) ko'rinadi.
 */
export const ChartsSection = () => {
  const { t } = useTranslation("ui");
  const months = asList(t("chartsKit.months", { returnObjects: true }));
  const titles = asList(t("chartsKit.monthTitles", { returnObjects: true }));
  const series = [
    { key: "paid", label: t("chartsKit.paid"), tone: "success" as const },
    { key: "unpaid", label: t("chartsKit.unpaid"), tone: "warning" as const },
  ];
  const columns: StackedBarsColumn[] = PAID.map((paid, index) => ({
    key: `m${index}`,
    label: months[index] ?? "",
    title: titles[index],
    values: { paid, unpaid: UNPAID[index] },
    current: index === PAID.length - 1,
  }));

  return (
    <KitSection id="charts" title={t("chartsKit.title")} description={t("chartsKit.description")}>
      <ThemePair layout="stack">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h3 className="text-sm font-semibold text-text">{t("chartsKit.stackedTitle")}</h3>
            <p className="text-xs text-text-muted">{t("chartsKit.stackedMeta")}</p>
          </div>
          <Card divided={false} bodyClassName="flex flex-col gap-4">
            <StackedBars series={series} columns={columns} ariaLabel={t("chartsKit.ariaLabel")} />
            <div className="border-t border-border pt-4">
              <ChartLegend items={series.map((item) => ({ key: item.key, label: item.label, tone: item.tone }))} />
            </div>
          </Card>
        </div>
      </ThemePair>
    </KitSection>
  );
};
