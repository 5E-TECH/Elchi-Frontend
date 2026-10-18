// dizayn-v2: registrator-dispatch-list, registrator-dispatch-empty, manager-dispatch-scan
import { Building2, ListChecks, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { StatCard } from "../../../shared/ui/primitives";
import type { DispatchStats as DispatchStatsValue } from "../model/dispatchModel";

/**
 * Ro'yxat ko'rsatkichlari: «Tanlangan» · «Uygacha» · «Markazgacha».
 *  - ≥ 768 — uchta `StatCard` (`.el-stat`), izohda jami summa;
 *  - telefonda — bitta karta, uch ustun (qiymat + kichik summa), maket `registrator-dispatch-list` (phone).
 */
export const DispatchStats = ({ stats }: { stats: DispatchStatsValue }) => {
  const { t, i18n } = useTranslation("dispatch");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const num = (value: number) => formatNumberLocalized(value, { language });
  const money = (value: number) => formatMoneyLocalized(value, { language });

  const items = [
    {
      key: "selected",
      label: t("stats.selected"),
      value: num(stats.selected),
      unit: t("stats.ofTotal", { count: stats.total, total: num(stats.total) }),
      unitShort: t("stats.ofTotalShort", { total: num(stats.total) }),
      amount: stats.selectedAmount,
      icon: ListChecks,
    },
    {
      key: "home",
      label: t("stats.home"),
      value: num(stats.home),
      unit: t("stats.unit"),
      unitShort: t("stats.unit"),
      amount: stats.homeAmount,
      icon: MapPin,
    },
    {
      key: "center",
      label: t("stats.center"),
      value: num(stats.center),
      unit: t("stats.unit"),
      unitShort: t("stats.unit"),
      amount: stats.centerAmount,
      icon: Building2,
    },
  ];

  return (
    <>
      <div role="group" aria-label={t("stats.label")} className="grid grid-cols-3 gap-4 max-md:hidden">
        {items.map((item) => (
          <StatCard
            key={item.key}
            label={item.label}
            value={item.value}
            unit={item.unit}
            icon={item.icon}
            hint={t("stats.sum", { amount: money(item.amount) })}
          />
        ))}
      </div>

      <div
        role="group"
        aria-label={t("stats.label")}
        className="hidden min-w-0 grid-cols-3 overflow-hidden rounded-[14px] border border-border bg-surface max-md:grid"
      >
        {items.map((item, index) => (
          <div key={item.key} className={index > 0 ? "flex min-w-0 flex-col gap-0.5 border-l border-border p-3" : "flex min-w-0 flex-col gap-0.5 p-3"}>
            <span className="truncate text-xs font-semibold text-text-muted">{item.label}</span>
            <span className="whitespace-nowrap text-[22px] leading-[30px] font-bold text-text">
              {item.value}
              <span className="ml-1 text-[13px] font-semibold text-text-muted">{item.unitShort}</span>
            </span>
            <span className="truncate text-xs text-text-muted">{money(item.amount)}</span>
          </div>
        ))}
      </div>
    </>
  );
};
