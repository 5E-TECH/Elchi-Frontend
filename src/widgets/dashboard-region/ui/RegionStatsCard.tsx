import { memo, useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { CheckCircle2, Clock3, Map as MapIcon, Loader2, Package, TrendingUp, Wallet, XCircle } from "lucide-react";
import UzbekistanRegionMap from "../../../pages/region/ui/UzbekistanRegionMap";
import { useRegionDetailStats, useRegionStats, toRegionMapItems, type DistrictStatsItem } from "../../../entities/region";
import { TYPO, TEXT } from "../../../shared/config/designSystem";
import QueryErrorState from "../../../shared/ui/QueryErrorState";
import { getTodayRange } from "../../../shared/lib/dateRange";
import type { RootState } from "../../../app/config/store";

/**
 * RegionStatsCard — Dashboard uchun hududlar bo'yicha xarita widgeti.
 * Mavjud `UzbekistanRegionMap` komponenti va `entities/region` data-layeridan
 * foydalanadi (yangi backend kerak emas).
 */
export interface RegionStatsCardProps {
  startDate?: string;
  endDate?: string;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const getString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }

  return "";
};

const resolveRegionId = (user: unknown) => {
  const profile = asRecord(user);
  const region = asRecord(profile.region);
  const branch = asRecord(profile.branch);
  const branchRegion = asRecord(branch.region);

  return getString(
    profile.region_id,
    profile.regionId,
    region.id,
    branch.region_id,
    branch.regionId,
    branchRegion.id,
  );
};

const resolveBranchId = (user: unknown) => {
  const profile = asRecord(user);
  const branch = asRecord(profile.branch);

  return getString(profile.branch_id, profile.branchId, branch.id);
};

const MetricCard = ({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  tone: "blue" | "green" | "rose" | "amber" | "purple" | "cyan";
}) => {
  const toneClass = {
    blue: "bg-blue-500/10 text-blue-500",
    green: "bg-emerald-500/10 text-emerald-500",
    rose: "bg-rose-500/10 text-rose-500",
    amber: "bg-amber-500/10 text-amber-500",
    purple: "bg-purple-500/10 text-purple-500",
    cyan: "bg-cyan-500/10 text-cyan-500",
  }[tone];

  return (
    <div className="rounded-xl border border-[color:var(--color-border-soft)] bg-primary p-4 shadow-sm dark:bg-[#2A263D]">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneClass}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs text-[color:var(--color-text-muted)]">{label}</p>
          <p className="text-lg font-black text-main dark:text-primary">{value}</p>
        </div>
      </div>
    </div>
  );
};

const DistrictStatRow = ({
  district,
  maxOrders,
  labels,
}: {
  district: DistrictStatsItem;
  maxOrders: number;
  labels: {
    orders: string;
    delivered: string;
    cancelled: string;
  };
}) => {
  const percent = maxOrders > 0 ? Math.max(6, Math.round((district.totalOrders / maxOrders) * 100)) : 6;

  return (
    <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-sidebar p-3 dark:bg-primarydark/40">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-extrabold text-main dark:text-primary">
            {district.name || "—"}
          </div>
          {district.satoCode ? (
            <div className="mt-1 text-[11px] font-semibold text-[color:var(--color-text-muted)]">
              {district.satoCode}
            </div>
          ) : null}
        </div>
        <div className="rounded-full bg-main/10 px-2.5 py-1 text-xs font-bold text-main dark:bg-white/10 dark:text-primary">
          {district.successRate}%
        </div>
      </div>
      <div className="mb-3 h-2 overflow-hidden rounded-full bg-primary dark:bg-maindark">
        <div className="h-full rounded-full bg-main" style={{ width: `${percent}%` }} />
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-[color:var(--color-text-muted)] sm:grid-cols-4">
        <span><b className="text-main dark:text-primary">{district.totalOrders}</b> {labels.orders}</span>
        <span><b className="text-emerald-500">{district.deliveredOrders}</b> {labels.delivered}</span>
        <span><b className="text-rose-500">{district.cancelledOrders}</b> {labels.cancelled}</span>
        <span><b className="text-purple-500">{district.revenue.toLocaleString("uz-UZ")}</b></span>
      </div>
    </div>
  );
};

const RegionStatsCard = memo(({ startDate, endDate }: RegionStatsCardProps) => {
  const { t } = useTranslation("dashboard");
  const { t: regionT } = useTranslation("region");
  const role = useSelector((state: RootState) => state.role.role);
  const user = useSelector((state: RootState) => state.user.user);
  const normalizedRole = String(role ?? "").toLowerCase();
  const isScopedDistrictMap = normalizedRole === "courier" || normalizedRole === "manager";
  const regionId = useMemo(() => resolveRegionId(user), [user]);
  const branchId = useMemo(() => resolveBranchId(user), [user]);
  const userId = getString(user?.id);
  const params = useMemo(() => {
    const today = getTodayRange();
    return {
      startDate: startDate || today.from,
      endDate: endDate || today.to,
    };
  }, [endDate, startDate]);
  const scopedParams = useMemo(
    () => ({
      ...params,
      ...(normalizedRole === "courier" && userId ? { courier_id: userId } : {}),
      ...(normalizedRole === "manager" && branchId ? { branch_id: branchId } : {}),
    }),
    [branchId, normalizedRole, params, userId],
  );
  const { data, isLoading, isError, refetch } = useRegionStats(params, !isScopedDistrictMap);
  const {
    data: scopedData,
    isLoading: scopedLoading,
    isError: scopedError,
    refetch: refetchScoped,
  } = useRegionDetailStats(regionId, scopedParams, isScopedDistrictMap && Boolean(regionId));

  const regions = data?.regions ?? [];
  const summary = data?.summary ?? null;
  const districts = scopedData?.districts ?? [];
  const scopedSummary = scopedData?.summary;
  const maxDistrictOrders = Math.max(1, ...districts.map((district) => district.totalOrders));

  const title = isScopedDistrictMap
    ? (scopedData?.name || regionT("assignedRegion"))
    : t("region.title");
  const subtitle = isScopedDistrictMap
    ? (normalizedRole === "courier"
        ? regionT("map.scopedCourierSubtitle", { defaultValue: "Only your district statistics" })
        : regionT("map.scopedManagerSubtitle", { defaultValue: "Branch district statistics" }))
    : t("region.subtitle");

  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <MapIcon size={18} style={{ color: "var(--color-main)" }} />
        <div>
          <h2 className={`${TYPO.sectionTitle} text-maindark dark:text-primary`}>
            {title}
          </h2>
          <p className="mt-1 text-xs" style={{ color: TEXT.soft }}>
            {subtitle}
          </p>
        </div>
      </div>

      {isScopedDistrictMap && !regionId ? (
        <QueryErrorState description={regionT("map.regionNotFound", { defaultValue: "Region was not found for this user." })} />
      ) : isScopedDistrictMap ? (
        scopedError ? (
          <QueryErrorState
            description={t("load_error")}
            onRetry={() => void refetchScoped()}
          />
        ) : scopedLoading ? (
          <div className="flex h-[400px] items-center justify-center rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-card-surface)]">
            <Loader2 className="h-7 w-7 animate-spin" style={{ color: "var(--color-main)" }} />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <MetricCard icon={<Package size={18} />} label={regionT("map.metrics.totalOrders")} value={(scopedSummary?.totalOrders ?? 0).toLocaleString("uz-UZ")} tone="blue" />
              <MetricCard icon={<CheckCircle2 size={18} />} label={regionT("map.metrics.delivered")} value={(scopedSummary?.totalDelivered ?? 0).toLocaleString("uz-UZ")} tone="green" />
              <MetricCard icon={<XCircle size={18} />} label={regionT("map.metrics.cancelled")} value={(scopedSummary?.totalCancelled ?? 0).toLocaleString("uz-UZ")} tone="rose" />
              <MetricCard icon={<Clock3 size={18} />} label={regionT("map.metrics.pending")} value={(scopedSummary?.pendingOrders ?? 0).toLocaleString("uz-UZ")} tone="amber" />
              <MetricCard icon={<TrendingUp size={18} />} label={regionT("map.metrics.success")} value={`${scopedSummary?.successRate ?? 0}%`} tone="cyan" />
              <MetricCard icon={<Wallet size={18} />} label={regionT("map.metrics.totalRevenue")} value={`${(scopedSummary?.totalRevenue ?? 0).toLocaleString("uz-UZ")} ${regionT("currencySum")}`} tone="purple" />
            </div>

            <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-primary p-4 shadow-sm dark:bg-[#2A263D]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-sm font-extrabold text-main dark:text-primary">
                  {regionT("map.districtsTitle", { count: districts.length })}
                </div>
                <div className="text-xs font-semibold text-[color:var(--color-text-muted)]">
                  {regionT("map.metrics.couriers")}: {scopedSummary?.activeCouriers ?? 0}
                </div>
              </div>
              {districts.length ? (
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  {districts.map((district) => (
                    <DistrictStatRow
                      key={district.id}
                      district={district}
                      maxOrders={maxDistrictOrders}
                      labels={{
                        orders: regionT("map.metrics.orderUnit"),
                        delivered: regionT("map.metrics.delivered"),
                        cancelled: regionT("map.metrics.cancelled"),
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-[color:var(--color-border-soft)] bg-sidebar p-4 text-sm text-[color:var(--color-text-muted)] dark:bg-primarydark/40">
                  {regionT("map.districtsNotFound")}
                </div>
              )}
            </div>
          </div>
        )
      ) : isError ? (
        <QueryErrorState
          description={t("load_error")}
          onRetry={() => void refetch()}
        />
      ) : isLoading ? (
        <div className="flex h-[400px] items-center justify-center rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-card-surface)]">
          <Loader2 className="h-7 w-7 animate-spin" style={{ color: "var(--color-main)" }} />
        </div>
      ) : (
        <UzbekistanRegionMap
          regions={toRegionMapItems(regions)}
          summary={summary}
          startDate={params.startDate}
          endDate={params.endDate}
        />
      )}
    </section>
  );
});

RegionStatsCard.displayName = "RegionStatsCard";

export default RegionStatsCard;
