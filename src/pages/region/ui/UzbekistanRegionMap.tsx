import { memo, useEffect, useMemo, useState } from "react";
import { Modal, Spin } from "antd";
import Highcharts from "highcharts/highmaps";
import HighchartsReact from "highcharts-react-official";
import uzTopology from "@highcharts/map-collection/countries/uz/uz-all.topo.json";
import { CheckCircle2, Clock3, Loader2, MapPin, Package, Phone, TrendingUp, Users, Wallet, XCircle } from "lucide-react";
import { api } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";

interface RegionStats {
  districtCount: number;
  activeCouriers: number;
  orderCount: number;
  deliveredOrders?: number;
  cancelledOrders?: number;
  pendingOrders?: number;
  totalRevenue?: number;
  successRate?: number;
}

interface RegionMapItem {
  id: string;
  name: string;
  stats: RegionStats;
}

interface MapPoint {
  regionId: string;
  "hc-key": string;
  value: number;
  regionName: string;
  districtsCount: number;
  couriersCount: number;
  deliveredOrders: number;
  cancelledOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  successRate: number;
}

type RegionSummary = {
  totalOrders: number;
  totalDelivered: number;
  totalCancelled: number;
  totalRevenue: number;
};

type RegionDetailInfo = {
  id: string;
  name: string;
  totalOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  pendingOrders: number;
  activeCouriers: number;
  districtsCount: number;
  totalRevenue: number;
  successRate: number;
  couriers: Array<{
    id: string;
    name: string;
    phone: string;
    totalOrders: number;
    deliveredOrders: number;
    cancelledOrders: number;
    successRate: number;
    revenue: number;
    isMain?: boolean;
  }>;
  districts: Array<{
    id: string;
    name: string;
    satoCode?: string;
    totalOrders: number;
    successRate: number;
    revenue: number;
    activeCouriers: number;
  }>;
};

const NAME_TO_HC_KEY: Record<string, string> = {
  andijon: "uz-an",
  buxoro: "uz-bu",
  jizzax: "uz-ji",
  qashqadaryo: "uz-qa",
  navoiy: "uz-nw",
  namangan: "uz-ng",
  samarqand: "uz-sa",
  surxondaryo: "uz-su",
  sirdaryo: "uz-si",
  toshkentsh: "uz-tk",
  toshkentshahri: "uz-tk",
  toshkent: "uz-ta",
  toshkentviloyati: "uz-ta",
  fargona: "uz-fa",
  xorazm: "uz-kh",
  qoraqalpogiston: "uz-qr",
};

const normalizeRegionName = (value: string) => {
  const normalized = value
    .toLocaleLowerCase()
    .replace(/oʻ|o'/g, "o")
    .replace(/gʻ|g'/g, "g")
    .replace(/qoraqalpog'iston|qoraqalpog‘iston/g, "qoraqalpogiston")
    .replace(/farg'ona|fargʻona/g, "fargona")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.includes("toshkent shahri") || normalized === "toshkent shahar") {
    return "toshkentshahri";
  }

  if (normalized.includes("toshkent viloyati")) {
    return "toshkentviloyati";
  }

  return normalized
    .replace(/respublikasi|viloyati|viloyat|shahar/g, "")
    .replace(/\s+/g, "")
    .trim();
};

const toNum = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const UzbekistanRegionMap = ({
  regions,
  summary,
  startDate,
  endDate,
}: {
  regions: RegionMapItem[];
  summary?: RegionSummary | null;
  startDate?: string;
  endDate?: string;
}) => {
  const [mapOptions, setMapOptions] = useState<Highcharts.Options | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [selectedRegion, setSelectedRegion] = useState<RegionDetailInfo | null>(null);
  const legendItems = useMemo(
    () => [
      { name: "Kam", color: isDarkMode ? "#334155" : "#d1fae5" },
      { name: "O'rtacha", color: isDarkMode ? "#14532d" : "#86efac" },
      { name: "Ko'p", color: isDarkMode ? "#15803d" : "#22c55e" },
      { name: "Juda ko'p", color: isDarkMode ? "#166534" : "#15803d" },
    ],
    [isDarkMode],
  );

  const computedSummary = useMemo(() => {
    return regions.reduce(
      (acc, region) => {
        acc.orders += region.stats.orderCount;
        return acc;
      },
      { orders: 0 },
    );
  }, [regions]);

  const normalizeDetail = (payload: any, fallback: MapPoint): RegionDetailInfo => {
    const raw = payload?.data?.data ?? payload?.data ?? payload ?? {};
    const source = raw?.summary ? raw : raw?.data ?? raw;
    const summary = source?.summary ?? {};
    const region = source?.region ?? source;
    const totalOrders = toNum(
      summary?.totalOrders ??
        summary?.ordersCount ??
        summary?.orders_count ??
        source?.totalOrders ??
        source?.ordersCount ??
        source?.orders_count ??
        fallback.value,
      0,
    );
    const deliveredOrders = toNum(
      summary?.deliveredOrders ??
        summary?.delivered_orders ??
        source?.deliveredOrders ??
        source?.delivered_orders ??
        fallback.deliveredOrders,
      0,
    );
    const cancelledOrders = toNum(
      summary?.cancelledOrders ??
        summary?.cancelled_orders ??
        source?.cancelledOrders ??
        source?.cancelled_orders ??
        fallback.cancelledOrders,
      0,
    );
    const rawPending = toNum(
      summary?.pendingOrders ??
        summary?.pending_orders ??
        source?.pendingOrders ??
        source?.pending_orders ??
        fallback.pendingOrders,
      0,
    );
    const pendingOrders =
      rawPending > 0 ? rawPending : Math.max(totalOrders - deliveredOrders - cancelledOrders, 0);
    const activeCouriers = toNum(
      summary?.activeCouriers ??
        summary?.active_couriers ??
        source?.activeCouriers ??
        source?.active_couriers ??
        fallback.couriersCount,
      0,
    );
    const districtsCount = toNum(
      summary?.totalDistricts ??
        summary?.districtsCount ??
        summary?.districts_count ??
        source?.districtsCount ??
        source?.districts_count ??
        (Array.isArray(source?.districts) ? source.districts.length : 0) ??
        fallback.districtsCount,
      0,
    );
    const totalRevenue = toNum(
      summary?.totalRevenue ??
        summary?.total_revenue ??
        summary?.revenue ??
        source?.totalRevenue ??
        source?.total_revenue ??
        source?.revenue ??
        fallback.totalRevenue,
      0,
    );
    const rateFromApi = toNum(
      summary?.successRate ??
        summary?.success_rate ??
        source?.successRate ??
        source?.success_rate ??
        fallback.successRate,
      0,
    );
    const successRate =
      rateFromApi > 0 ? rateFromApi : totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100) : 0;

    const couriersSource = Array.isArray(source?.couriers)
      ? source.couriers
      : Array.isArray(source?.mainCouriers)
        ? source.mainCouriers
        : Array.isArray(source?.users)
          ? source.users
          : [];
    const districtsSource = Array.isArray(source?.districts)
      ? source.districts
      : Array.isArray(source?.tumanlar)
        ? source.tumanlar
        : [];

    const couriers = couriersSource.map((item: any, idx: number) => {
      const courierTotalOrders = toNum(item?.totalOrders ?? item?.ordersCount ?? item?.orders_count, 0);
      const courierDelivered = toNum(item?.deliveredOrders ?? item?.delivered_orders, 0);
      const courierCancelled = toNum(item?.cancelledOrders ?? item?.cancelled_orders, 0);
      const courierSuccessRate =
        toNum(item?.successRate ?? item?.success_rate, 0) ||
        (courierTotalOrders > 0 ? Math.round((courierDelivered / courierTotalOrders) * 100) : 0);
      return {
        id: String(item?.id ?? idx + 1),
        name: String(item?.name ?? item?.full_name ?? "Noma'lum"),
        phone: String(item?.phone ?? item?.phone_number ?? "—"),
        totalOrders: courierTotalOrders,
        deliveredOrders: courierDelivered,
        cancelledOrders: courierCancelled,
        successRate: courierSuccessRate,
        revenue: toNum(item?.revenue ?? item?.totalRevenue ?? item?.total_revenue, 0),
        isMain: Boolean(item?.isMain ?? item?.is_main ?? idx === 0),
      };
    });

    const districts = districtsSource.map((item: any, idx: number) => {
      return {
        id: String(item?.id ?? idx + 1),
        name: String(item?.name ?? "Noma'lum tuman"),
        satoCode: item?.sato_code ? String(item.sato_code) : undefined,
        totalOrders: toNum(item?.totalOrders ?? item?.ordersCount ?? item?.orders_count, 0),
        successRate: toNum(item?.successRate ?? item?.success_rate, 0),
        revenue: toNum(item?.revenue ?? item?.totalRevenue ?? item?.total_revenue, 0),
        activeCouriers: toNum(
          item?.activeCouriers ??
            item?.active_couriers ??
            (Array.isArray(item?.couriers) ? item.couriers.length : 0),
          0,
        ),
      };
    });

    return {
      id: String(region?.id ?? source?.id ?? fallback.regionId),
      name: String(region?.name ?? source?.name ?? fallback.regionName),
      totalOrders,
      deliveredOrders,
      cancelledOrders,
      pendingOrders,
      activeCouriers,
      districtsCount,
      totalRevenue,
      successRate,
      couriers,
      districts,
    };
  };

  const loadRegionDetail = async (point: MapPoint) => {
    setIsDetailOpen(true);
    setIsDetailLoading(true);
    setDetailError("");
    try {
      const response = await api.get(API_ENDPOINTS.REGIONS.STATS_BY_ID(point.regionId), {
        params: {
          ...(startDate ? { startDate } : {}),
          ...(endDate ? { endDate } : {}),
        },
      });
      setSelectedRegion(normalizeDetail(response.data, point));
    } catch (error: any) {
      setDetailError(error?.response?.data?.message ?? "Viloyat ma'lumotini yuklab bo'lmadi");
      setSelectedRegion(normalizeDetail({}, point));
    } finally {
      setIsDetailLoading(false);
    }
  };

  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    };
    checkDarkMode();
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const mapData: MapPoint[] = regions
      .map((region) => {
        const normalized = normalizeRegionName(region.name);
        const hcKey = NAME_TO_HC_KEY[normalized];
        if (!hcKey) return null;

        const totalOrders = Number(region.stats.orderCount ?? 0);
        const deliveredOrders = Number(region.stats.deliveredOrders ?? 0);
        const cancelledOrders = Number(region.stats.cancelledOrders ?? 0);
        const pendingOrdersRaw = Number(region.stats.pendingOrders ?? 0);
        const pendingOrders =
          pendingOrdersRaw > 0
            ? pendingOrdersRaw
            : Math.max(totalOrders - deliveredOrders - cancelledOrders, 0);
        const successRateRaw = Number(region.stats.successRate ?? 0);
        const successRate =
          successRateRaw > 0
            ? successRateRaw
            : totalOrders > 0
              ? Math.round((deliveredOrders / totalOrders) * 100)
              : 0;

        return {
          regionId: region.id,
          "hc-key": hcKey,
          value: totalOrders,
          regionName: region.name,
          districtsCount: region.stats.districtCount,
          couriersCount: region.stats.activeCouriers,
          deliveredOrders,
          cancelledOrders,
          pendingOrders,
          totalRevenue: region.stats.totalRevenue ?? 0,
          successRate,
        };
      })
      .filter((item): item is MapPoint => Boolean(item));

    const maxOrders = mapData.reduce((max, item) => Math.max(max, item.value || 0), 0);
    const rangeMax = Math.max(maxOrders, 1);
    const q1 = rangeMax * 0.25;
    const q2 = rangeMax * 0.5;
    const q3 = rangeMax * 0.75;
    const dataClasses = [
      {
        from: 0,
        to: q1,
        color: isDarkMode ? "#334155" : "#d1fae5",
        name: "Kam",
      },
      {
        from: q1,
        to: q2,
        color: isDarkMode ? "#14532d" : "#86efac",
        name: "O'rtacha",
      },
      {
        from: q2,
        to: q3,
        color: isDarkMode ? "#15803d" : "#22c55e",
        name: "Ko'p",
      },
      {
        from: q3,
        to: rangeMax,
        color: isDarkMode ? "#166534" : "#15803d",
        name: "Juda ko'p",
      },
    ];

    setMapOptions({
      chart: {
        map: uzTopology as any,
        backgroundColor: "transparent",
        style: { fontFamily: "inherit" },
      },
      title: { text: undefined },
      credits: { enabled: false },
      legend: {
        enabled: false,
        align: "center",
        verticalAlign: "bottom",
        layout: "horizontal",
        symbolRadius: 4,
        itemStyle: {
          color: isDarkMode ? "#e5e7eb" : "#374151",
          fontSize: "12px",
          fontWeight: "500",
        },
      },
      colorAxis: {
        min: 0,
        dataClassColor: "category",
        dataClasses,
      },
      tooltip: {
        useHTML: true,
        backgroundColor: "transparent",
        borderWidth: 0,
        shadow: false,
        padding: 0,
        formatter: function (this: any) {
          const p = this.point;
          const totalOrders = Number(p.value || 0).toLocaleString();
          const delivered = Number(p.deliveredOrders || 0).toLocaleString();
          const cancelled = Number(p.cancelledOrders || 0).toLocaleString();
          const pending = Number(p.pendingOrders || 0).toLocaleString();
          const revenue = Number(p.totalRevenue || 0).toLocaleString();
          const successRate = Number(p.successRate || 0);
          const districts = Number(p.districtsCount || 0).toLocaleString();
          const couriers = Number(p.couriersCount || 0).toLocaleString();

          return `<div style="
            min-width:220px;
            border-radius:14px;
            border:1px solid #e5e7eb;
            background:#ffffff;
            box-shadow:0 14px 34px rgba(15,23,42,.18);
            padding:12px;
            color:#111827;
          ">
            <div style="font-size:18px;font-weight:800;line-height:1.15;margin-bottom:10px;color:#111827;">${p.regionName || p.name}</div>
            <div style="display:grid;row-gap:5px;font-size:14px;line-height:1.3;">
              <div style="display:flex;justify-content:space-between;gap:14px;"><span style="color:#6b7280;">Buyurtmalar:</span><b style="color:#1d4ed8;">${totalOrders}</b></div>
              <div style="display:flex;justify-content:space-between;gap:14px;"><span style="color:#6b7280;">Yetkazilgan:</span><b style="color:#059669;">${delivered}</b></div>
              <div style="display:flex;justify-content:space-between;gap:14px;"><span style="color:#6b7280;">Bekor qilingan:</span><b style="color:#dc2626;">${cancelled}</b></div>
              <div style="display:flex;justify-content:space-between;gap:14px;"><span style="color:#6b7280;">Muvaffaqiyat:</span><b style="color:#e11d48;">${successRate}%</b></div>
              <div style="display:flex;justify-content:space-between;gap:14px;"><span style="color:#6b7280;">Jarayonda:</span><b style="color:#d97706;">${pending}</b></div>
              <div style="display:flex;justify-content:space-between;gap:14px;"><span style="color:#6b7280;">Tushum:</span><b style="color:#9333ea;">${revenue} so'm</b></div>
              <div style="display:flex;justify-content:space-between;gap:14px;"><span style="color:#6b7280;">Tumanlar:</span><b>${districts}</b></div>
              <div style="display:flex;justify-content:space-between;gap:14px;"><span style="color:#6b7280;">Kuryerlar:</span><b>${couriers}</b></div>
            </div>
            <div style="
              margin-top:10px;
              padding-top:8px;
              border-top:1px solid #e5e7eb;
              color:#9ca3af;
              font-size:11px;
              font-weight:600;
            ">Batafsil ko'rish uchun bosing</div>
          </div>`;
        },
      },
      series: [
        {
          type: "map",
          name: "Buyurtmalar",
          data: mapData,
          joinBy: "hc-key",
          borderColor: "#ffffff",
          borderWidth: 1,
          dataLabels: {
            enabled: true,
            format: "{point.name}",
            style: {
              color: "#374151",
              textOutline: "2px white",
              fontWeight: "500",
              fontSize: "11px",
            },
          },
          states: {
            hover: {
              brightness: 0.1,
              borderColor: "#3b82f6",
              borderWidth: 2,
            },
          },
          point: {
            events: {
              click: function (this: any) {
                void loadRegionDetail({
                  regionId: String(this.regionId ?? ""),
                  "hc-key": String(this["hc-key"] ?? ""),
                  value: Number(this.value ?? 0),
                  regionName: String(this.regionName ?? this.name ?? "—"),
                  districtsCount: Number(this.districtsCount ?? 0),
                  couriersCount: Number(this.couriersCount ?? 0),
                  deliveredOrders: Number(this.deliveredOrders ?? 0),
                  cancelledOrders: Number(this.cancelledOrders ?? 0),
                  pendingOrders: Number(this.pendingOrders ?? 0),
                  totalRevenue: Number(this.totalRevenue ?? 0),
                  successRate: Number(this.successRate ?? 0),
                });
              },
            },
          },
        },
      ],
    });
  }, [regions, isDarkMode]);

  if (!mapOptions) {
    return (
      <div className="relative w-full h-[500px] flex items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#e5e7eb] via-[#d1d5db] to-[#e5e7eb] animate-pulse">
        <div className="flex flex-col items-center gap-2 z-10">
          <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
          <span className="text-gray-500">Yuklanmoqda...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700/50 dark:bg-[#2A263D]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
              <Package className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Jami buyurtmalar</p>
              <p className="text-lg font-bold text-blue-600">
                {(summary?.totalOrders ?? computedSummary.orders).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700/50 dark:bg-[#2A263D]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Yetkazilgan</p>
              <p className="text-lg font-bold text-emerald-600">
                {(summary?.totalDelivered ?? 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700/50 dark:bg-[#2A263D]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10">
              <MapPin className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Bekor qilingan</p>
              <p className="text-lg font-bold text-indigo-600">
                {(summary?.totalCancelled ?? 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700/50 dark:bg-[#2A263D]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
              <Package className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Umumiy tushum</p>
              <p className="text-lg font-bold text-purple-600">
                {(summary?.totalRevenue ?? 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-primary p-4 shadow-sm dark:bg-[#2A263D]">
        <HighchartsReact
          highcharts={Highcharts}
          constructorType="mapChart"
          options={{
            ...mapOptions,
            chart: {
              ...mapOptions.chart,
              height: 500,
            },
          }}
        />
        <div className="mt-4 flex flex-wrap items-center justify-center gap-6">
          {legendItems.map((item) => (
            <div key={item.name} className="flex items-center gap-2 text-sm text-[color:var(--color-text-muted)]">
              <span
                className="h-3 w-3 rounded-sm"
                style={{ backgroundColor: item.color }}
              />
              <span>{item.name}</span>
            </div>
          ))}
        </div>
      </div>

      <Modal
        open={isDetailOpen}
        onCancel={() => setIsDetailOpen(false)}
        footer={null}
        width={920}
        centered
        destroyOnHidden
        title={selectedRegion?.name ?? "Viloyat ma'lumotlari"}
      >
        {isDetailLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spin />
          </div>
        ) : (
          <div className="space-y-5">
            <div
              className="rounded-2xl p-4 text-primary"
              style={{
                background: "linear-gradient(90deg, var(--color-main), var(--color-purple))",
              }}
            >
              <div className="text-2xl font-black">{selectedRegion?.name ?? "Viloyat"}</div>
              <div className="text-sm opacity-85">Batafsil statistika</div>
            </div>

            {detailError ? (
              <div className="rounded-xl border border-rose-300/30 bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-100">
                {detailError}
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <div className="rounded-xl border border-[color:var(--color-border-soft)] bg-primary p-3">
                <div className="mb-1 inline-flex rounded-lg bg-[color:var(--color-main-soft)] p-2 text-main"><Package size={16} /></div>
                <div className="text-xs text-[color:var(--color-text-muted)]">Jami buyurtmalar</div>
                <div className="text-xl font-black text-main dark:text-primary">{selectedRegion?.totalOrders ?? 0}</div>
              </div>
              <div className="rounded-xl border border-[color:var(--color-border-soft)] bg-primary p-3">
                <div className="mb-1 inline-flex rounded-lg bg-[color:var(--color-main-soft)] p-2 text-emerald-600"><CheckCircle2 size={16} /></div>
                <div className="text-xs text-[color:var(--color-text-muted)]">Yetkazilgan</div>
                <div className="text-xl font-black text-main dark:text-primary">{selectedRegion?.deliveredOrders ?? 0}</div>
              </div>
              <div className="rounded-xl border border-[color:var(--color-border-soft)] bg-primary p-3">
                <div className="mb-1 inline-flex rounded-lg bg-[color:var(--color-main-soft)] p-2 text-rose-600"><XCircle size={16} /></div>
                <div className="text-xs text-[color:var(--color-text-muted)]">Bekor qilingan</div>
                <div className="text-xl font-black text-main dark:text-primary">{selectedRegion?.cancelledOrders ?? 0}</div>
              </div>
              <div className="rounded-xl border border-[color:var(--color-border-soft)] bg-primary p-3">
                <div className="mb-1 inline-flex rounded-lg bg-[color:var(--color-main-soft)] p-2 text-amber-600"><Clock3 size={16} /></div>
                <div className="text-xs text-[color:var(--color-text-muted)]">Jarayonda</div>
                <div className="text-xl font-black text-main dark:text-primary">{selectedRegion?.pendingOrders ?? 0}</div>
              </div>
              <div className="rounded-xl border border-[color:var(--color-border-soft)] bg-primary p-3">
                <div className="mb-1 inline-flex rounded-lg bg-[color:var(--color-main-soft)] p-2 text-fuchsia-600"><Wallet size={16} /></div>
                <div className="text-xs text-[color:var(--color-text-muted)]">Jami tushum</div>
                <div className="text-xl font-black text-main dark:text-primary">{(selectedRegion?.totalRevenue ?? 0).toLocaleString()} so'm</div>
              </div>
              <div className="rounded-xl border border-[color:var(--color-border-soft)] bg-primary p-3">
                <div className="mb-1 inline-flex rounded-lg bg-[color:var(--color-main-soft)] p-2 text-red-500"><TrendingUp size={16} /></div>
                <div className="text-xs text-[color:var(--color-text-muted)]">Muvaffaqiyat</div>
                <div className="text-xl font-black text-main dark:text-primary">{selectedRegion?.successRate ?? 0}%</div>
              </div>
            </div>

            <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-primary p-4">
              <div className="mb-3 flex items-center gap-2 text-xl font-black text-main dark:text-primary">
                <Users size={20} className="text-amber-500" />
                Viloyat asosiy kuryeri ({selectedRegion?.couriers?.length ?? 0})
              </div>
              {selectedRegion?.couriers?.length ? (
                <div className="space-y-2">
                  {selectedRegion.couriers.map((courier, index) => (
                    <div key={courier.id} className="rounded-xl border border-[color:var(--color-border-soft)] bg-sidebar p-3 dark:bg-primarydark/40">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">{index + 1}</span>
                          <div>
                            <div className="font-bold text-main dark:text-primary">{courier.name}</div>
                            <div className="flex items-center gap-1 text-xs text-[color:var(--color-text-muted)]">
                              <Phone size={12} />
                              {courier.phone}
                            </div>
                          </div>
                          {courier.isMain ? (
                            <span className="rounded-full bg-[color:var(--color-warning-soft)] px-2 py-0.5 text-xs text-amber-600">Viloyat asosiy kuryeri</span>
                          ) : null}
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div><span className="text-[color:var(--color-text-muted)]">Buyurtma:</span> <b>{courier.totalOrders}</b></div>
                          <div><span className="text-[color:var(--color-text-muted)]">Muvaffaqiyat:</span> <b>{courier.successRate}%</b></div>
                          <div><span className="text-[color:var(--color-text-muted)]">Tushum:</span> <b>{courier.revenue.toLocaleString()} so'm</b></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-[color:var(--color-border-soft)] bg-sidebar p-3 text-sm text-[color:var(--color-text-muted)] dark:bg-primarydark/40">
                  Kuryerlar ma'lumoti topilmadi
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-primary p-4">
              <div className="mb-3 flex items-center gap-2 text-xl font-black text-main dark:text-primary">
                <MapPin size={20} className="text-emerald-500" />
                Tumanlar ({selectedRegion?.districtsCount ?? selectedRegion?.districts?.length ?? 0})
              </div>
              {selectedRegion?.districts?.length ? (
                <div className="space-y-2">
                  {selectedRegion.districts.map((district) => (
                    <div key={district.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color:var(--color-border-soft)] bg-sidebar p-3 dark:bg-primarydark/40">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        <span className="font-semibold text-main dark:text-primary">{district.name}</span>
                        {district.satoCode ? (
                          <span className="rounded-md bg-primary px-2 py-0.5 text-xs text-[color:var(--color-text-muted)]">{district.satoCode}</span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span><b>{district.totalOrders}</b> buyurtma</span>
                        <span className="rounded-full bg-[color:var(--color-warning-soft)] px-2 py-0.5 text-xs">{district.successRate}%</span>
                        <span className="font-bold text-main">{district.revenue.toLocaleString()} so'm</span>
                        <span className="text-[color:var(--color-text-muted)]">kuryer: {district.activeCouriers}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-[color:var(--color-border-soft)] bg-sidebar p-3 text-sm text-[color:var(--color-text-muted)] dark:bg-primarydark/40">
                  Tumanlar ma'lumoti topilmadi
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default memo(UzbekistanRegionMap);
