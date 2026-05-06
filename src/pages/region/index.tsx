import { memo, useEffect, useMemo, useState } from "react";
import { DatePicker } from "antd";
import dayjs from "dayjs";
import { Calendar, HeadphonesIcon, MapPin, Settings } from "lucide-react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "../../app/config/store";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";
import UzbekistanRegionMap from "./ui/UzbekistanRegionMap";

const { RangePicker } = DatePicker;

type RegionItem = {
  id: string;
  name: string;
  districtCount: number;
  activeCouriers: number;
  ordersCount: number;
};

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeRegionItem = (raw: unknown): RegionItem | null => {
  const item = raw as {
    id?: string | number;
    name?: string;
    districtCount?: number | string;
    district_count?: number | string;
    activeCouriers?: number | string;
    active_couriers?: number | string;
    ordersCount?: number | string;
    orders_count?: number | string;
  };

  if (!item?.id || !item?.name) return null;

  return {
    id: String(item.id),
    name: item.name,
    districtCount: toNumber(item.districtCount ?? item.district_count, 0),
    activeCouriers: toNumber(item.activeCouriers ?? item.active_couriers, 0),
    ordersCount: toNumber(item.ordersCount ?? item.orders_count, 0),
  };
};

const unwrapRegions = (payload: unknown): RegionItem[] => {
  const data = payload as {
    data?: unknown[] | { data?: unknown[]; items?: unknown[] };
    items?: unknown[];
  };
  const arrayCandidate = Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data?.items)
      ? data.items
      : Array.isArray((data?.data as { items?: unknown[] })?.items)
        ? (data.data as { items: unknown[] }).items
        : Array.isArray((data?.data as { data?: unknown[] })?.data)
          ? (data.data as { data: unknown[] }).data
          : [];

  return arrayCandidate
    .map(normalizeRegionItem)
    .filter((region): region is RegionItem => Boolean(region));
};

const RegionPage = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const role = useSelector((state: RootState) => state.role.role);
  const userRegionName = useSelector((state: RootState) => state.role.region);

  const [regions, setRegions] = useState<RegionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<"today" | "week" | "month" | "all" | "custom">("today");
  const [customRange, setCustomRange] = useState<{ start: string; end: string } | null>(null);

  const isSuperadmin = role === "superadmin";
  const isAdmin = role === "admin";
  const isLogist = role === "operator";
  const isCourier = role === "courier";
  const canViewStats = isAdmin || isSuperadmin || isLogist;

  const isChildRoute =
    pathname.includes("/regions/districts") ||
    pathname.includes("/regions/sato-management") ||
    pathname.includes("/regions/logist-assignment");

  useEffect(() => {
    let active = true;

    const fetchRegions = async () => {
      setIsLoading(true);
      try {
        const response = await api.get(API_ENDPOINTS.REGIONS.BASE);
        if (!active) return;
        setRegions(unwrapRegions(response.data));
      } catch {
        if (!active) return;
        setRegions([]);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void fetchRegions();
    return () => {
      active = false;
    };
  }, [dateRange, customRange]);

  const today = useMemo(() => dayjs().format("YYYY-MM-DD"), []);

  if (isChildRoute) {
    return <Outlet />;
  }

  if (!canViewStats && !isCourier) {
    return <Navigate to="/403" replace />;
  }

  return (
    <div className="h-full overflow-auto">
      <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="mb-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-main dark:text-primary flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-main flex items-center justify-center shadow-lg">
                  <MapPin className="w-5 h-5 text-primary" />
                </span>
                Hududlar
              </h1>
              <p className="text-sm text-main/65 dark:text-primary/65 mt-1">
                Hududlar kesimida buyurtmalar statistikasi
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {canViewStats && (
                <div className="flex items-center gap-1 bg-primary rounded-xl p-1 shadow-sm border border-primarydark/20">
                  <Calendar className="w-4 h-4 text-main/55 ml-2 dark:text-primary/65" />
                  {[
                    { value: "today" as const, label: "Bugun" },
                    { value: "week" as const, label: "Hafta" },
                    { value: "month" as const, label: "Oy" },
                    { value: "all" as const, label: "Barchasi" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setDateRange(option.value)}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                        dateRange === option.value
                          ? "bg-main text-primary"
                          : "text-maindark dark:text-primary hover:bg-sidebar"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                  <div className="mx-1 h-6 w-px bg-primarydark/30" />
                  <RangePicker
                    value={
                      dateRange === "custom" && customRange
                        ? [dayjs(customRange.start), dayjs(customRange.end)]
                        : null
                    }
                    onChange={(dates) => {
                      if (dates?.[0] && dates?.[1]) {
                        setDateRange("custom");
                        setCustomRange({
                          start: dates[0].format("YYYY-MM-DD"),
                          end: dates[1].format("YYYY-MM-DD"),
                        });
                      }
                    }}
                    defaultValue={[dayjs(today), dayjs(today)]}
                    className="border-0! bg-transparent! shadow-none!"
                    style={{ width: 220 }}
                  />
                </div>
              )}

              {(isAdmin || isSuperadmin) && (
                <div className="flex flex-wrap gap-2">
                  {isSuperadmin && (
                    <>
                      <button
                        type="button"
                        onClick={() => navigate("districts")}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-main bg-sidebar rounded-xl hover:opacity-85 transition-colors"
                      >
                        <MapPin size={16} />
                        Tumanlar
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate("sato-management")}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-main bg-sidebar rounded-xl hover:opacity-85 transition-colors"
                      >
                        <Settings size={16} />
                        SATO kod
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate("logist-assignment")}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-main bg-sidebar rounded-xl hover:opacity-85 transition-colors"
                  >
                    <HeadphonesIcon size={16} />
                    Logist biriktirish
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {isCourier ? (
          <div className="rounded-2xl border border-primarydark/20 bg-primary p-5">
            <p className="text-sm text-main/70 dark:text-primary/70 mb-2">Siz biriktirilgan hudud</p>
            <h3 className="text-2xl font-bold text-main dark:text-primary">{userRegionName || "—"}</h3>
          </div>
        ) : (
          <UzbekistanRegionMap
            regions={regions.map((region) => ({
              id: region.id,
              name: region.name,
              stats: {
                districtCount: region.districtCount,
                activeCouriers: region.activeCouriers,
                orderCount: region.ordersCount,
              },
            }))}
          />
        )}

        {isLoading ? (
          <div className="mt-4 text-sm text-main/60 dark:text-primary/60">Yuklanmoqda...</div>
        ) : null}
      </div>
    </div>
  );
};

export default memo(RegionPage);
