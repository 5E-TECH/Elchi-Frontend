import {
  regionsOfLogist,
  shortRegionName,
  successRateOf,
  type DistrictStatsItem,
  type RegionCourierStats,
  type RegionItem,
} from "../../../entities/region";

/**
 * LG-3 — logistning `/regions` ko'rinishi (maket `logist-regions-detail`): o'z viloyatlari tanlovi va viloyat
 * kuryerlari. Pul maydonlari bu yerga umuman o'tkazilmaydi (ega LG-S1).
 */

/** Viloyat tanlovi varianti (desktop seg — qisqa nom, telefon `Select` — «Samarqand · 86 ta»). */
export interface LogistRegionOption {
  id: string;
  name: string;
  shortName: string;
  orders: number;
}

/**
 * Logistga biriktirilgan viloyatlar (`stats/all` → `logist_id === me`, backend iOnGbEqi gacha klientda) —
 * bosh sahifadagi «Viloyatlarim» tartibida: buyurtmalar ko'pidan, teng bo'lsa nom bo'yicha.
 */
export const logistRegionOptions = (
  regions: readonly RegionItem[],
  me: string | number | null | undefined,
): LogistRegionOption[] =>
  regionsOfLogist(regions, me)
    .map((region) => ({
      id: region.id,
      name: region.name,
      shortName: shortRegionName(region.name),
      orders: Math.max(0, region.ordersCount),
    }))
    .sort((a, b) => b.orders - a.orders || a.name.localeCompare(b.name, "uz"));

/** Desktopda seg ko'pi bilan shuncha variant; ko'p bo'lsa — `Select` (seg bir qatorga sig'masdi). */
export const LOGIST_REGION_SEG_MAX = 5;

/**
 * Qaysi viloyat ko'rsatiladi:
 *  - `pending` — ro'yxat hali yo'q yoki eskirgan ro'yxat yangilanmoqda (URL'dagi id ni rad etib bo'lmaydi —
 *    LG-2 saboqi: yangi ma'lumot kelmaguncha tanlov/URL ustidan yozilmaydi);
 *  - `none` — logistga hech viloyat biriktirilmagan;
 *  - `notAssigned` — URL'dagi viloyat (`?region=`) endi bu logistniki emas;
 *  - `region` — ko'rsatiladigan viloyat (URL'da bo'lmasa — ro'yxatdagi birinchisi).
 */
export type LogistRegionResolution =
  | { kind: "pending" }
  | { kind: "none" }
  | { kind: "notAssigned"; requestedId: string }
  | { kind: "region"; option: LogistRegionOption };

export const resolveLogistRegion = ({
  options,
  requestedId,
  fresh,
}: {
  /** `null` — ro'yxat hali kelmagan. */
  options: readonly LogistRegionOption[] | null;
  requestedId: string | null;
  /** Ro'yxat shu ko'rinish ochilgandan keyin olingan (kesh emas) va hozir yangilanmayapti. */
  fresh: boolean;
}): LogistRegionResolution => {
  if (!options) return { kind: "pending" };
  const requested = requestedId?.trim() || null;
  if (requested) {
    const option = options.find((item) => item.id === requested);
    if (option) return { kind: "region", option };
    return fresh ? { kind: "notAssigned", requestedId: requested } : { kind: "pending" };
  }
  if (options.length === 0) return fresh ? { kind: "none" } : { kind: "pending" };
  return { kind: "region", option: options[0] };
};

/** «Kuryerlar» jadvali qatori (pulsiz). */
export interface LogistCourierRow {
  id: string;
  name: string;
  initials: string;
  phone?: string;
  districtName?: string;
  orders: number;
  sold: number;
  cancelled: number;
  /** 0..100 — `sold / orders` (klientda aniq; backend butun songa yaxlitlaydi). */
  rate: number;
}

/** Ism → bosh harflar (ko'pi bilan 2): «Jasur Tursunov» → «JT»; bo'sh — «?». */
export const initialsOf = (name: string): string => {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase("uz"))
    .join("");
  return letters || "?";
};

/** Buyurtmasi bor kuryerlar — buyurtmalar ko'pidan (teng bo'lsa sotilgani, keyin ism). Pul maydoni o'tmaydi. */
export const toLogistCourierRows = (
  couriers: readonly RegionCourierStats[] | undefined,
  districts: readonly Pick<DistrictStatsItem, "id" | "name">[],
): LogistCourierRow[] => {
  const districtName = new Map(districts.map((district) => [district.id, district.name]));
  return (couriers ?? [])
    .filter((courier) => courier.totalOrders > 0)
    .map((courier) => {
      const orders = Math.max(0, courier.totalOrders);
      const sold = Math.max(0, courier.deliveredOrders);
      return {
        id: courier.id,
        name: courier.name || "—",
        initials: initialsOf(courier.name),
        phone: courier.phone,
        districtName: courier.districtId ? districtName.get(courier.districtId) : undefined,
        orders,
        sold,
        cancelled: Math.max(0, courier.cancelledOrders ?? 0),
        rate: successRateOf(sold, orders),
      };
    })
    .sort((a, b) => b.orders - a.orders || b.sold - a.sold || a.name.localeCompare(b.name, "uz"));
};

/** Ro'yxatda birinchi ko'rinadigan kuryerlar (qolgani «Yana N ta kuryer»). */
export const COURIER_TOP = 5;

/**
 * Viloyatdagi faol / jami kuryerlar — `couriers[].status === "active"` (backend `summary.activeCouriers` bilan bir
 * xil qoida; LG-1 qarori: maketdagi «bugun buyurtmasi bor» soni API'da yo'q). Ro'yxat kelmasa — `null` («—»).
 */
export const courierCounts = (
  couriers: readonly RegionCourierStats[] | undefined,
): { active: number; total: number } | null => {
  if (!couriers) return null;
  return {
    active: couriers.filter((courier) => courier.status === "active").length,
    total: couriers.length,
  };
};
