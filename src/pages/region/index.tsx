import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import uzbekistan from "@svg-maps/uzbekistan";
import {
  AlertCircle,
  Building2,
  MapPinned,
  Package,
  RefreshCcw,
  Search,
  Truck,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";

const USE_MOCK_REGIONS = false;
type RegionApiItem = {
  id: string;
  apiId?: string;
  name: string;
  nameUz?: string;
  districtCount: number;
  activeCouriers: number;
  ordersCount: number;
  districts?: DistrictApiItem[];
  coordinates?: {
    x: number;
    y: number;
  };
};

type DistrictApiItem = {
  id: string;
  name: string;
  activeCouriers: number;
  ordersCount: number;
  status: "active" | "inactive";
};

type RegionShapeBinding = {
  mapId: string;
  duplicateIndex?: number;
  regionId: string;
  fallbackLabel: string;
  labelX: number;
  labelY: number;
};

type MapLocation = {
  id: string;
  path: string;
  duplicateIndex: number;
};

type TooltipState = {
  regionId: string;
  x: number;
  y: number;
};

const UZBEKISTAN_REGIONS: RegionApiItem[] = [
  { id: "toshkent-sh", apiId: "toshkent-sh", name: "Toshkent shahri", nameUz: "Toshkent shahri", districtCount: 11, activeCouriers: 342, ordersCount: 8920 },
  { id: "toshkent-v", apiId: "toshkent-v", name: "Toshkent viloyati", nameUz: "Toshkent viloyati", districtCount: 15, activeCouriers: 187, ordersCount: 4230 },
  { id: "samarqand", apiId: "samarqand", name: "Samarqand viloyati", nameUz: "Samarqand viloyati", districtCount: 14, activeCouriers: 143, ordersCount: 3180 },
  { id: "fargona", apiId: "fargona", name: "Farg'ona viloyati", nameUz: "Farg'ona viloyati", districtCount: 15, activeCouriers: 198, ordersCount: 4560 },
  { id: "andijon", apiId: "andijon", name: "Andijon viloyati", nameUz: "Andijon viloyati", districtCount: 14, activeCouriers: 167, ordersCount: 3890 },
  { id: "namangan", apiId: "namangan", name: "Namangan viloyati", nameUz: "Namangan viloyati", districtCount: 11, activeCouriers: 134, ordersCount: 2970 },
  { id: "qashqadaryo", apiId: "qashqadaryo", name: "Qashqadaryo viloyati", nameUz: "Qashqadaryo viloyati", districtCount: 13, activeCouriers: 98, ordersCount: 1840 },
  { id: "surxondaryo", apiId: "surxondaryo", name: "Surxondaryo viloyati", nameUz: "Surxondaryo viloyati", districtCount: 14, activeCouriers: 76, ordersCount: 1320 },
  { id: "buxoro", apiId: "buxoro", name: "Buxoro viloyati", nameUz: "Buxoro viloyati", districtCount: 11, activeCouriers: 89, ordersCount: 1650 },
  { id: "xorazm", apiId: "xorazm", name: "Xorazm viloyati", nameUz: "Xorazm viloyati", districtCount: 10, activeCouriers: 67, ordersCount: 1240 },
  { id: "navoiy", apiId: "navoiy", name: "Navoiy viloyati", nameUz: "Navoiy viloyati", districtCount: 8, activeCouriers: 54, ordersCount: 980 },
  { id: "jizzax", apiId: "jizzax", name: "Jizzax viloyati", nameUz: "Jizzax viloyati", districtCount: 12, activeCouriers: 61, ordersCount: 1120 },
  { id: "sirdaryo", apiId: "sirdaryo", name: "Sirdaryo viloyati", nameUz: "Sirdaryo viloyati", districtCount: 9, activeCouriers: 43, ordersCount: 870 },
  { id: "qoraqalpogiston", apiId: "qoraqalpogiston", name: "Qoraqalpog'iston", nameUz: "Qoraqalpog'iston", districtCount: 16, activeCouriers: 58, ordersCount: 1050 },
];

const REGION_SHAPE_BINDINGS: RegionShapeBinding[] = [
  { mapId: "karakalpakstan", regionId: "qoraqalpogiston", fallbackLabel: "Qoraqalpog'iston", labelX: 208, labelY: 126 },
  { mapId: "xorazm", regionId: "xorazm", fallbackLabel: "Xorazm", labelX: 270, labelY: 244 },
  { mapId: "navoiy", regionId: "navoiy", fallbackLabel: "Navoiy", labelX: 458, labelY: 182 },
  { mapId: "bukhara", regionId: "buxoro", fallbackLabel: "Buxoro", labelX: 432, labelY: 326 },
  { mapId: "samarqand", regionId: "samarqand", fallbackLabel: "Samarqand", labelX: 540, labelY: 352 },
  { mapId: "jizzakh", regionId: "jizzax", fallbackLabel: "Jizzax", labelX: 614, labelY: 310 },
  { mapId: "sirdaryo", regionId: "sirdaryo", fallbackLabel: "Sirdaryo", labelX: 670, labelY: 300 },
  { mapId: "tashkent", duplicateIndex: 0, regionId: "toshkent-sh", fallbackLabel: "Toshkent sh.", labelX: 650, labelY: 276 },
  { mapId: "tashkent", duplicateIndex: 1, regionId: "toshkent-v", fallbackLabel: "Toshkent vil.", labelX: 720, labelY: 226 },
  { mapId: "namangan", regionId: "namangan", fallbackLabel: "Namangan", labelX: 744, labelY: 267 },
  { mapId: "andijan", regionId: "andijon", fallbackLabel: "Andijon", labelX: 778, labelY: 288 },
  { mapId: "fergana", regionId: "fargona", fallbackLabel: "Farg'ona", labelX: 733, labelY: 316 },
  { mapId: "qashqadaryo", regionId: "qashqadaryo", fallbackLabel: "Qashqadaryo", labelX: 514, labelY: 440 },
  { mapId: "surxondaryo", regionId: "surxondaryo", fallbackLabel: "Surxondaryo", labelX: 580, labelY: 502 },
];


const DISTRICT_NAME_BANK: Record<string, string[]> = {
  "toshkent-sh": ["Yunusobod", "Chilonzor", "Olmazor", "Shayxontohur", "Mirobod", "Mirzo Ulug'bek", "Uchtepa", "Yakkasaroy", "Yashnobod", "Bektemir", "Sergeli"],
  "toshkent-v": ["Zangiota", "Qibray", "Chirchiq", "Bekobod", "Bo'ka", "Ohangaron", "Yangiyo'l", "Parkent", "Piskent", "Oqqo'rg'on", "Quyichirchiq", "Yuqorichirchiq", "Bo'stonliq", "Toshkent", "O'rtachirchiq"],
  samarqand: ["Samarqand", "Urgut", "Kattaqo'rg'on", "Ishtixon", "Jomboy", "Toyloq", "Payariq", "Nurobod", "Pastdarg'om", "Bulung'ur", "Qo'shrabot", "Paxtachi", "Oqdaryo", "Narpay"],
  fargona: ["Farg'ona", "Qo'qon", "Marg'ilon", "Quva", "Quvasoy", "Rishton", "Beshariq", "Bag'dod", "Dang'ara", "Furqat", "Oltiariq", "So'x", "Toshloq", "Yozyovon", "Uchko'prik"],
  andijon: ["Andijon", "Asaka", "Baliqchi", "Bo'ston", "Buloqboshi", "Izboskan", "Jalaquduq", "Marhamat", "Oltinko'l", "Paxtaobod", "Qo'rg'ontepa", "Shahrixon", "Ulug'nor", "Xo'jaobod"],
  namangan: ["Namangan", "Chortoq", "Chust", "Kosonsoy", "Mingbuloq", "Norin", "Pop", "To'raqo'rg'on", "Uychi", "Uchqo'rg'on", "Yangiqo'rg'on"],
  qashqadaryo: ["Qarshi", "Shahrisabz", "Koson", "G'uzor", "Kasbi", "Kitob", "Muborak", "Nishon", "Chiroqchi", "Yakkabog'", "Qamashi", "Dehqonobod", "Mirishkor"],
  surxondaryo: ["Termiz", "Angor", "Bandixon", "Boysun", "Denov", "Jarqo'rg'on", "Muzrabot", "Oltinsoy", "Qiziriq", "Qumqo'rg'on", "Sariosiyo", "Sherobod", "Sho'rchi", "Uzun"],
  buxoro: ["Buxoro", "G'ijduvon", "Jondor", "Kogon", "Olot", "Peshku", "Qorako'l", "Qorovulbozor", "Romitan", "Shofirkon", "Vobkent"],
  xorazm: ["Urganch", "Xiva", "Bog'ot", "Gurlan", "Hazorasp", "Xonqa", "Qo'shko'pir", "Shovot", "Urganch tumani", "Yangiariq"],
  navoiy: ["Navoiy", "Zarafshon", "Karmana", "Konimex", "Navbahor", "Nurota", "Tomdi", "Xatirchi"],
  jizzax: ["Jizzax", "Arnasoy", "Baxmal", "Do'stlik", "Forish", "G'allaorol", "Mirzacho'l", "Paxtakor", "Sharof Rashidov", "Yangiobod", "Zafarobod", "Zomin"],
  sirdaryo: ["Guliston", "Boyovut", "Mirzaobod", "Oqoltin", "Sardoba", "Sayxunobod", "Sirdaryo", "Xovos", "Shirin"],
  qoraqalpogiston: ["Nukus", "Amudaryo", "Beruniy", "Chimboy", "Ellikqala", "Kegeyli", "Mo'ynoq", "Qanliko'l", "Qorao'zak", "Qo'ng'irot", "Shumanay", "Taxiatosh", "Taxtako'pir", "To'rtko'l", "Xo'jayli", "Bo'zatov"],
};

const REGION_FILL_SCALE = [
  "var(--color-region-map-low)",
  "var(--color-region-map-medium)",
  "var(--color-main)",
  "var(--color-region-map-high)",
  "var(--color-region-map-xhigh)",
];

const normalizeRegionName = (value: string) =>
  value
    .toLocaleLowerCase()
    .replace(/oʻ|o'/g, "o")
    .replace(/gʻ|g'/g, "g")
    .replace(/qoraqalpog'iston respublikasi/g, "qoraqalpogiston")
    .replace(/qoraqalpog‘iston respublikasi/g, "qoraqalpogiston")
    .replace(/qoraqalpog'iston/g, "qoraqalpogiston")
    .replace(/qoraqalpog‘iston/g, "qoraqalpogiston")
    .replace(/fargʻona|farg'ona/g, "fargona")
    .replace(/andijan/g, "andijon")
    .replace(/bukhara/g, "buxoro")
    .replace(/jizzakh/g, "jizzax")
    .replace(/karakalpakstan/g, "qoraqalpogiston")
    .replace(/tashkent city/g, "toshkentshahri")
    .replace(/tashkent region/g, "toshkentviloyati")
    .replace(/toshkent shahri/g, "toshkentshahri")
    .replace(/toshkent viloyati/g, "toshkentviloyati")
    .replace(/respublikasi|respublika|viloyati|viloyat|shahri|shahar/g, "")
    .replace(/\s+/g, "")
    .trim();

const getCanonicalRegionId = (value: string) => {
  const normalized = normalizeRegionName(value);

  const regionIdMap: Record<string, string> = {
    qoraqalpogiston: "qoraqalpogiston",
    xorazm: "xorazm",
    navoiy: "navoiy",
    buxoro: "buxoro",
    samarqand: "samarqand",
    jizzax: "jizzax",
    sirdaryo: "sirdaryo",
    toshkent: "toshkent-v",
    toshkentviloyati: "toshkent-v",
    toshkentsh: "toshkent-sh",
    toshkentshahri: "toshkent-sh",
    namangan: "namangan",
    andijon: "andijon",
    fargona: "fargona",
    qashqadaryo: "qashqadaryo",
    surxondaryo: "surxondaryo",
  };

  return regionIdMap[normalized] ?? normalized;
};

const getMapLabel = (value: string) =>
  value
    .replace("Qoraqalpog'iston Respublikasi", "Qoraqalpog'.")
    .replace("Qoraqalpog‘iston Respublikasi", "Qoraqalpog'.")
    .replace(" viloyati", "")
    .replace(" shahri", " sh.");

const getRegionPathPriority = ({
  regionId,
  selectedRegionId,
  hoveredRegionId,
}: {
  regionId: string;
  selectedRegionId: string | null;
  hoveredRegionId: string | null;
}) => {
  if (regionId === selectedRegionId) return 2;
  if (regionId === hoveredRegionId) return 1;
  return 0;
};

const formatNumber = (value: number) => value.toLocaleString("uz-UZ");

const getRegionFill = (ordersCount: number, maxOrders: number) => {
  if (maxOrders <= 0) return REGION_FILL_SCALE[0];
  const ratio = ordersCount / maxOrders;
  if (ratio >= 0.85) return REGION_FILL_SCALE[4];
  if (ratio >= 0.65) return REGION_FILL_SCALE[3];
  if (ratio >= 0.45) return REGION_FILL_SCALE[2];
  if (ratio >= 0.2) return REGION_FILL_SCALE[1];
  return REGION_FILL_SCALE[0];
};

const getRegionActivityText = (ordersCount: number, maxOrders: number) => {
  if (maxOrders <= 0) return "Past";
  const ratio = ordersCount / maxOrders;
  if (ratio >= 0.85) return "Juda yuqori";
  if (ratio >= 0.65) return "Yuqori";
  if (ratio >= 0.45) return "Yaxshi";
  if (ratio >= 0.2) return "O'rtacha";
  return "Past";
};

const unwrapArray = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (Array.isArray((value as { data?: unknown[] })?.data)) {
    return (value as { data: T[] }).data;
  }
  if (Array.isArray((value as { items?: unknown[] })?.items)) {
    return (value as { items: T[] }).items;
  }
  if (Array.isArray((value as { data?: { items?: unknown[] } })?.data?.items)) {
    return (value as { data: { items: T[] } }).data.items;
  }
  return [];
};

const toNumber = (value: unknown, fallback = 0) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

const normalizeDistrictItem = (
  value: unknown,
  region: {
    id?: string | number;
    name?: string;
    activeCouriers?: number | string;
    ordersCount?: number | string;
    active_couriers?: number | string;
    orders_count?: number | string;
  },
  index: number,
  totalDistricts: number,
): DistrictApiItem => {
  const district = value as {
    id?: string | number;
    name?: string;
    activeCouriers?: number | string;
    ordersCount?: number | string;
    active_couriers?: number | string;
    orders_count?: number | string;
    status?: "active" | "inactive";
  };

  const safeDistrictCount = Math.max(totalDistricts, 1);
  const regionCouriers = toNumber(region.activeCouriers ?? region.active_couriers, 0);
  const regionOrders = toNumber(region.ordersCount ?? region.orders_count, 0);

  return {
    id: String(district.id ?? `${region.id}-district-${index + 1}`),
    name: district.name ?? `${region.name ?? "Hudud"} ${index + 1}-tuman`,
    activeCouriers: toNumber(
      district.activeCouriers ?? district.active_couriers,
      Math.max(0, Math.round(regionCouriers / safeDistrictCount) + (index % 3)),
    ),
    ordersCount: toNumber(
      district.ordersCount ?? district.orders_count,
      Math.max(0, Math.round(regionOrders / safeDistrictCount) + index * 3),
    ),
    status: district.status ?? (index % 5 === 0 ? "inactive" : "active"),
  };
};

const normalizeRegionItem = (value: unknown): RegionApiItem | null => {
  const region = value as {
    id?: string | number;
    name?: string;
    nameUz?: string;
    districtCount?: number | string;
    activeCouriers?: number | string;
    ordersCount?: number | string;
    district_count?: number | string;
    active_couriers?: number | string;
    orders_count?: number | string;
    districts?: unknown[];
    district?: unknown[];
    coordinates?: { x?: number; y?: number };
  };

  if (!region?.id || !region?.name) return null;

  const districtsLength = Array.isArray(region.districts)
    ? region.districts.length
    : Array.isArray(region.district)
      ? region.district.length
      : 0;

  const rawDistricts = Array.isArray(region.districts)
    ? region.districts
    : Array.isArray(region.district)
      ? region.district
      : [];

  const normalizedDistricts = rawDistricts.map((district, index) =>
    normalizeDistrictItem(district, region, index, rawDistricts.length),
  );

  return {
    id: getCanonicalRegionId(region.name),
    apiId: String(region.id),
    name: region.name,
    nameUz: region.nameUz ?? region.name,
    districtCount: toNumber(region.districtCount ?? region.district_count, districtsLength),
    activeCouriers: toNumber(region.activeCouriers ?? region.active_couriers, 0),
    ordersCount: toNumber(region.ordersCount ?? region.orders_count, 0),
    districts: normalizedDistricts,
    coordinates:
      typeof region.coordinates?.x === "number" && typeof region.coordinates?.y === "number"
        ? { x: region.coordinates.x, y: region.coordinates.y }
        : undefined,
  };
};

const generateMockDistricts = (region: RegionApiItem): DistrictApiItem[] => {
  const names = DISTRICT_NAME_BANK[region.id] ?? [];
  const count = region.districtCount;

  return Array.from({ length: count }, (_, index) => {
    const baseOrder = Math.max(24, Math.round(region.ordersCount / count));
    const variance = ((index % 4) - 1) * 14;
    const ordersCount = Math.max(10, baseOrder + variance * (index + 1));
    const activeCouriers = Math.max(1, Math.round(region.activeCouriers / count) + (index % 3));
    const status = index % 5 === 0 ? "inactive" : "active";

    return {
      id: `${region.id}-district-${index + 1}`,
      name: names[index] ?? `${region.name} ${index + 1}-tuman`,
      activeCouriers,
      ordersCount,
      status,
    };
  });
};

const MOCK_DISTRICTS_BY_REGION = UZBEKISTAN_REGIONS.reduce<Record<string, DistrictApiItem[]>>((acc, region) => {
  acc[region.id] = generateMockDistricts(region);
  return acc;
}, {});

const MOCK_REGIONS_WITH_DISTRICTS = UZBEKISTAN_REGIONS.map((region) => ({
  ...region,
  districts: MOCK_DISTRICTS_BY_REGION[region.id] ?? [],
}));

const mapLocations = (uzbekistan.locations as { id: string; path: string }[])
  .filter((location) => location.id !== "aral-sea")
  .reduce<MapLocation[]>((acc, location) => {
    const duplicateIndex = acc.filter((item) => item.id === location.id).length;
    acc.push({
      id: location.id,
      path: location.path,
      duplicateIndex,
    });
    return acc;
  }, []);

const findShapeBinding = (location: MapLocation) =>
  REGION_SHAPE_BINDINGS.find(
    (binding) =>
      binding.mapId === location.id && (binding.duplicateIndex ?? 0) === location.duplicateIndex,
  );

const getRegions = async (): Promise<RegionApiItem[]> => {
  if (USE_MOCK_REGIONS) {
    await new Promise((resolve) => window.setTimeout(resolve, 500));
    return MOCK_REGIONS_WITH_DISTRICTS;
  }

  const response = await api.get(API_ENDPOINTS.REGIONS.BASE);

  return unwrapArray<unknown>(response.data)
    .map(normalizeRegionItem)
    .filter((region): region is RegionApiItem => region !== null);
};

// --- SECTION: useDebouncedValue ---
const useDebouncedValue = <T,>(value: T, delay = 300) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timeoutId);
  }, [delay, value]);

  return debouncedValue;
};

// --- SECTION: MapTooltip ---
const MapTooltip = ({
  region,
  tooltip,
  maxOrders,
}: {
  region: RegionApiItem;
  tooltip: TooltipState;
  maxOrders: number;
}) => (
  <div
    className="pointer-events-none absolute z-20 w-[17rem] rounded-[1.5rem] border border-[var(--color-glass-border)] bg-[var(--color-surface-elevated)]/95 p-4 backdrop-blur-md dark:bg-[var(--color-surface-elevated-dark)]/95"
    style={{
      left: tooltip.x,
      top: tooltip.y,
      boxShadow: "0 18px 34px var(--color-region-map-tooltip-shadow)",
    }}
  >
    <p className="text-base font-black text-[var(--color-maindark)] dark:text-[var(--color-primary)]">{region.nameUz ?? region.name}</p>
    <div className="mt-3 space-y-2 text-sm text-[var(--color-table-label)] dark:text-[var(--color-table-label-dark)]">
      <div className="flex items-center justify-between gap-4">
        <span>Tumanlar</span>
        <strong>{formatNumber(region.districtCount)}</strong>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span>Aktiv kuryerlar</span>
        <strong>{formatNumber(region.activeCouriers)}</strong>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span>Buyurtmalar</span>
        <strong>{formatNumber(region.ordersCount)}</strong>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span>Faollik</span>
        <strong>{getRegionActivityText(region.ordersCount, maxOrders)}</strong>
      </div>
    </div>
  </div>
);

// --- SECTION: RegionMapSkeleton ---
const RegionMapSkeleton = () => (
  <div className="rounded-[2rem] border border-[var(--color-border-soft)] bg-[var(--color-primary)]/85 p-5 dark:bg-[var(--color-card-surface-strong)]">
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="rounded-[1.75rem] bg-[var(--color-sidebar)] p-6 dark:bg-[var(--color-card-surface)]">
        <div className="h-[28rem] animate-pulse rounded-[1.5rem] bg-[var(--color-main-soft)]" />
      </div>
      <div className="space-y-4 rounded-[1.75rem] bg-[var(--color-sidebar)] p-5 dark:bg-[var(--color-card-surface)]">
        <div className="h-10 animate-pulse rounded-2xl bg-[var(--color-main-soft)]" />
        <div className="h-24 animate-pulse rounded-2xl bg-[var(--color-main-soft)]" />
        <div className="h-24 animate-pulse rounded-2xl bg-[var(--color-main-soft)]" />
        <div className="h-24 animate-pulse rounded-2xl bg-[var(--color-main-soft)]" />
      </div>
    </div>
  </div>
);

// --- SECTION: RegionsPage ---
const RegionsPage = () => {
  const mapViewportRef = useRef<HTMLDivElement | null>(null);
  const sidebarSearchRef = useRef<HTMLInputElement | null>(null);

  const [regions, setRegions] = useState<RegionApiItem[]>([]);
  const [regionsLoading, setRegionsLoading] = useState(true);
  const [regionsError, setRegionsError] = useState<string | null>(null);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [districtSearch, setDistrictSearch] = useState("");
  const [zoom, setZoom] = useState(1);
  const [isUsingMockData, setIsUsingMockData] = useState(USE_MOCK_REGIONS);

  const debouncedDistrictSearch = useDebouncedValue(districtSearch, 250);

  const selectedRegion = useMemo(
    () => regions.find((region) => region.id === selectedRegionId) ?? null,
    [regions, selectedRegionId],
  );

  const districts = useMemo(
    () => selectedRegion?.districts ?? [],
    [selectedRegion],
  );

  const hoveredRegion = useMemo(
    () => regions.find((region) => region.id === hoveredRegionId) ?? null,
    [hoveredRegionId, regions],
  );

  const regionsById = useMemo(
    () =>
      regions.reduce<Record<string, RegionApiItem>>((acc, region) => {
        acc[region.id] = region;
        return acc;
      }, {}),
    [regions],
  );

  const maxOrders = useMemo(
    () => Math.max(...regions.map((region) => region.ordersCount), 0),
    [regions],
  );

  const filteredDistricts = useMemo(() => {
    const keyword = debouncedDistrictSearch.trim().toLocaleLowerCase();
    if (!keyword) return districts;

    return districts.filter((district) => district.name.toLocaleLowerCase().includes(keyword));
  }, [debouncedDistrictSearch, districts]);

  const fetchRegionsData = useCallback(async () => {
    setRegionsLoading(true);
    setRegionsError(null);

    try {
      const data = await getRegions();
      setRegions(data);
      setSelectedRegionId((current) =>
        current && data.some((region) => region.id === current) ? current : null,
      );
      setIsUsingMockData(USE_MOCK_REGIONS);
    } catch {
      if (!USE_MOCK_REGIONS) {
        setRegions(MOCK_REGIONS_WITH_DISTRICTS);
        setSelectedRegionId((current) =>
          current && MOCK_REGIONS_WITH_DISTRICTS.some((region) => region.id === current) ? current : null,
        );
        setIsUsingMockData(true);
        setRegionsError("`/region` API'dan ma'lumot olinmadi. Vaqtincha mock regionlar ko'rsatildi.");
      } else {
        setRegionsError("Hududlar ma'lumotini yuklashda xatolik yuz berdi.");
      }
    } finally {
      setRegionsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRegionsData();
  }, [fetchRegionsData]);

  useEffect(() => {
    if (selectedRegionId) {
      sidebarSearchRef.current?.focus();
    }
  }, [selectedRegionId]);

  const updateTooltipPosition = useCallback(
    (event: ReactMouseEvent<SVGPathElement>, regionId: string) => {
      const bounds = mapViewportRef.current?.getBoundingClientRect();
      if (!bounds) return;

      setTooltip({
        regionId,
        x: event.clientX - bounds.left + 18,
        y: event.clientY - bounds.top - 24,
      });
      setHoveredRegionId(regionId);
    },
    [],
  );

  const handleRegionSelect = useCallback((regionId: string) => {
    setSelectedRegionId(regionId);
  }, []);

  const handleMapKeyDown = useCallback(
    (event: KeyboardEvent<SVGPathElement>, regionId: string) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleRegionSelect(regionId);
      }
    },
    [handleRegionSelect],
  );

  const resetSelection = useCallback(() => {
    setSelectedRegionId(null);
    setDistrictSearch("");
    setTooltip(null);
    setHoveredRegionId(null);
  }, []);

  const zoomIn = useCallback(() => {
    setZoom((current) => Math.min(Number((current + 0.15).toFixed(2)), 1.8));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((current) => Math.max(Number((current - 0.15).toFixed(2)), 1));
  }, []);

  const mapTransformStyle = useMemo<CSSProperties>(
    () => ({
      transform: `scale(${zoom})`,
      transformOrigin: "center center",
      transition: "transform 250ms ease",
    }),
    [zoom],
  );

  const sortedMapLocations = useMemo(
    () =>
      [...mapLocations].sort((left, right) => {
        const leftBinding = findShapeBinding(left);
        const rightBinding = findShapeBinding(right);

        const leftPriority = getRegionPathPriority({
          regionId: leftBinding?.regionId ?? "",
          selectedRegionId,
          hoveredRegionId,
        });
        const rightPriority = getRegionPathPriority({
          regionId: rightBinding?.regionId ?? "",
          selectedRegionId,
          hoveredRegionId,
        });

        return leftPriority - rightPriority;
      }),
    [hoveredRegionId, selectedRegionId],
  );

  if (regionsLoading) {
    return (
      <div className="flex min-h-full flex-col gap-6 rounded-[2rem] bg-[var(--color-sidebar)] p-4 sm:p-5 lg:p-6 dark:bg-[var(--color-page-surface)]">
        <RegionMapSkeleton />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-full flex-col gap-6 rounded-[2rem] bg-[var(--color-sidebar)] p-4 sm:p-5 lg:p-6 dark:bg-[var(--color-page-surface)]">
      {regionsError ? (
        <div className="flex items-start justify-between gap-4 rounded-[1.5rem] border border-[var(--color-warning)]/25 bg-[var(--color-primary)]/85 px-5 py-4 dark:bg-[var(--color-card-surface-strong)]">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-2xl bg-[var(--color-warning)]/15 p-2 text-[var(--color-warning)]">
              <AlertCircle size={18} />
            </div>
            <div>
              <p className="font-bold text-[var(--color-maindark)] dark:text-[var(--color-primary)]">Ma'lumotlar ogohlantirishi</p>
              <p className="mt-1 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-text-muted-dark)]">
                {regionsError}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void fetchRegionsData()}
            className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-border-soft)] px-4 py-2 text-sm font-semibold text-[var(--color-main)] transition hover:bg-[var(--color-main-soft)]"
          >
            <RefreshCcw size={16} />
            Qayta urinish
          </button>
        </div>
      ) : null}

      <section className="rounded-[2rem] border border-[var(--color-border-soft)] bg-[var(--color-primary)]/90 p-5 shadow-[0_24px_48px_var(--color-main-soft)] dark:bg-[var(--color-card-surface-strong)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)] dark:text-[var(--color-text-muted-dark)]">
              Interaktiv hudud xaritasi
            </p>
            <h1 className="mt-2 text-2xl font-black text-[var(--color-maindark)] dark:text-[var(--color-primary)]">
              O'zbekiston viloyatlari xaritasi
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-[var(--color-text-muted)] dark:text-[var(--color-text-muted-dark)]">
              Region ustiga bosganingizda shu hudud bo'yicha barcha tafsilotlar popup ichida ochiladi.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={zoomOut}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--color-border-soft)] text-[var(--color-main)] transition hover:bg-[var(--color-main-soft)]"
              aria-label="Xaritani kichraytirish"
            >
              <ZoomOut size={18} />
            </button>
            <button
              type="button"
              onClick={zoomIn}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--color-border-soft)] text-[var(--color-main)] transition hover:bg-[var(--color-main-soft)]"
              aria-label="Xaritani kattalashtirish"
            >
              <ZoomIn size={18} />
            </button>
            <button
              type="button"
              onClick={resetSelection}
              className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-border-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-main)] transition hover:bg-[var(--color-main-soft)]"
            >
              <RefreshCcw size={16} />
              Tanlovni tozalash
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-[1.8rem] border border-[var(--color-border-soft)] bg-[linear-gradient(135deg,var(--color-primary)_0%,var(--color-sidebar)_48%,var(--color-main-soft)_100%)] p-4 dark:bg-[linear-gradient(135deg,var(--color-card-surface-strong)_0%,var(--color-card-surface)_62%,var(--color-main-soft)_100%)]">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--color-maindark)] dark:text-[var(--color-primary)]">
                Choropleth daraja: pastdan yuqoriga
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-muted-dark)]">
                Rang kuchaygani sari buyurtma hajmi yuqoriroq bo'ladi
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)] dark:text-[var(--color-text-muted-dark)]">
                Kam
              </span>
              <div
                className="h-3 w-36 rounded-full"
                style={{
                  background:
                    "linear-gradient(90deg, var(--color-region-map-low) 0%, var(--color-region-map-medium) 25%, var(--color-main) 50%, var(--color-region-map-high) 75%, var(--color-region-map-xhigh) 100%)",
                }}
              />
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)] dark:text-[var(--color-text-muted-dark)]">
                Ko'p
              </span>
            </div>
          </div>

          <div
            ref={mapViewportRef}
            className="relative overflow-hidden rounded-[1.6rem] border border-[var(--color-glass-border)] bg-[var(--color-surface)]/65 p-3 dark:bg-white/[0.045]"
          >
            <div className="mx-auto max-w-[56rem]" style={mapTransformStyle}>
              <svg
                viewBox={uzbekistan.viewBox}
                className="h-auto w-full"
                role="img"
                aria-label="O'zbekiston regionlari xaritasi"
                onMouseLeave={() => {
                  setTooltip(null);
                  setHoveredRegionId(null);
                }}
              >
                {sortedMapLocations.map((location, index) => {
                  const binding = findShapeBinding(location);
                  if (!binding) return null;

                  const region = regionsById[binding.regionId];
                  if (!region) return null;

                  const isSelected = selectedRegionId === region.id;
                  const isHovered = hoveredRegionId === region.id;
                  const fill = getRegionFill(region.ordersCount, maxOrders);
                  const label = getMapLabel(region.nameUz ?? region.name);

                  return (
                    <g key={`${binding.regionId}-${index}`}>
                      <path
                        d={location.path}
                        data-region-id={region.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`${region.nameUz ?? region.name}, ${region.districtCount} ta tuman, ${region.activeCouriers} ta aktiv kuryer, ${region.ordersCount} ta buyurtma`}
                        onClick={() => handleRegionSelect(region.id)}
                        onKeyDown={(event) => handleMapKeyDown(event, region.id)}
                        onMouseMove={(event) => updateTooltipPosition(event, region.id)}
                        onFocus={() => setHoveredRegionId(region.id)}
                        onBlur={() => setHoveredRegionId(null)}
                        className="cursor-pointer transition-all duration-300 focus:outline-none"
                        style={{
                          fill: isSelected ? "var(--color-main)" : fill,
                          stroke: isSelected ? "var(--color-primary)" : isHovered ? "var(--color-main)" : "var(--color-region-map-stroke)",
                          strokeWidth: isSelected ? 6 : isHovered ? 4.2 : 2.3,
                          opacity: selectedRegionId && !isSelected ? 0.78 : 1,
                          vectorEffect: "non-scaling-stroke",
                          filter:
                            isSelected
                              ? "drop-shadow(0 0 10px var(--color-primary)) drop-shadow(0 0 18px var(--color-main))"
                              : isHovered
                                ? "drop-shadow(0 0 14px var(--color-main-soft))"
                                : "drop-shadow(0 0 0 transparent)",
                          transform: isSelected ? "translateY(-1px)" : "translateY(0)",
                          transformBox: "fill-box",
                          transformOrigin: "center",
                        }}
                      />
                      {isSelected ? (
                        <path
                          d={location.path}
                          pointerEvents="none"
                          style={{
                            fill: "transparent",
                            stroke: "var(--color-primary)",
                            strokeWidth: 2.2,
                            vectorEffect: "non-scaling-stroke",
                            filter: "drop-shadow(0 0 8px var(--color-primary))",
                          }}
                        />
                      ) : null}
                      <text
                        x={region.coordinates?.x ?? binding.labelX}
                        y={region.coordinates?.y ?? binding.labelY}
                        textAnchor="middle"
                        className="pointer-events-none select-none fill-[var(--color-region-map-label)] text-[14px] font-bold"
                        style={{
                          opacity: selectedRegionId && !isSelected ? 0.65 : 1,
                          fontSize: isSelected ? 15 : 14,
                        }}
                      >
                        {label ?? binding.fallbackLabel}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {tooltip && hoveredRegion ? (
              <MapTooltip region={hoveredRegion} tooltip={tooltip} maxOrders={maxOrders} />
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-muted-dark)]">
            <span className="rounded-full bg-[var(--color-main-soft)] px-3 py-1.5 font-semibold text-[var(--color-main)]">
              {isUsingMockData ? "Aralash mock/API" : "API ma'lumoti"}
            </span>
            <span>Tanlangan hudud haqida ma'lumot modal popup ichida ochiladi.</span>
          </div>
        </div>
      </section>

      {selectedRegion ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-background-deep)]/70 px-4 py-6 backdrop-blur-sm"
          onClick={resetSelection}
        >
          <div
            className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-[2rem] border border-[var(--color-border-soft)] bg-[var(--color-primary)] shadow-[0_28px_60px_var(--color-main-soft)] dark:bg-[var(--color-card-surface-strong)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-main-soft)] text-[var(--color-main)]">
                  <MapPinned size={22} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)] dark:text-[var(--color-text-muted-dark)]">
                    Hudud tafsiloti
                  </p>
                  <h2 className="text-lg font-black text-[var(--color-maindark)] dark:text-[var(--color-primary)]">
                    {selectedRegion.nameUz ?? selectedRegion.name}
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={resetSelection}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--color-border-soft)] text-[var(--color-main)] transition hover:bg-[var(--color-main-soft)]"
                aria-label="Popupni yopish"
              >
                <X size={18} />
              </button>
            </div>

            <div className="custom-scrollbar max-h-[calc(92vh-5rem)] overflow-y-auto p-5 sm:p-6">
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {[
                    { label: "Tuman", value: selectedRegion.districtCount, icon: Building2 },
                    { label: "Kuryer", value: selectedRegion.activeCouriers, icon: Truck },
                    { label: "Buyurtma", value: selectedRegion.ordersCount, icon: Package },
                  ].map(({ label, value, icon: Icon }) => (
                    <div key={label} className="rounded-2xl bg-[var(--color-main-soft)]/65 p-4 dark:bg-[var(--color-background-soft)]">
                      <Icon size={18} className="text-[var(--color-main)]" />
                      <p className="mt-2 text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-muted-dark)]">
                        {label}
                      </p>
                      <p className="mt-1 text-lg font-bold text-[var(--color-maindark)] dark:text-[var(--color-primary)]">
                        {formatNumber(value)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="rounded-[1.5rem] border border-[var(--color-border-soft)] bg-[var(--color-primary)]/70 p-4 dark:bg-[var(--color-card-surface)]">
                  <label
                    htmlFor="district-search"
                    className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)] dark:text-[var(--color-text-muted-dark)]"
                  >
                    Tuman qidiruvi
                  </label>
                  <div className="flex items-center gap-2 rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-sidebar)] px-3 py-3 dark:bg-white/[0.055]">
                    <Search size={16} className="text-[var(--color-text-muted)] dark:text-[var(--color-text-muted-dark)]" />
                    <input
                      ref={sidebarSearchRef}
                      id="district-search"
                      type="text"
                      value={districtSearch}
                      onChange={(event) => setDistrictSearch(event.target.value)}
                      placeholder="Tuman nomi bo'yicha qidirish"
                      className="w-full bg-transparent text-sm text-[var(--color-maindark)] outline-none placeholder:text-[var(--color-text-muted)] dark:text-[var(--color-primary)]"
                    />
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-[var(--color-maindark)] dark:text-[var(--color-primary)]">
                      Tumanlar ro'yxati
                    </p>
                    <button
                      type="button"
                      onClick={() => setDistrictSearch("")}
                      className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-border-soft)] px-3 py-2 text-xs font-semibold text-[var(--color-main)] transition hover:bg-[var(--color-main-soft)]"
                    >
                      <RefreshCcw size={14} />
                      Tozalash
                    </button>
                  </div>

                  {!filteredDistricts.length ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-[var(--color-border-soft)] p-5 text-center text-sm text-[var(--color-text-muted)] dark:text-[var(--color-text-muted-dark)]">
                      Qidiruv bo'yicha mos tuman topilmadi.
                    </div>
                  ) : null}

                  {filteredDistricts.length ? (
                    <div className="custom-scrollbar mt-4 max-h-[28rem] space-y-3 overflow-y-auto pr-1">
                      {filteredDistricts.map((district) => (
                        <div
                          key={district.id}
                          className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-primary)]/70 p-4 transition hover:shadow-[0_16px_28px_var(--color-main-soft)] dark:bg-white/[0.045]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-bold text-[var(--color-maindark)] dark:text-[var(--color-primary)]">
                                {district.name}
                              </p>
                              <span
                                className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                  district.status === "active"
                                    ? "bg-[var(--color-success)]/15 text-[var(--color-success)]"
                                    : "bg-[var(--color-warning)]/15 text-[var(--color-warning)]"
                                }`}
                              >
                                {district.status === "active" ? "Faol" : "Nofaol"}
                              </span>
                            </div>

                            <div className="text-right text-sm">
                              <p className="font-bold text-[var(--color-maindark)] dark:text-[var(--color-primary)]">
                                {formatNumber(district.ordersCount)}
                              </p>
                              <p className="text-[var(--color-text-muted)] dark:text-[var(--color-text-muted-dark)]">
                                buyurtma
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                            <span className="text-[var(--color-text-muted)] dark:text-[var(--color-text-muted-dark)]">
                              Aktiv kuryerlar
                            </span>
                            <strong className="text-[var(--color-main)]">{formatNumber(district.activeCouriers)}</strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {!USE_MOCK_REGIONS && regionsError && !regions.length ? (
        <section className="rounded-[1.6rem] border border-[var(--color-error)]/20 bg-[var(--color-error)]/10 p-5">
          <p className="text-base font-bold text-[var(--color-maindark)] dark:text-[var(--color-primary)]">
            API xatosi sababli sahifa yuklanmadi.
          </p>
          <button
            type="button"
            onClick={() => void fetchRegionsData()}
            className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-[var(--color-main)] px-4 py-3 text-sm font-semibold text-[var(--color-primary)]"
          >
            <RefreshCcw size={16} />
            Qayta yuklash
          </button>
        </section>
      ) : null}
    </div>
  );
};

export default memo(RegionsPage);
