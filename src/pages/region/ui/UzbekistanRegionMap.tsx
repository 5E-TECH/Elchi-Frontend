import { memo, useEffect, useMemo, useState } from "react";
import Highcharts from "highcharts/highmaps";
import HighchartsReact from "highcharts-react-official";
import uzTopology from "@highcharts/map-collection/countries/uz/uz-all.topo.json";
import { Loader2, MapPin, Package, TrendingUp } from "lucide-react";

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

const normalizeRegionName = (value: string) =>
  {
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

type RegionSummary = {
  totalOrders: number;
  totalDelivered: number;
  totalCancelled: number;
  totalRevenue: number;
};

const UzbekistanRegionMap = ({
  regions,
  summary,
}: {
  regions: RegionMapItem[];
  summary?: RegionSummary | null;
}) => {
  const [mapOptions, setMapOptions] = useState<Highcharts.Options | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    };
    checkDarkMode();
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const computedSummary = useMemo(() => {
    return regions.reduce(
      (acc, region) => {
        acc.orders += region.stats.orderCount;
        acc.couriers += region.stats.activeCouriers;
        acc.districts += region.stats.districtCount;
        return acc;
      },
      { orders: 0, couriers: 0, districts: 0 },
    );
  }, [regions]);

  useEffect(() => {
    const mapData: MapPoint[] = regions
      .map((region) => {
        const normalized = normalizeRegionName(region.name);
        const hcKey = NAME_TO_HC_KEY[normalized];
        if (!hcKey) return null;
        return {
          "hc-key": hcKey,
          value: region.stats.orderCount,
          regionName: region.name,
          districtsCount: region.stats.districtCount,
          couriersCount: region.stats.activeCouriers,
          deliveredOrders: region.stats.deliveredOrders ?? 0,
          cancelledOrders: region.stats.cancelledOrders ?? 0,
          pendingOrders: region.stats.pendingOrders ?? 0,
          totalRevenue: region.stats.totalRevenue ?? 0,
          successRate: region.stats.successRate ?? 0,
        };
      })
      .filter((item): item is MapPoint => Boolean(item));

    const maxOrders = mapData.reduce((max, item) => Math.max(max, item.value || 0), 0);
    const q1 = Math.max(0, Math.floor(maxOrders * 0.25));
    const q2 = Math.max(q1, Math.floor(maxOrders * 0.5));
    const q3 = Math.max(q2, Math.floor(maxOrders * 0.75));

    const dataClasses =
      maxOrders <= 0
        ? [
            {
              from: 0,
              to: 0,
              color: isDarkMode ? "#334155" : "#d1fae5",
              name: "Kam",
            },
          ]
        : [
            {
              from: 0,
              to: q1,
              color: isDarkMode ? "#334155" : "#d1fae5",
              name: "Kam",
            },
            {
              from: q1 + 1,
              to: q2,
              color: isDarkMode ? "#14532d" : "#86efac",
              name: "O'rtacha",
            },
            {
              from: q2 + 1,
              to: q3,
              color: isDarkMode ? "#15803d" : "#22c55e",
              name: "Ko'p",
            },
            {
              from: q3 + 1,
              to: maxOrders,
              color: isDarkMode ? "#166534" : "#15803d",
              name: "Juda ko'p",
            },
          ].filter((item) => (item.to ?? 0) >= (item.from ?? 0));

    setMapOptions({
      chart: {
        map: uzTopology as any,
        backgroundColor: "transparent",
        style: { fontFamily: "inherit" },
      },
      title: { text: undefined },
      credits: { enabled: false },
      legend: {
        enabled: true,
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
        formatter: function (this: any) {
          const p = this.point;
          return `<div style="padding:8px 4px">
            <div style="font-weight:600;margin-bottom:8px">${p.regionName || p.name}</div>
            <div style="display:grid;gap:4px">
              <div style="display:flex;justify-content:space-between;gap:16px"><span>Buyurtmalar:</span><b>${(p.value || 0).toLocaleString()}</b></div>
              <div style="display:flex;justify-content:space-between;gap:16px"><span>Yetkazilgan:</span><b>${(p.deliveredOrders || 0).toLocaleString()}</b></div>
              <div style="display:flex;justify-content:space-between;gap:16px"><span>Bekor qilingan:</span><b>${(p.cancelledOrders || 0).toLocaleString()}</b></div>
              <div style="display:flex;justify-content:space-between;gap:16px"><span>Muvaffaqiyat:</span><b>${p.successRate || 0}%</b></div>
              <div style="display:flex;justify-content:space-between;gap:16px"><span>Tumanlar:</span><b>${p.districtsCount || 0}</b></div>
              <div style="display:flex;justify-content:space-between;gap:16px"><span>Kuryerlar:</span><b>${p.couriersCount || 0}</b></div>
            </div>
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-[#2A263D] rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Jami buyurtmalar</p>
              <p className="text-lg font-bold text-blue-600">{(summary?.totalOrders ?? computedSummary.orders).toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-[#2A263D] rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Yetkazilgan</p>
              <p className="text-lg font-bold text-emerald-600">{(summary?.totalDelivered ?? 0).toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-[#2A263D] rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Bekor qilingan</p>
              <p className="text-lg font-bold text-indigo-600">{(summary?.totalCancelled ?? 0).toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-[#2A263D] rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Package className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Umumiy tushum</p>
              <p className="text-lg font-bold text-purple-600">{(summary?.totalRevenue ?? 0).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#2A263D] rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700/50">
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
      </div>
    </div>
  );
};

export default memo(UzbekistanRegionMap);
