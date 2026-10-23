import { ORDER_STATUSES } from "../../../entities/order";
import type { DeliveryType, OrderListParams, OrderStatus } from "../../../entities/order/types/order";
import { getThisMonthRange, getThisWeekRange, getTodayRange } from "../../../shared/lib/dateRange";
import { isMarketSideRole } from "../../../entities/user/lib/role";

/**
 * «Buyurtmalar» ro'yxati filtrlari — sof mantiq (UI'siz): URL kalitlari, holat tablari, API parametrlari,
 * faol filtrlar soni. `OrderFilters.tsx` (asboblar qatori, panel, chiplar), telefon varaqasi
 * (`OrderFiltersSheet.tsx`) va sahifa (`pages/orders/index.tsx`) bir xil qoidani ishlatsin.
 */

// ── URL / Redux kalitlari (UserListPage patterndek) ───────────────────────
export const ORDER_FILTER_KEYS = {
  marketId: "orderMarketId",
  branchId: "orderBranchId",
  regionId: "orderRegionId",
  districtId: "orderDistrictId",
  courierId: "orderCourierId",
  status: "orderStatus",
  deliveryType: "where_deliver",
  dateFrom: "startDay",
  dateTo: "endDay",
  search: "orderSearch",
} as const;

export const ORDER_STATUS_URL_KEY = "status";
/** Eski holat kaliti (`orderStatus`) — o'qiladi, yozishda tozalanadi. */
export const LEGACY_ORDER_STATUS_URL_KEY = ORDER_FILTER_KEYS.status;
/** Eski sana kalitlari — o'qiladi, yozishda tozalanadi. */
export const LEGACY_DATE_FROM_KEY = "orderDateFrom";
export const LEGACY_DATE_TO_KEY = "orderDateTo";

/**
 * «Holat» filtridagi variantlar — maketdagi tartibda (`superadmin-orders-filters-mobile`: Yangi, Yaratilgan,
 * Qabul qilindi, Yo'lda, Kutilmoqda, Sotilgan, To'langan, Qisman to'langan, Bekor qilingan, Yopilgan) va maketda
 * yo'q ikki backend holati o'z guruhida: «Mijoz kutilmoqda» (ega qarori, SllBYhnt) va «Marketga topshirildi»
 * (`status=returned_to_market`; bekor zanjirining yakuni, taklif §5.1 — backend `status` paramining enum'ida bor).
 * «Bekor — jo'natilgan» alohida variant emas — u «Bekor qilingan» tabi bilan birga keladi.
 */
export const FILTER_STATUSES: readonly OrderStatus[] = [
  "new",
  "created",
  "received",
  "on the road",
  "waiting",
  "waiting_customer",
  "sold",
  "paid",
  "partly_paid",
  "cancelled",
  "returned_to_market",
  "closed",
];

const KNOWN_STATUSES = new Set<string>(ORDER_STATUSES);

/** URL dagi `status=a,b` (yoki massiv) → holatlar ro'yxati; noma'lum qiymatlar tashlanadi. */
export const parseStatusValues = (value: unknown): OrderStatus[] => {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const result: OrderStatus[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const status = item.trim();
    if (KNOWN_STATUSES.has(status) && !result.includes(status as OrderStatus)) result.push(status as OrderStatus);
  }
  return result;
};

/** Filtr o'zgarganda faqat «Holat» variantlari qoladi (eski xatti-harakat: `cancelled (sent)` tushadi). */
export const normalizeFilterStatuses = (values: readonly string[]): OrderStatus[] =>
  FILTER_STATUSES.filter((status) => values.includes(status));

export const isDeliveryType = (value: string): value is DeliveryType => value === "center" || value === "address";

/** `GET /orders` qabul qiladigan `limit` qiymatlari (gateway `DEFAULT_ALLOWED_LIMITS`, boshqasi — 400). */
export const ORDER_LIST_LIMITS: readonly number[] = [10, 25, 50, 100];

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * URL'dagi sana (`startDay` / `endDay`) — faqat haqiqiy `YYYY-MM-DD`; boshqasi (`?startDay=falonchi`,
 * `2026-02-30`) bo'sh: backend 400 qaytarardi va sahifa hech qachon o'tmaydigan xatoda qolardi (D-08).
 */
export const sanitizeDayParam = (value: string | null | undefined): string => {
  const text = (value ?? "").trim();
  const match = DAY_PATTERN.exec(text);
  if (!match) return "";
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? text : "";
};

/**
 * Qidiruv matni → `search` parametri (D-11): chetlaridagi bo'shliqlar olinadi (faqat bo'shliq — qidiruv yo'q),
 * boshidagi «№» / «#» tashlanadi — ro'yxatda raqam «№53» ko'rinishida, backend esa «53» ni qidiradi.
 */
export const normalizeOrderSearch = (value: string | null | undefined): string =>
  (value ?? "").trim().replace(/^[№#]+\s*/u, "").trim();

// ── Holat tablari (maket: «Barchasi · Yangi · Qabul qilindi · Yo'lda · Kutilmoqda · Sotilgan · To'langan ·
//    Bekor qilingan») ────────────────────────────────────────────────────────
export type OrderStatusTabId =
  | "all"
  | "new"
  | "received"
  | "on_the_road"
  | "waiting"
  | "sold"
  | "paid"
  | "cancelled";

/**
 * Tab → URL `status` qiymati. «To'langan» — to'langan + qisman to'langan, «Bekor qilingan» — bekor qilingan +
 * bekor — jo'natilgan (maketdagi tab `title` lari). Sahifadagi `Tabs` va filtr hisobi shu jadvaldan.
 */
export const ORDER_STATUS_TABS: ReadonlyArray<{ id: OrderStatusTabId; statuses: readonly OrderStatus[] }> = [
  { id: "all", statuses: [] },
  { id: "new", statuses: ["new"] },
  { id: "received", statuses: ["received"] },
  { id: "on_the_road", statuses: ["on the road"] },
  { id: "waiting", statuses: ["waiting"] },
  { id: "sold", statuses: ["sold"] },
  { id: "paid", statuses: ["paid", "partly_paid"] },
  { id: "cancelled", statuses: ["cancelled", "cancelled (sent)"] },
];

/** Holatlar to'plami qaysi tabga aynan mos (tartibsiz); hech biriga mos kelmasa — `null` («Holat» filtridan tanlangan). */
export const matchOrderStatusTab = (statuses: readonly string[]): OrderStatusTabId | null => {
  const unique = new Set(statuses);
  const tab = ORDER_STATUS_TABS.find(
    (item) => item.statuses.length === unique.size && item.statuses.every((status) => unique.has(status)),
  );
  return tab?.id ?? null;
};

// ── Filtr qiymatlari ──────────────────────────────────────────────────────
export type OrderFilterValues = {
  marketId: string;
  branchId: string;
  regionId: string;
  districtId: string;
  courierId: string;
  deliveryType: "" | DeliveryType;
  statuses: OrderStatus[];
  dateFrom: string;
  dateTo: string;
};

export const EMPTY_ORDER_FILTERS: OrderFilterValues = {
  marketId: "",
  branchId: "",
  regionId: "",
  districtId: "",
  courierId: "",
  deliveryType: "",
  statuses: [],
  dateFrom: "",
  dateTo: "",
};

/** Rolga qarab qaysi filtrlar ishlaydi — `pages/orders/index.tsx` dagi API parametrlari bilan bir xil qoida. */
export type OrderFilterScope = {
  /** Market tanlovi (superadmin, admin). URL'dan kelgan market esa market rolidan boshqa hamma uchun qo'llanadi. */
  marketSelect: boolean;
  /** Market qiymati qo'llanadi (market rolida — yo'q). */
  market: boolean;
  /** Filial (superadmin, admin). */
  branch: boolean;
  /**
   * Menejer — tuman, qolganlar — viloyat. `none` — market operatori (MO-3): `GET /region` unga yopiq (N11), viloyat
   * filtri backend ruxsatidan keyin.
   */
  area: "region" | "district" | "none";
  /** Kuryer (market va market operatorida — yo'q). */
  courier: boolean;
};

/**
 * Market tomoni (market va uning operatori, `isMarketSideRole`) — o'z marketi: market va kuryer filtrlari yo'q
 * (backend ro'yxatni tokendagi marketga cheklaydi, boshqa `market_id` — 400).
 */
export const getOrderFilterScope = (role: string | null): OrderFilterScope => {
  const isAdmin = role === "admin" || role === "superadmin";
  const marketSide = isMarketSideRole(role);
  return {
    marketSelect: isAdmin,
    market: !marketSide,
    branch: isAdmin,
    area: role === "manager" ? "district" : role === "market_operator" ? "none" : "region",
    courier: !marketSide,
  };
};

/** Panel filtridagi hudud qiymati (`area` bo'yicha; `none` — yo'q). */
const areaValueOf = (values: Pick<OrderFilterValues, "regionId" | "districtId">, scope: OrderFilterScope) =>
  scope.area === "district" ? values.districtId : scope.area === "region" ? values.regionId : "";

/**
 * `GET /orders` parametrlari — sahifa (`index.tsx` `apiParams`) bilan bir xil qoida (saralashsiz).
 * Telefon varaqasidagi «Natijalarni ko'rsatish (N)» soni shu bilan so'raladi.
 */
export const buildOrderListParams = (
  values: OrderFilterValues & { search?: string },
  role: string | null,
  paging: { page: number; limit: number },
): OrderListParams => {
  const scope = getOrderFilterScope(role);
  const params: OrderListParams = { page: paging.page, limit: paging.limit };

  if (scope.market && values.marketId) params.market_id = values.marketId;
  if (scope.branch && values.branchId) params.branch_id = values.branchId;
  if (scope.area === "district") {
    if (values.districtId) params.district_id = values.districtId;
  } else if (scope.area === "region" && values.regionId) {
    params.region_id = values.regionId;
  }
  if (scope.courier && values.courierId) params.courier_id = values.courierId;

  const statuses = parseStatusValues(values.statuses);
  if (statuses.length > 0) params.status = statuses;
  if (isDeliveryType(values.deliveryType)) params.where_deliver = values.deliveryType;
  if (values.dateFrom) params.start_day = values.dateFrom;
  if (values.dateTo) params.end_day = values.dateTo;
  if (values.search) params.search = values.search;

  return params;
};

/**
 * Panel filtrlari soni («Filtrlar N»): market, filial, viloyat/tuman, kuryer, yetkazish turi va holat (bir nechta
 * holat — bitta filtr). `includeStatus=false` — holat tab bilan ko'rsatilgan (filtr emas). Sana va qidiruv bu
 * songa kirmaydi — ular asboblar qatorida ko'rinib turadi.
 */
export const countPanelFilters = (
  values: OrderFilterValues,
  scope: OrderFilterScope,
  { includeStatus = true }: { includeStatus?: boolean } = {},
): number =>
  Number(scope.market && Boolean(values.marketId)) +
  Number(scope.branch && Boolean(values.branchId)) +
  Number(Boolean(areaValueOf(values, scope))) +
  Number(scope.courier && Boolean(values.courierId)) +
  Number(Boolean(values.deliveryType)) +
  Number(includeStatus && values.statuses.length > 0);

export const hasDateRange = (values: Pick<OrderFilterValues, "dateFrom" | "dateTo">) =>
  Boolean(values.dateFrom || values.dateTo);

// ── Telefon varaqasidagi «Sana» segmenti ──────────────────────────────────
export type QuickPeriod = "today" | "week" | "month" | "all";

export const QUICK_PERIODS: readonly QuickPeriod[] = ["today", "week", "month", "all"];

/** Davr → oraliq (`shared/lib/dateRange` — sana maydonining tez tanlovi bilan bir xil); «Barchasi» — sana filtri yo'q. */
export const getQuickPeriodRange = (period: QuickPeriod): { from: string; to: string } => {
  switch (period) {
    case "today":
      return getTodayRange();
    case "week":
      return getThisWeekRange();
    case "month":
      return getThisMonthRange();
    case "all":
      return { from: "", to: "" };
  }
};

/** Oraliq qaysi davrga aynan mos; qo'lda tanlangan oraliq — `null` (segmentda hech biri tanlanmagan). */
export const matchQuickPeriod = (from: string, to: string): QuickPeriod | null =>
  QUICK_PERIODS.find((period) => {
    const range = getQuickPeriodRange(period);
    return range.from === from && range.to === to;
  }) ?? null;

/** `GET /orders` javobidagi umumiy son (sahifa bilan bir xil shakllar); bo'lmasa — `null`. */
export const readOrdersTotal = (payload: unknown): number | null => {
  const response = payload as
    | {
        total?: unknown;
        meta?: { total?: unknown };
        pagination?: { total?: unknown };
        data?: { total?: unknown; meta?: { total?: unknown }; pagination?: { total?: unknown } };
      }
    | undefined;
  const raw =
    response?.total ??
    response?.meta?.total ??
    response?.pagination?.total ??
    response?.data?.total ??
    response?.data?.meta?.total ??
    response?.data?.pagination?.total;
  const total = Number(raw);
  return raw !== undefined && raw !== null && Number.isFinite(total) && total >= 0 ? Math.floor(total) : null;
};
