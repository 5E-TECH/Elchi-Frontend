import { memo, useMemo, useState } from "react";
import uzbekistan from "@svg-maps/uzbekistan";
import { Building2, Package, Truck } from "lucide-react";

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

interface TooltipState {
  regionId: string;
  x: number;
  y: number;
}

interface UzbekistanMapLocation {
  id: string;
  name: string;
  path: string;
}

const REGION_NAME_ALIASES: Record<string, string[]> = {
  andijan: ["andijon"],
  bukhara: ["buxoro"],
  fergana: ["fargona", "farg'ona"],
  jizzakh: ["jizzax"],
  namangan: ["namangan"],
  navoiy: ["navoiy"],
  qashqadaryo: ["qashqadaryo", "qashkadaryo"],
  karakalpakstan: ["qoraqalpogiston", "qoraqalpog'iston", "qoraqalpogistonrespublikasi"],
  samarqand: ["samarqand"],
  sirdaryo: ["sirdaryo"],
  surxondaryo: ["surxondaryo"],
  tashkent: ["toshkent", "toshkentviloyati", "toshkentshahri", "toshkentsh"],
  xorazm: ["xorazm"],
};

const REGION_LABELS: Record<string, { x: number; y: number; text: string }> = {
  karakalpakstan: { x: 210, y: 130, text: "Qoraqalpoq" },
  xorazm: { x: 270, y: 245, text: "Xorazm" },
  navoiy: { x: 460, y: 185, text: "Navoiy" },
  bukhara: { x: 430, y: 330, text: "Buxoro" },
  samarqand: { x: 540, y: 350, text: "Samarqand" },
  jizzakh: { x: 610, y: 310, text: "Jizzax" },
  sirdaryo: { x: 665, y: 300, text: "Sirdaryo" },
  tashkent: { x: 705, y: 250, text: "Toshkent" },
  namangan: { x: 742, y: 270, text: "Namangan" },
  andijan: { x: 772, y: 286, text: "Andijon" },
  fergana: { x: 735, y: 315, text: "Farg'ona" },
  qashqadaryo: { x: 515, y: 440, text: "Qashqadaryo" },
  surxondaryo: { x: 575, y: 500, text: "Surxondaryo" },
};

const fillClassByLevel: Record<string, string> = {
  low: "fill-[var(--color-region-map-low)]",
  medium: "fill-[var(--color-region-map-medium)]",
  high: "fill-[var(--color-region-map-high)]",
  xhigh: "fill-[var(--color-region-map-xhigh)]",
};

const legendItems = [
  { label: "Kam", className: fillClassByLevel.low },
  { label: "O'rtacha", className: fillClassByLevel.medium },
  { label: "Ko'p", className: fillClassByLevel.high },
  { label: "Juda ko'p", className: fillClassByLevel.xhigh },
];

const normalizeRegionName = (value: string) =>
  value
    .toLocaleLowerCase()
    .replace(/oʻ|o'/g, "o")
    .replace(/gʻ|g'/g, "g")
    .replace(/fargʻona|farg'ona/g, "fargona")
    .replace(/qoraqalpog‘iston|qoraqalpog'iston/g, "qoraqalpogiston")
    .replace(/surhandaryo/g, "surxondaryo")
    .replace(/viloyati|viloyat|respublikasi|respublika|shahri|shahar/g, "")
    .replace(/\s+/g, "")
    .trim();

const getMapKeyFromRegionName = (value: string) => {
  const normalized = normalizeRegionName(value);

  for (const [key, aliases] of Object.entries(REGION_NAME_ALIASES)) {
    if (aliases.includes(normalized)) return key;
  }

  return normalized;
};

const getLevel = (orderCount: number, maxOrders: number) => {
  if (maxOrders <= 0) return "low";
  const ratio = orderCount / maxOrders;
  if (ratio >= 0.75) return "xhigh";
  if (ratio >= 0.5) return "high";
  if (ratio >= 0.25) return "medium";
  return "low";
};

const StatRow = ({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) => (
  <div className="flex items-center justify-between gap-4 text-sm">
    <span className="text-main/65 dark:text-primary/65">{label}</span>
    <span className={`font-bold ${accent ? "text-main dark:text-primary" : "text-maindark dark:text-primary"}`}>
      {value}
    </span>
  </div>
);

const UzbekistanRegionMap = ({ regions }: { regions: RegionMapItem[] }) => {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const regionsByMapKey = useMemo(
    () =>
      regions.reduce<Record<string, RegionMapItem>>((acc, region) => {
        acc[getMapKeyFromRegionName(region.name)] = region;
        return acc;
      }, {}),
    [regions],
  );

  const maxOrders = useMemo(
    () => Math.max(...regions.map((region) => region.stats.orderCount), 0),
    [regions],
  );

  const hoveredRegion = tooltip ? regions.find((region) => region.id === tooltip.regionId) ?? null : null;

  const mapLocations = useMemo(
    () => (uzbekistan.locations as UzbekistanMapLocation[]).filter((location) => location.id !== "aral-sea"),
    [],
  );

  return (
    <div className="rounded-[2rem] border border-primary/10 bg-primary p-4 shadow-sm dark:border-primarydark dark:bg-maindark">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-xl font-black text-main dark:text-primary">O'zbekiston xaritasi</h3>
          <p className="mt-1 text-sm text-main/65 dark:text-primary/65">
            Viloyat ustiga olib borsangiz statistikasi ko'rinadi
          </p>
        </div>
        <div className="rounded-2xl border border-primary/10 bg-main/5 px-4 py-2 text-sm font-medium text-main/75 dark:border-primarydark dark:bg-primary/5 dark:text-primary/75">
          {hoveredRegion ? hoveredRegion.name : "Viloyat ustiga olib boring"}
        </div>
      </div>

      <div className="relative overflow-hidden rounded-[2rem] border border-primary/10 bg-gradient-to-br from-primary to-sidebar p-4 dark:border-primarydark dark:from-maindark dark:to-background">
        <svg
          viewBox={uzbekistan.viewBox}
          className="mx-auto h-auto w-full max-w-[52rem]"
          role="img"
          aria-label="O'zbekiston viloyatlari xaritasi"
          onMouseLeave={() => setTooltip(null)}
        >
          {mapLocations.map((location: UzbekistanMapLocation, index: number) => {
            const region = regionsByMapKey[location.id];
            const level = getLevel(region?.stats.orderCount ?? 0, maxOrders);
            const label = REGION_LABELS[location.id];

            return (
              <g key={`${location.id}-${index}`}>
                <path
                  d={location.path}
                  className={`${region ? fillClassByLevel[level] : "fill-sidebar dark:fill-background"} cursor-pointer stroke-[2.2] [stroke:var(--color-region-map-stroke)] transition-all duration-200 hover:brightness-95`}
                  onMouseMove={(event) => {
                    if (!region) return;
                    const bounds = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
                    if (!bounds) return;
                    setTooltip({
                      regionId: region.id,
                      x: event.clientX - bounds.left + 18,
                      y: event.clientY - bounds.top - 16,
                    });
                  }}
                />

                {label ? (
                  <text
                    x={label.x}
                    y={label.y}
                    textAnchor="middle"
                    className="pointer-events-none fill-[var(--color-region-map-label)] text-[15px] font-bold"
                  >
                    {label.text}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>

        {tooltip && hoveredRegion ? (
          <div
            className="pointer-events-none absolute z-10 w-[16rem] rounded-2xl border border-primary/10 bg-primary/95 p-4 shadow-xl dark:border-primarydark dark:bg-maindark/95"
            style={{
              left: tooltip.x,
              top: tooltip.y,
              boxShadow: "0 16px 34px var(--color-region-map-tooltip-shadow)",
            }}
          >
            <p className="text-base font-black text-main dark:text-primary">{hoveredRegion.name}</p>

            <div className="mt-3 space-y-2 border-b border-primary/10 pb-3 dark:border-primarydark">
              <StatRow label="Jami buyurtmalar" value={hoveredRegion.stats.orderCount.toLocaleString("uz-UZ")} />
              <StatRow label="Tumanlar" value={hoveredRegion.stats.districtCount.toLocaleString("uz-UZ")} />
              <StatRow label="Kuryerlar" value={hoveredRegion.stats.activeCouriers.toLocaleString("uz-UZ")} />
            </div>

            <div className="mt-3 space-y-2">
              <StatRow
                label="Faollik darajasi"
                value={
                  getLevel(hoveredRegion.stats.orderCount, maxOrders) === "xhigh"
                    ? "Juda yuqori"
                    : getLevel(hoveredRegion.stats.orderCount, maxOrders) === "high"
                      ? "Yuqori"
                      : getLevel(hoveredRegion.stats.orderCount, maxOrders) === "medium"
                        ? "O'rtacha"
                        : "Past"
                }
                accent
              />
              <StatRow
                label="Qamrov"
                value={
                  hoveredRegion.stats.districtCount > 0
                    ? `${Math.round((hoveredRegion.stats.activeCouriers / hoveredRegion.stats.districtCount) * 100)}%`
                    : "0%"
                }
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
        {legendItems.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-sm text-main/75 dark:text-primary/75">
            <span className={`h-4 w-4 rounded-md ${item.className}`} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-primary/10 bg-main/5 p-4 dark:border-primarydark dark:bg-primary/5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-main/15 text-main dark:bg-main/20 dark:text-primary">
              <Building2 size={18} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-main/65 dark:text-primary/60">
                Viloyatlar
              </p>
              <p className="text-xl font-black text-main dark:text-primary">{regions.length}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-primary/10 bg-main/5 p-4 dark:border-primarydark dark:bg-primary/5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-main/15 text-main dark:bg-main/20 dark:text-primary">
              <Truck size={18} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-main/65 dark:text-primary/60">
                Aktiv kuryerlar
              </p>
              <p className="text-xl font-black text-main dark:text-primary">
                {regions.reduce((sum, region) => sum + region.stats.activeCouriers, 0).toLocaleString("uz-UZ")}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-primary/10 bg-main/5 p-4 dark:border-primarydark dark:bg-primary/5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-main/15 text-main dark:bg-main/20 dark:text-primary">
              <Package size={18} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-main/65 dark:text-primary/60">
                Jami buyurtmalar
              </p>
              <p className="text-xl font-black text-main dark:text-primary">
                {regions.reduce((sum, region) => sum + region.stats.orderCount, 0).toLocaleString("uz-UZ")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(UzbekistanRegionMap);
