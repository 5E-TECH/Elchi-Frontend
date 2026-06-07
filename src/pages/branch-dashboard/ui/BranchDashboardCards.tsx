import { memo, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
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
import type { BranchDashboardSnapshot } from "./branchDashboardAdapter";

type Translate = ReturnType<typeof useTranslation>["t"];

const formatMoney = (value: number, t: Translate) =>
  t("money.full", { value: value.toLocaleString("uz-UZ") });

const formatCompactMoney = (value: number, t: Translate) => {
  if (value >= 1_000_000) {
    const amount = value / 1_000_000;
    return t("money.million", { value: Number.isInteger(amount) ? amount : amount.toFixed(1) });
  }

  if (value >= 1_000) {
    return t("money.thousand", { value: Math.round(value / 1_000) });
  }

  return String(value);
};

const shellClassName =
  "flex flex-col overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-primary)_94%,white_6%)_0%,color-mix(in_srgb,var(--color-sidebar)_93%,white_7%)_100%)] p-3.5 shadow-[0_14px_34px_rgba(15,23,42,0.07)] xl:h-full xl:min-h-0 dark:bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-primarydark)_92%,var(--color-maindark)_8%)_0%,color-mix(in_srgb,var(--color-maindark)_96%,var(--color-primarydark)_4%)_100%)]";
const compactShellClassName =
  "flex flex-col overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-primary)_94%,white_6%)_0%,color-mix(in_srgb,var(--color-sidebar)_93%,white_7%)_100%)] p-3 shadow-sm xl:h-full xl:min-h-0 dark:bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-primarydark)_92%,var(--color-maindark)_8%)_0%,color-mix(in_srgb,var(--color-maindark)_96%,var(--color-primarydark)_4%)_100%)]";

const CardShell = memo(({
  title,
  eyebrow,
  icon,
  children,
  compact = false,
}: {
  title: string;
  eyebrow: string;
  icon: ReactNode;
  children: ReactNode;
  compact?: boolean;
}) => (
  <section className={compact ? compactShellClassName : shellClassName}>
    <div className={`${compact ? "mb-2" : "mb-3"} flex items-start justify-between gap-3`}>
      <div>
        <p className={`${compact ? "text-[10px]" : "text-[11px]"} m-0 font-bold uppercase tracking-[0.2em] text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]`}>
          {eyebrow}
        </p>
        <h3 className={`${compact ? "text-lg" : "text-xl"} m-0 mt-1 font-black tracking-tight text-maindark dark:text-white`}>
          {title}
        </h3>
      </div>
      <div className={`${compact ? "h-9 w-9" : "h-10 w-10"} flex shrink-0 items-center justify-center rounded-xl bg-main text-white shadow-md shadow-main/20`}>
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
      <div className="grid gap-2.5 xl:min-h-0 xl:flex-1 xl:grid-cols-[1.03fr_1fr]">
        <div className="rounded-2xl border border-main/15 bg-[linear-gradient(135deg,var(--color-main)_0%,color-mix(in_srgb,var(--color-main)_75%,#ffffff_25%)_100%)] px-4 py-3 text-white shadow-[0_14px_30px_rgba(87,106,219,0.18)]">
          <p className="m-0 text-xs font-semibold text-white/80">{t("todayLoad")}</p>
          <div className="mt-2.5 flex items-end justify-between gap-3">
            <div className="text-[2.35rem] font-black leading-none">{summary.total}</div>
            <div className="rounded-xl bg-white/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em]">
              {t("ordersUnit")}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            { label: t("new"), value: summary.new },
            { label: t("onTheRoad"), value: summary.onTheRoad },
            { label: t("delivered"), value: summary.delivered },
            { label: t("returned"), value: summary.returned },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-[color:var(--color-border-soft)] bg-white/70 px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.05]"
            >
              <p className="m-0 text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
                {item.label}
              </p>
              <p className="m-0 mt-1.5 text-xl font-black text-maindark dark:text-white">
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

  if (!markets.length) {
    return (
      <CardShell title={t("markets")} eyebrow={t("marketsEyebrow")} icon={<Building2 size={22} />}>
        <div className="flex min-h-[205px] items-center justify-center rounded-2xl border border-dashed border-[color:var(--color-border-soft)] bg-white/55 px-6 text-center text-sm font-semibold text-[color:var(--color-text-muted)] xl:min-h-0 xl:flex-1 dark:border-white/10 dark:bg-white/[0.04] dark:text-[color:var(--color-text-muted-dark)]">
          {t("emptyMarkets")}
        </div>
      </CardShell>
    );
  }

  return (
    <CardShell title={t("markets")} eyebrow={t("marketsEyebrow")} icon={<Building2 size={22} />}>
      <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-white/55 p-3 xl:min-h-0 xl:flex-1 dark:border-white/10 dark:bg-white/[0.04]">
        <div className="min-h-[160px] xl:h-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={markets} margin={{ top: 34, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" />
              <XAxis
                dataKey="name"
                tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
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
                  key === "amount" ? formatMoney(Number(value), t) : Number(value)
                }
              />
              <Bar dataKey="orders" radius={[10, 10, 0, 0]} maxBarSize={44}>
                <LabelList
                  dataKey="amount"
                  position="top"
                  offset={8}
                  formatter={(value) => formatCompactMoney(Number(value) || 0, t)}
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
  const navigate = useNavigate();

  return (
    <CardShell title={t("activePackages")} eyebrow={t("packagesEyebrow")} icon={<PackageCheck size={19} />} compact>
      <div className="grid gap-2 sm:grid-cols-2">
        {[
          { label: t("onTheWayPackages"), value: packages.onTheWay },
          { label: t("waitingPackages"), value: packages.waiting },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-[color:var(--color-border-soft)] bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/[0.05]"
          >
            <p className="m-0 text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
              {item.label}
            </p>
            <p className="m-0 mt-1 text-xl font-black text-maindark dark:text-white">
              {item.value}
            </p>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => navigate("/batches")}
        className="mt-2.5 flex w-full cursor-pointer items-center justify-between rounded-xl border border-dashed border-[color:var(--color-border-soft)] bg-white/55 px-3 py-2 text-left text-xs font-semibold text-[color:var(--color-text-muted)] transition xl:mt-auto hover:border-main/35 hover:bg-main/5 hover:text-main dark:border-white/10 dark:bg-white/[0.03] dark:text-[color:var(--color-text-muted-dark)] dark:hover:bg-white/[0.06] dark:hover:text-white"
      >
        <span>{t("packagePlaceholder")}</span>
        <ArrowRight size={16} className="shrink-0" />
      </button>
    </CardShell>
  );
});

ActivePackagesCard.displayName = "ActivePackagesCard";

export const CourierActivityCard = memo(({ couriers }: { couriers: BranchDashboardSnapshot["couriers"] }) => {
  const { t } = useTranslation("branchDashboard");

  if (!couriers.total && !couriers.active) {
    return (
      <CardShell title={t("couriers")} eyebrow={t("couriersEyebrow")} icon={<Truck size={19} />} compact>
        <div className="flex min-h-[118px] items-center justify-center rounded-xl border border-dashed border-[color:var(--color-border-soft)] bg-white/55 px-5 text-center text-sm font-semibold text-[color:var(--color-text-muted)] xl:min-h-0 xl:flex-1 dark:border-white/10 dark:bg-white/[0.04] dark:text-[color:var(--color-text-muted-dark)]">
          {t("emptyCouriers")}
        </div>
      </CardShell>
    );
  }

  return (
    <CardShell title={t("couriers")} eyebrow={t("couriersEyebrow")} icon={<Truck size={19} />} compact>
      <div className="grid gap-2 sm:grid-cols-2">
        {[
          { label: t("totalCouriers"), value: couriers.total },
          { label: t("activeCouriers"), value: couriers.active },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-[color:var(--color-border-soft)] bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/[0.05]"
          >
            <p className="m-0 text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
              {item.label}
            </p>
            <p className="m-0 mt-1 text-xl font-black text-maindark dark:text-white">
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </CardShell>
  );
});

CourierActivityCard.displayName = "CourierActivityCard";
