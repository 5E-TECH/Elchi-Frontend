// dizayn-v2: superadmin-users-list, admin-users-list
import { memo, type ReactNode } from "react";
import { Store, UserCheck, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import { formatNumberLocalized, formatPercentLocalized } from "../../../shared/lib/formatMoney";
import { Card, Skeleton, StatCard } from "../../../shared/ui/primitives";

export interface UserListKpiProps {
  totalUsers?: number;
  totalMarkets?: number;
  totalEmployees?: number;
  loading?: boolean;
}

/** Kategorial ranglar (maket: marketlar `chart-1`, xodimlar `chart-2`). */
const MARKET_FILL = "bg-chart-1";
const EMPLOYEE_FILL = "bg-chart-2";

/** `.el-legend-key`: 10 px kvadrat. */
const LegendKey = ({ className }: { className: string }) => (
  <span aria-hidden="true" className={cx("inline-block size-2.5 shrink-0 rounded-[3px]", className)} />
);

/** `.el-segbar` (10 px): marketlar va xodimlar ulushi. */
const SegBar = ({ markets, employees, label }: { markets: number; employees: number; label: string }) => {
  const total = markets + employees;
  return (
    <div role="img" aria-label={label} className="flex h-2.5 min-w-0 gap-0.5">
      {total > 0 ? (
        <>
          {markets > 0 ? (
            <span className={cx("block min-w-1 rounded-l-[4px] last:rounded-r-[4px]", MARKET_FILL)} style={{ flex: `${markets} 1 0` }} />
          ) : null}
          {employees > 0 ? (
            <span className={cx("block min-w-1 rounded-r-[4px] first:rounded-l-[4px]", EMPLOYEE_FILL)} style={{ flex: `${employees} 1 0` }} />
          ) : null}
        </>
      ) : (
        <span className="block flex-1 rounded-[4px] bg-sunken" />
      )}
    </div>
  );
};

/** `.el-meter.is-thin` — ulush chizig'i (`role="meter"`). */
const ShareMeter = ({ value, label, fill, track }: { value: number; label: string; fill: string; track: string }) => (
  <div
    role="meter"
    aria-label={label}
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={Math.round(value * 10) / 10}
    className={cx("h-1.5 w-full rounded-full", track)}
  >
    <span className={cx("block h-full rounded-full", fill)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
  </div>
);

/**
 * FOYDALANUVCHILAR SONI — `/all-users` KPI qatori (superadmin/admin; menejerda yo'q).
 *
 * Maket `superadmin-users-list`: «Barcha foydalanuvchilar» (son + marketlar/xodimlar segment chizig'i va
 * legenda), «Marketlar» va «Xodimlar» (son, «Jamining N%», ulush chizig'i); telefonda — bitta karta, 3 ustun +
 * segment chizig'i. Manba: `GET /users` meta — `totalUsers`, `totalMarket`, `totalEmployees`
 * (backend invarianti: marketlar + xodimlar = jami). «shundan N ta mijoz» va «Mijozlar» bo'lagi
 * CHIZILMAYDI — mijozlar `GET /users` dan chiqarilgan (spec §6).
 */
export const UserListKpi = memo(({ totalUsers, totalMarkets, totalEmployees, loading = false }: UserListKpiProps) => {
  const { t, i18n } = useTranslation("users");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const count = (value: number | undefined) => (value === undefined ? "—" : formatNumberLocalized(value, { language }));
  const markets = totalMarkets ?? 0;
  const employees = totalEmployees ?? 0;
  const total = totalUsers ?? markets + employees;
  const share = (value: number) => (total > 0 ? (value / total) * 100 : 0);
  const percent = (value: number) => formatPercentLocalized(share(value), { language });
  const ready = !loading && totalUsers !== undefined;

  const composition = t("v2.list.kpiComposition", { markets: count(markets), employees: count(employees) });
  const legend = (
    <ul className="m-0 flex list-none flex-wrap items-center gap-x-5 gap-y-2 p-0 text-[13px] text-text-muted">
      <li className="inline-flex items-center gap-2 whitespace-nowrap">
        <LegendKey className={MARKET_FILL} />
        {t("v2.list.kpiSegment", { label: t("v2.list.kpiMarkets"), value: percent(markets) })}
      </li>
      <li className="inline-flex items-center gap-2 whitespace-nowrap">
        <LegendKey className={EMPLOYEE_FILL} />
        {t("v2.list.kpiSegment", { label: t("v2.list.kpiEmployees"), value: percent(employees) })}
      </li>
    </ul>
  );
  const keyedLabel = (fill: string, label: string): ReactNode => (
    <span className="inline-flex items-center gap-2">
      <LegendKey className={fill} />
      {label}
    </span>
  );
  const unit = t("v2.common.unitTa");

  return (
    <>
      <section
        aria-label={t("v2.list.kpiLabel")}
        className="grid grid-cols-[minmax(0,1.6fr)_repeat(2,minmax(0,1fr))] gap-4 max-lg:grid-cols-2 max-md:hidden"
      >
        <StatCard
          label={t("v2.list.kpiAll")}
          icon={Users}
          value={count(totalUsers)}
          unit={unit}
          loading={!ready}
          className="max-lg:col-span-2"
        >
          <div className="mt-auto flex flex-col gap-2.5 pt-2">
            <SegBar markets={markets} employees={employees} label={composition} />
            {legend}
          </div>
        </StatCard>
        <StatCard
          label={keyedLabel(MARKET_FILL, t("v2.list.kpiMarkets"))}
          icon={Store}
          value={count(totalMarkets)}
          unit={unit}
          hint={ready ? t("v2.list.kpiShare", { value: percent(markets) }) : undefined}
          loading={!ready}
        >
          <div className="mt-auto pt-2">
            <ShareMeter
              value={share(markets)}
              label={t("v2.list.kpiShareAria", { label: t("v2.list.kpiMarkets"), value: percent(markets) })}
              fill={MARKET_FILL}
              track="bg-action-soft"
            />
          </div>
        </StatCard>
        <StatCard
          label={keyedLabel(EMPLOYEE_FILL, t("v2.list.kpiEmployees"))}
          icon={UserCheck}
          value={count(totalEmployees)}
          unit={unit}
          hint={ready ? t("v2.list.kpiShare", { value: percent(employees) }) : undefined}
          loading={!ready}
        >
          <div className="mt-auto pt-2">
            <ShareMeter
              value={share(employees)}
              label={t("v2.list.kpiShareAria", { label: t("v2.list.kpiEmployees"), value: percent(employees) })}
              fill={EMPLOYEE_FILL}
              track="bg-sunken"
            />
          </div>
        </StatCard>
      </section>

      {/* Telefon: bitta karta — uch ustun + segment chizig'i (maket `.el-show-mobile`). */}
      <Card as="section" padding="none" aria-label={t("v2.list.kpiLabel")} className="md:hidden">
        <div className="flex divide-x divide-border">
          {[
            { key: "all", label: t("v2.list.kpiTotal"), value: totalUsers },
            { key: "markets", label: t("v2.list.kpiMarkets"), value: totalMarkets },
            { key: "employees", label: t("v2.list.kpiEmployees"), value: totalEmployees },
          ].map((item) => (
            <div key={item.key} className="flex min-w-0 flex-1 flex-col gap-0.5 px-4 py-3">
              <span className="text-xs font-semibold text-text-muted">{item.label}</span>
              {ready ? (
                <span className="whitespace-nowrap text-base font-bold text-text">
                  {count(item.value)} <span className="text-[13px] font-semibold text-text-muted">{unit}</span>
                </span>
              ) : (
                <Skeleton width={56} height={20} />
              )}
            </div>
          ))}
        </div>
        {ready ? (
          <div className="flex flex-col gap-2.5 border-t border-border px-4 py-3">
            <SegBar markets={markets} employees={employees} label={composition} />
            {legend}
          </div>
        ) : null}
      </Card>
    </>
  );
});

UserListKpi.displayName = "UserListKpi";
