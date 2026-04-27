import { memo, type ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  Building2,
  PackageCheck,
  Truck,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslation } from "react-i18next";
import type { BranchDashboardSnapshot } from "./branchDashboardMock";

const formatMoney = (value: number) => `${value.toLocaleString("uz-UZ")} so'm`;

const shellClassName =
  "overflow-hidden rounded-[30px] border border-[color:var(--color-border-soft)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-primary)_94%,white_6%)_0%,color-mix(in_srgb,var(--color-sidebar)_93%,white_7%)_100%)] p-5 shadow-[0_22px_50px_rgba(15,23,42,0.08)] dark:bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-primarydark)_92%,var(--color-maindark)_8%)_0%,color-mix(in_srgb,var(--color-maindark)_96%,var(--color-primarydark)_4%)_100%)]";

const CardShell = memo(({
  title,
  eyebrow,
  icon,
  children,
}: {
  title: string;
  eyebrow: string;
  icon: ReactNode;
  children: ReactNode;
}) => (
  <section className={shellClassName}>
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <p className="m-0 text-xs font-bold uppercase tracking-[0.24em] text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
          {eyebrow}
        </p>
        <h3 className="m-0 mt-2 text-2xl font-black tracking-tight text-maindark dark:text-white">
          {title}
        </h3>
      </div>
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-main text-white shadow-lg shadow-main/25">
        {icon}
      </div>
    </div>
    {children}
  </section>
));

CardShell.displayName = "CardShell";

export const OrdersOverviewCard = memo(({ summary }: { summary: BranchDashboardSnapshot["orderSummary"] }) => {
  const { t } = useTranslation("branchDashboard");

  return (
    <CardShell title={t("todayOrders")} eyebrow={t("ordersEyebrow")} icon={<Activity size={22} />}>
      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <div className="rounded-[28px] border border-main/15 bg-[linear-gradient(135deg,var(--color-main)_0%,color-mix(in_srgb,var(--color-main)_75%,#ffffff_25%)_100%)] px-5 py-6 text-white shadow-[0_24px_45px_rgba(87,106,219,0.24)]">
          <p className="m-0 text-sm font-semibold text-white/80">{t("todayLoad")}</p>
          <div className="mt-4 flex items-end justify-between gap-3">
            <div className="text-6xl font-black leading-none">{summary.total}</div>
            <div className="rounded-2xl bg-white/15 px-3 py-2 text-xs font-bold uppercase tracking-[0.18em]">
              {t("ordersUnit")}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: t("new"), value: summary.new },
            { label: t("onTheRoad"), value: summary.onTheRoad },
            { label: t("delivered"), value: summary.delivered },
            { label: t("returned"), value: summary.returned },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-[24px] border border-[color:var(--color-border-soft)] bg-white/70 px-4 py-4 dark:border-white/10 dark:bg-white/[0.05]"
            >
              <p className="m-0 text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
                {item.label}
              </p>
              <p className="m-0 mt-3 text-3xl font-black text-maindark dark:text-white">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </CardShell>
  );
});

OrdersOverviewCard.displayName = "OrdersOverviewCard";

export const MarketsPerformanceCard = memo(({ markets }: { markets: BranchDashboardSnapshot["markets"] }) => {
  const { t } = useTranslation("branchDashboard");

  return (
    <CardShell title={t("markets")} eyebrow={t("marketsEyebrow")} icon={<Building2 size={22} />}>
      <div className="rounded-[28px] border border-[color:var(--color-border-soft)] bg-white/55 p-4 dark:border-white/10 dark:bg-white/[0.04]">
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={markets} margin={{ top: 24, right: 12, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" />
              <XAxis
                dataKey="name"
                tick={{ fill: "var(--color-text-muted)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "var(--color-text-muted)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: "rgba(99,102,241,0.08)" }}
                contentStyle={{
                  borderRadius: 16,
                  border: "1px solid rgba(99,102,241,0.15)",
                  background: "var(--color-primary)",
                }}
                formatter={(value, key) =>
                  key === "amount" ? formatMoney(Number(value)) : Number(value)
                }
              />
              <Bar dataKey="orders" radius={[14, 14, 0, 0]} maxBarSize={56}>
                <LabelList
                  dataKey="amount"
                  position="top"
                  formatter={(value) => formatMoney(Number(value) || 0)}
                  className="fill-[color:var(--color-maindark)] dark:fill-white"
                  fontSize={11}
                  fontWeight={700}
                />
                {markets.map((item, index) => (
                  <Cell
                    key={item.id}
                    fill={index % 2 === 0 ? "var(--color-main)" : "rgba(16,185,129,0.88)"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </CardShell>
  );
});

MarketsPerformanceCard.displayName = "MarketsPerformanceCard";

export const ActivePackagesCard = memo(({ packages }: { packages: BranchDashboardSnapshot["packages"] }) => {
  const { t } = useTranslation("branchDashboard");

  return (
    <CardShell title={t("activePackages")} eyebrow={t("packagesEyebrow")} icon={<PackageCheck size={22} />}>
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { label: t("onTheWayPackages"), value: packages.onTheWay },
          { label: t("waitingPackages"), value: packages.waiting },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-[26px] border border-[color:var(--color-border-soft)] bg-white/70 px-5 py-5 dark:border-white/10 dark:bg-white/[0.05]"
          >
            <p className="m-0 text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
              {item.label}
            </p>
            <p className="m-0 mt-4 text-4xl font-black text-maindark dark:text-white">
              {item.value}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between rounded-[26px] border border-dashed border-[color:var(--color-border-soft)] bg-white/55 px-4 py-4 text-sm font-semibold text-[color:var(--color-text-muted)] dark:border-white/10 dark:bg-white/[0.03] dark:text-[color:var(--color-text-muted-dark)]">
        <span>{t("packagePlaceholder")}</span>
        <ArrowRight size={16} className="shrink-0" />
      </div>
    </CardShell>
  );
});

ActivePackagesCard.displayName = "ActivePackagesCard";

export const CourierActivityCard = memo(({ couriers }: { couriers: BranchDashboardSnapshot["couriers"] }) => {
  const { t } = useTranslation("branchDashboard");

  return (
    <CardShell title={t("couriers")} eyebrow={t("couriersEyebrow")} icon={<Truck size={22} />}>
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { label: t("totalCouriers"), value: couriers.total },
          { label: t("activeCouriers"), value: couriers.active },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-[26px] border border-[color:var(--color-border-soft)] bg-white/70 px-5 py-5 dark:border-white/10 dark:bg-white/[0.05]"
          >
            <p className="m-0 text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
              {item.label}
            </p>
            <p className="m-0 mt-4 text-4xl font-black text-maindark dark:text-white">
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </CardShell>
  );
});

CourierActivityCard.displayName = "CourierActivityCard";
