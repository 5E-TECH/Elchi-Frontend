import { memo, useEffect, useMemo, useState } from "react";
import Highcharts from "highcharts/highmaps";
import HighchartsReact from "highcharts-react-official";
import uzTopology from "@highcharts/map-collection/countries/uz/uz-all.topo.json";
import { Loader2, MapPin, Package, TrendingUp } from "lucide-react";

interface RegionStats {
  districtCount: number;
  activeCouriers: number;
  orderCount: number;
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
  value
    .toLocaleLowerCase()
    .replace(/oʻ|o'/g, "o")
    .replace(/gʻ|g'/g, "g")
    .replace(/qoraqalpog'iston|qoraqalpog‘iston/g, "qoraqalpogiston")
    .replace(/farg'ona|fargʻona/g, "fargona")
    .replace(/shahri|viloyati|respublikasi|shahar|viloyat/g, "")
    .replace(/\s+/g, "")
    .trim();

const UzbekistanRegionMap = ({ regions }: { regions: RegionMapItem[] }) => {
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

  const summary = useMemo(() => {
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
        };
      })
      .filter((item): item is MapPoint => Boolean(item));

    setMapOptions({
      chart: {
        map: uzTopology as any,
        backgroundColor: "transparent",
        style: { fontFamily: "inherit" },
      },
      title: { text: undefined },
      credits: { enabled: false },
      legend: { enabled: false },
      colorAxis: {
        min: 0,
        minColor: isDarkMode ? "#1e1b4b" : "#E8F5E9",
        maxColor: isDarkMode ? "#818cf8" : "#1B5E20",
        stops: isDarkMode
          ? [
              [0, "#1e1b4b"],
              [0.3, "#3730a3"],
              [0.6, "#6366f1"],
              [1, "#818cf8"],
            ]
          : [
              [0, "#E8F5E9"],
              [0.3, "#81C784"],
              [0.6, "#4CAF50"],
              [1, "#1B5E20"],
            ],
      },
      tooltip: {
        useHTML: true,
        formatter: function (this: any) {
          const p = this.point;
          return `<div style="padding:8px 4px">
            <div style="font-weight:600;margin-bottom:8px">${p.regionName || p.name}</div>
            <div style="display:grid;gap:4px">
              <div style="display:flex;justify-content:space-between;gap:16px"><span>Buyurtmalar:</span><b>${(p.value || 0).toLocaleString()}</b></div>
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
              <p className="text-xs text-gray-500 dark:text-gray-400">Jami buyurtma</p>
              <p className="text-lg font-bold text-blue-600">{summary.orders.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-[#2A263D] rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Aktiv kuryerlar</p>
              <p className="text-lg font-bold text-emerald-600">{summary.couriers.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-[#2A263D] rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Tumanlar</p>
              <p className="text-lg font-bold text-indigo-600">{summary.districts.toLocaleString()}</p>
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
