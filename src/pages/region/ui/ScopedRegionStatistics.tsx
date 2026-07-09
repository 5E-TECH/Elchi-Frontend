import { memo, useMemo, useState } from "react";
import {
  Box,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  MapPin,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DistrictStatsItem, RegionDetailStats } from "../../../entities/region";

type ScopedRegionStatisticsProps = {
  data: RegionDetailStats;
};

const formatNumber = (value: number) => value.toLocaleString("uz-UZ");

const ScopedRegionStatistics = ({ data }: ScopedRegionStatisticsProps) => {
  const { t } = useTranslation("region");
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(null);
  const selectedDistrict = useMemo(
    () =>
      data.districts.find((district) => district.id === selectedDistrictId) ??
      data.districts[0] ??
      null,
    [data.districts, selectedDistrictId],
  );
  const summary = data.summary;
  const metrics = [
    { label: t("map.metrics.totalOrders"), value: formatNumber(summary.totalOrders), icon: Box, tone: "text-blue-400" },
    { label: t("map.metrics.delivered"), value: formatNumber(summary.totalDelivered), icon: CheckCircle2, tone: "text-emerald-400" },
    { label: t("map.metrics.cancelled"), value: formatNumber(summary.totalCancelled), icon: XCircle, tone: "text-red-400" },
    { label: t("map.metrics.pending"), value: formatNumber(summary.pendingOrders), icon: Clock3, tone: "text-amber-400" },
    { label: t("map.metrics.success"), value: `${summary.successRate}%`, icon: TrendingUp, tone: "text-indigo-400" },
    {
      label: t("map.metrics.revenue"),
      value: `${formatNumber(summary.totalRevenue)} ${t("currencySum")}`,
      icon: CircleDollarSign,
      tone: "text-violet-400",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {metrics.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="min-w-0 rounded-xl border border-white/8 bg-white/[0.035] p-3.5">
            <div className={`mb-2 flex items-center gap-2 text-xs font-semibold ${tone}`}>
              <Icon size={15} />
              <span className="truncate text-[color:var(--color-text-muted)] dark:text-white/50">{label}</span>
            </div>
            <p className={`m-0 truncate text-lg font-black ${tone}`} title={value}>{value}</p>
          </div>
        ))}
      </div>

      {selectedDistrict ? <SelectedDistrict district={selectedDistrict} /> : null}

      {data.districts.length ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {data.districts.map((district) => {
              const selected = district.id === selectedDistrict?.id;
              return (
                <button
                  key={district.id}
                  type="button"
                  onClick={() => setSelectedDistrictId(district.id)}
                  className={`min-h-[104px] rounded-xl border p-3 text-left transition ${
                    selected
                      ? "border-main bg-main/20 ring-1 ring-main/50"
                      : "border-white/8 bg-white/[0.045] hover:border-main/40 hover:bg-white/[0.07]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="m-0 line-clamp-2 text-sm font-bold text-maindark dark:text-white">{district.name}</p>
                    <span className={`shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-black ${
                      district.successRate >= 70
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-amber-500/15 text-amber-400"
                    }`}>
                      {district.successRate}%
                    </span>
                  </div>
                  <p className="m-0 mt-2 text-xl font-black text-maindark dark:text-white">
                    {formatNumber(district.totalOrders)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-2.5 gap-y-1 text-[10px] font-bold">
                    <span className="inline-flex items-center gap-1 text-emerald-400">
                      <CheckCircle2 size={11} /> {formatNumber(district.deliveredOrders)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-red-400">
                      <XCircle size={11} /> {formatNumber(district.cancelledOrders)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-amber-400">
                      <Clock3 size={11} /> {formatNumber(district.pendingOrders)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-center gap-2 text-[11px] font-semibold text-[color:var(--color-text-muted)] dark:text-white/40">
            <span>{t("map.legend.low")}</span>
            {[12, 20, 28, 36].map((opacity) => (
              <span key={opacity} className="h-2.5 w-5 rounded-sm bg-main" style={{ opacity: opacity / 40 }} />
            ))}
            <span>{t("map.legend.high")}</span>
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-[color:var(--color-text-muted)] dark:text-white/50">
          {t("map.districtsNotFound")}
        </div>
      )}
    </div>
  );
};

const SelectedDistrict = ({ district }: { district: DistrictStatsItem }) => {
  const { t } = useTranslation("region");
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/8 bg-white/[0.035] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-2">
        <MapPin size={15} className="shrink-0 text-main" />
        <p className="m-0 truncate font-black text-maindark dark:text-white">{district.name}</p>
        {district.satoCode ? (
          <span className="rounded-md bg-white/6 px-2 py-0.5 text-[10px] text-[color:var(--color-text-muted)] dark:text-white/45">
            {district.satoCode}
          </span>
        ) : null}
      </div>
      <div className="grid grid-cols-3 gap-x-5 gap-y-1 text-xs">
        <Stat label={t("map.metrics.totalOrders")} value={formatNumber(district.totalOrders)} />
        <Stat label={t("map.metrics.delivered")} value={formatNumber(district.deliveredOrders)} tone="text-emerald-400" />
        <Stat label={t("map.metrics.cancelled")} value={formatNumber(district.cancelledOrders)} tone="text-red-400" />
        <Stat label={t("map.metrics.pending")} value={formatNumber(district.pendingOrders)} tone="text-amber-400" />
        <Stat label={t("map.metrics.success")} value={`${district.successRate}%`} />
        <Stat label={t("map.metrics.revenue")} value={formatNumber(district.revenue)} tone="text-violet-400" />
      </div>
    </div>
  );
};

const Stat = ({ label, value, tone = "text-maindark dark:text-white" }: { label: string; value: string; tone?: string }) => (
  <div>
    <p className="m-0 text-[10px] text-[color:var(--color-text-muted)] dark:text-white/40">{label}</p>
    <p className={`m-0 font-black ${tone}`}>{value}</p>
  </div>
);

export default memo(ScopedRegionStatistics);
