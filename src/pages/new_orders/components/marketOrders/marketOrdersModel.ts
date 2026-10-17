import type { DataTableSort } from "../../../../shared/ui/primitives";
import type { ApiOrder } from "../../model/apiOrder";

/**
 * MARKETNING YANGI BUYURTMALARI (`/new-orders/:marketId`) — sof yordamchilar.
 *
 * Sahifa (`new_orderDetail.tsx`), jadval (`MarketOrdersTable.tsx`) va oynalar shu yerdagi qoidalardan
 * foydalanadi; hammasi `marketOrdersModel.test.ts` da tekshiriladi.
 */

/** `GET orders/markets/:id/new` (enriched) qatori: buyurtma + market, tuman, viloyat. */
export type MarketOrder = ApiOrder & {
  market?: { id?: string | number | null; name?: string | null } | null;
};

/** Ro'yxat saralashi (faqat «Buyurtma» ustuni — yaratilgan vaqt). Sukut: yangilari tepada. */
export const MARKET_ORDERS_SORT_KEY = "createdAt";
export const DEFAULT_MARKET_ORDERS_SORT: DataTableSort = { key: MARKET_ORDERS_SORT_KEY, direction: "desc" };

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const digits = (value: unknown) => text(value).replace(/\D+/g, "");

/** Tuman nomi: buyurtmaning o'zida, bo'lmasa mijozda. */
export const readOrderDistrict = (order: MarketOrder): string | null =>
  text(order.district?.name) || text(order.customer?.district?.name) || null;

/** Viloyat nomi: buyurtmaning o'zida, bo'lmasa mijozda. */
export const readOrderRegion = (order: MarketOrder): string | null =>
  text(order.region?.name) || text(order.customer?.region?.name) || null;

export type ProductLine = { key: string; name: string; quantity: number };

/**
 * Mahsulot qatorlari. ⚠️ Hamkor (Partner API) buyurtmasida `product` yo'q — nomi `product_name` da
 * (katalogsiz mahsulot, `shared/lib/orderItemName.ts` qoidasi).
 */
export const readProductLines = (order: MarketOrder): ProductLine[] =>
  (order.items ?? []).map((item, index) => ({
    key: String(item.id ?? index),
    name: text(item.product?.name) || text(item.product_name) || "—",
    quantity: Number(item.quantity) || 0,
  }));

/**
 * Qidiruv (mijoz, telefon yoki buyurtma raqami) — mijoz tomonida. Backend `markets/:id/new` qidiruv
 * parametrini qabul qilmaydi (eski `?search=` hech narsani filtrlamas edi).
 * Telefon raqamlar bo'yicha solishtiriladi («90 214» → «+998 90 214 36 58»); «№»/«#» tashlab yuboriladi.
 */
export const matchesMarketOrderSearch = (order: MarketOrder, query: string): boolean => {
  const needle = query.trim().toLowerCase().replace(/^[№#]\s*/, "");
  if (!needle) return true;

  const name = text(order.customer?.name).toLowerCase();
  if (name.includes(needle)) return true;

  const id = String(order.id ?? "").toLowerCase();
  if (id.includes(needle)) return true;

  const orderNumber = text(order.order_number).toLowerCase();
  if (orderNumber && orderNumber.includes(needle)) return true;

  const needleDigits = digits(needle);
  if (needleDigits.length >= 2 && needleDigits.length === needle.replace(/[\s()+-]/g, "").length) {
    const phones = [order.customer?.phone_number, order.customer?.extra_number].map(digits);
    if (phones.some((phone) => phone.includes(needleDigits))) return true;
  }
  return false;
};

const timeOf = (order: MarketOrder) => {
  const value = new Date(order.createdAt).getTime();
  return Number.isFinite(value) ? value : 0;
};

/** Yaratilgan vaqt bo'yicha saralash (barqaror: teng vaqtda asl tartib). `null` — kelgan tartib. */
export const sortMarketOrders = <T extends MarketOrder>(orders: readonly T[], sort: DataTableSort | null): T[] => {
  if (!sort || sort.key !== MARKET_ORDERS_SORT_KEY) return [...orders];
  const sign = sort.direction === "asc" ? 1 : -1;
  return orders
    .map((order, index) => ({ order, index }))
    .sort((a, b) => sign * (timeOf(a.order) - timeOf(b.order)) || a.index - b.index)
    .map(({ order }) => order);
};

/** Buyurtmalar summasi (`total_price`). */
export const sumTotalPrice = (orders: readonly MarketOrder[]): number =>
  orders.reduce((sum, order) => sum + (Number(order.total_price) || 0), 0);

/** Qabul oynasidagi «Tanlanmagan 2 ta buyurtma (№a, №b…)» — ko'pi bilan `cap` ta raqam. */
export const pickUnselectedPreview = (
  orders: readonly MarketOrder[],
  selectedIds: ReadonlySet<string>,
  cap = 3,
): { count: number; ids: string[]; more: boolean } => {
  const unselected = orders.filter((order) => !selectedIds.has(order.id));
  return {
    count: unselected.length,
    ids: unselected.slice(0, cap).map((order) => order.id),
    more: unselected.length > cap,
  };
};

type MarketsListRow = { market_id?: string | number | null; market?: { name?: string | null } | null };

/**
 * Sarlavhadagi market nomi: avval buyurtmaning `market` i (enriched javob), bo'lmasa (ro'yxat bo'sh)
 * — `orders/markets/new` ro'yxatidagi qator (keshi «Marketlar» sahifasi bilan umumiy).
 */
export const readMarketName = (
  orders: readonly MarketOrder[],
  marketsList: unknown,
  marketId: string | number | undefined,
): string | null => {
  for (const order of orders) {
    const name = text(order.market?.name);
    if (name) return name;
  }
  const rows: unknown = Array.isArray(marketsList)
    ? marketsList
    : (marketsList as { data?: unknown } | null | undefined)?.data;
  if (!Array.isArray(rows) || marketId == null) return null;
  const row = (rows as MarketsListRow[]).find((item) => String(item?.market_id ?? "") === String(marketId));
  return text(row?.market?.name) || null;
};

type UserWithBranch = {
  branch?: { name?: string | null; branch?: { name?: string | null } | null } | null;
} | null;

/** Xodimning filial nomi (qabul oynasi: «Ular Toshkent HQ pochtasiga o'tkaziladi»). */
export const readUserBranchName = (user: unknown): string | null => {
  const raw = user as UserWithBranch;
  return text(raw?.branch?.branch?.name) || text(raw?.branch?.name) || null;
};
