import { memo, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { message } from "antd";
import { ArrowLeft, MoveRight, Search } from "lucide-react";
import type { RootState } from "../../../../app/config/store";
import { api } from "../../../../shared/api/api";
import { API_ENDPOINTS } from "../../../../shared/api";

type District = {
  id: string;
  name: string;
  region_id: string;
};

type Region = {
  id: string;
  name: string;
  assignedDistricts: District[];
};

const toArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? value : []);

const normalizeRegions = (payload: unknown): Region[] => {
  const source = payload as
    | { data?: unknown[] | { data?: unknown[]; items?: unknown[] } }
    | undefined;

  const raw = Array.isArray(source?.data)
    ? source.data
    : Array.isArray((source?.data as { data?: unknown[] })?.data)
      ? (source?.data as { data: unknown[] }).data
      : Array.isArray((source?.data as { items?: unknown[] })?.items)
        ? (source?.data as { items: unknown[] }).items
        : [];

  return raw.map((item) => {
    const region = item as {
      id?: string | number;
      name?: string;
      assignedDistricts?: unknown[];
      districts?: unknown[];
    };

    const districtsRaw = Array.isArray(region.assignedDistricts)
      ? region.assignedDistricts
      : toArray(region.districts);

    const districts = districtsRaw.map((district) => {
      const d = district as { id?: string | number; name?: string; region_id?: string | number };
      return {
        id: String(d.id ?? ""),
        name: d.name ?? "—",
        region_id: String(d.region_id ?? region.id ?? ""),
      };
    });

    return {
      id: String(region.id ?? ""),
      name: region.name ?? "—",
      assignedDistricts: districts.filter((d) => d.id),
    };
  });
};

const RegionSatoManagementPage = () => {
  const navigate = useNavigate();
  const role = useSelector((state: RootState) => state.role.role);
  const canAccess = role === "superadmin" || role === "admin";

  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

  const fetchRegions = async () => {
    setLoading(true);
    try {
      const res = await api.get(API_ENDPOINTS.REGIONS.BASE);
      setRegions(normalizeRegions(res.data));
    } catch {
      message.error("Viloyatlar ro'yxatini yuklab bo'lmadi");
      setRegions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchRegions();
  }, []);

  const stats = useMemo(() => {
    const totalRegions = regions.length;
    const totalDistricts = regions.reduce((sum, region) => sum + region.assignedDistricts.length, 0);
    return { totalRegions, totalDistricts };
  }, [regions]);

  const filteredRegions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return regions;
    return regions
      .map((region) => ({
        ...region,
        assignedDistricts: region.assignedDistricts.filter((district) =>
          district.name.toLowerCase().includes(term),
        ),
      }))
      .filter(
        (region) =>
          region.name.toLowerCase().includes(term) || region.assignedDistricts.length > 0,
      );
  }, [regions, search]);

  const moveDistrictOptimistic = (districtId: string, fromRegionId: string, toRegionId: string) => {
    if (!districtId || !fromRegionId || !toRegionId || fromRegionId === toRegionId) return;

    setRegions((prev) => {
      const next = prev.map((region) => ({
        ...region,
        assignedDistricts: [...region.assignedDistricts],
      }));
      const from = next.find((r) => r.id === fromRegionId);
      const to = next.find((r) => r.id === toRegionId);
      if (!from || !to) return prev;
      const district = from.assignedDistricts.find((d) => d.id === districtId);
      if (!district) return prev;

      from.assignedDistricts = from.assignedDistricts.filter((d) => d.id !== districtId);
      to.assignedDistricts.push({ ...district, region_id: toRegionId });
      return next;
    });
  };

  const handleDropToRegion = async (toRegionId: string, fromRegionId: string, districtId: string) => {
    if (!districtId || !fromRegionId || !toRegionId || fromRegionId === toRegionId) return;

    setMovingId(districtId);
    moveDistrictOptimistic(districtId, fromRegionId, toRegionId);

    try {
      await api.patch(API_ENDPOINTS.DISTRICTS.BY_ID(districtId), { assigned_region: toRegionId });
      message.success("Tuman boshqa viloyatga o'tkazildi");
    } catch {
      message.error("O'tkazishda xatolik yuz berdi");
      await fetchRegions();
    } finally {
      setMovingId(null);
      setDraggingId(null);
    }
  };

  if (!canAccess) {
    return <Navigate to="/regions" replace />;
  }

  return (
    <div className="h-full overflow-auto">
      <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <button
          type="button"
          onClick={() => navigate("/regions")}
          className="mb-4 inline-flex items-center gap-2 rounded-xl border border-[color:var(--color-border-soft)] bg-primary px-4 py-2 text-sm font-medium text-main dark:text-primary"
        >
          <ArrowLeft size={16} />
          Orqaga
        </button>

        <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-primary p-3 md:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-xl font-bold text-main dark:text-primary">Tumanlarni viloyatlar bo'yicha boshqarish</h1>
              <p className="mt-1 text-sm text-[color:var(--color-text-muted)]">
                Tumanni ushlab olib kerakli viloyat ustiga tashlang
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-xl border border-[color:var(--color-border-soft)] bg-sidebar px-3 py-2 text-sm text-main dark:text-primary">
                Viloyatlar: <span className="font-semibold">{stats.totalRegions}</span>
              </div>
              <div className="rounded-xl border border-[color:var(--color-border-soft)] bg-sidebar px-3 py-2 text-sm text-main dark:text-primary">
                Tumanlar: <span className="font-semibold">{stats.totalDistricts}</span>
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-xl border border-[color:var(--color-border-soft)] bg-sidebar px-3 py-2">
            <Search size={16} className="text-[color:var(--color-text-muted)]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tuman yoki viloyat qidirish..."
              className="w-full bg-transparent text-sm text-main outline-none placeholder:text-[color:var(--color-text-muted)] dark:text-primary"
            />
          </div>

          {loading ? (
            <div className="mt-4 rounded-xl border border-[color:var(--color-border-soft)] bg-sidebar p-4 text-sm text-[color:var(--color-text-muted)]">
              Yuklanmoqda...
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filteredRegions.map((region) => (
                <div
                  key={region.id}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    const districtId = event.dataTransfer.getData("districtId");
                    const fromRegionId = event.dataTransfer.getData("fromRegionId");
                    void handleDropToRegion(region.id, fromRegionId, districtId);
                  }}
                  className="rounded-xl border border-[color:var(--color-border-soft)] bg-sidebar p-2.5 transition-shadow hover:shadow-md"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="truncate text-sm font-semibold text-main dark:text-primary">{region.name}</div>
                    <div className="rounded-lg bg-primary px-2 py-1 text-xs font-medium text-[color:var(--color-text-muted)]">
                      {region.assignedDistricts.length} ta
                    </div>
                  </div>

                  <div className="max-h-[280px] space-y-1.5 overflow-y-auto pr-1">
                    {region.assignedDistricts.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-[color:var(--color-border-soft)] bg-primary px-2 py-3 text-center text-xs text-[color:var(--color-text-muted)]">
                        Tuman biriktirilmagan
                      </div>
                    ) : (
                      region.assignedDistricts.map((district) => {
                        const isDragging = draggingId === district.id;
                        const isMoving = movingId === district.id;
                        return (
                          <div
                            key={district.id}
                            draggable
                            onDragStart={(event) => {
                              event.dataTransfer.setData("districtId", district.id);
                              event.dataTransfer.setData("fromRegionId", region.id);
                              setDraggingId(district.id);
                            }}
                            onDragEnd={() => setDraggingId(null)}
                            className={`flex items-center justify-between rounded-lg border border-[color:var(--color-border-soft)] bg-primary px-2.5 py-1.5 ${
                              isDragging ? "opacity-60" : ""
                            }`}
                          >
                            <span className="truncate pr-2 text-[13px] font-medium text-main dark:text-primary">{district.name}</span>
                            <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-[color:var(--color-text-muted)]">
                              <MoveRight size={14} />
                              {isMoving ? "Saqlanmoqda..." : "Ko'chirish"}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(RegionSatoManagementPage);
