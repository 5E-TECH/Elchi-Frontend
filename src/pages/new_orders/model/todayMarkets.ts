/**
 * `GET orders/markets/new` — bugun qabul kutayotgan (yangi) buyurtmasi bor marketlar.
 * Qator: `{ market_id, orders_count, total_price_sum, market: { name, phone_number, … } | null }`.
 * Qobiq qatlami ba'zan `{ data: [...] }` bilan o'raydi; son maydonlari ehtiyot uchun `Number` dan o'tadi
 * (Postgres `COUNT`/`SUM` xom holda satr qaytaradi).
 */
export type TodayMarketRow = {
  market_id: string;
  name: string;
  phone_number: string;
  orders_count: number;
  total_price_sum: number;
};

type RawTodayMarket = {
  market_id?: string | number | null;
  orders_count?: unknown;
  total_price_sum?: unknown;
  market?: { id?: string | number | null; name?: string | null; phone_number?: string | null } | null;
};

/** Javobdagi massiv: `[...]`, `{ data: [...] }`, `{ data: { items | orders } }`, `{ items | orders }`. */
export const listOf = <T = unknown>(response: unknown): T[] => {
  if (Array.isArray(response)) return response as T[];
  const source = response as { data?: unknown; items?: unknown; orders?: unknown } | null | undefined;
  if (Array.isArray(source?.data)) return source.data as T[];
  const inner = source?.data as { items?: unknown; orders?: unknown } | null | undefined;
  if (Array.isArray(inner?.items)) return inner.items as T[];
  if (Array.isArray(inner?.orders)) return inner.orders as T[];
  if (Array.isArray(source?.items)) return source.items as T[];
  if (Array.isArray(source?.orders)) return source.orders as T[];
  return [];
};

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const extractTodayMarkets = (response: unknown): TodayMarketRow[] =>
  listOf<RawTodayMarket>(response)
    .map((item) => ({
      market_id: String(item.market_id ?? item.market?.id ?? ""),
      name: item.market?.name?.trim() || "—",
      phone_number: item.market?.phone_number ?? "",
      orders_count: toNumber(item.orders_count),
      total_price_sum: toNumber(item.total_price_sum),
    }))
    .filter((row) => row.market_id);

/**
 * Manba ro'yxati qatori (marketlar, filial paketlari, bekor qilinganlar): qidiruv, saralash va xulosa
 * faqat shu maydonlarga tayanadi — funksiyalar istalgan shunday qator uchun umumiy.
 */
export type SourceListLikeRow = Pick<TodayMarketRow, "name" | "phone_number" | "orders_count" | "total_price_sum">;

/**
 * Qidiruv — mijoz tomonida: backend `orders/markets/new` qidiruv parametrini qabul qilmaydi (openapi'da
 * parametr yo'q, gateway uni e'tiborsiz qoldiradi), v1 dagi `?search=` hech narsani filtrlamasdi.
 * Nom — katta-kichik harfsiz; telefon — faqat raqamlar bo'yicha («90 315», «+99890315» ham topadi).
 */
export const filterTodayMarkets = <T extends SourceListLikeRow>(rows: readonly T[], query: string): T[] => {
  const text = query.trim().toLocaleLowerCase();
  if (!text) return [...rows];
  const digits = text.replace(/\D/g, "");
  return rows.filter(
    (row) =>
      row.name.toLocaleLowerCase().includes(text) ||
      (digits.length > 0 && row.phone_number.replace(/\D/g, "").includes(digits)),
  );
};

export type TodayMarketsTotals = { markets: number; orders: number; amount: number };

/** Xulosa: qatorlar soni (`markets`), `orders_count` va `total_price_sum` yig'indilari. */
export const sumTodayMarkets = (rows: readonly SourceListLikeRow[]): TodayMarketsTotals =>
  rows.reduce<TodayMarketsTotals>(
    (acc, row) => ({
      markets: acc.markets + 1,
      orders: acc.orders + row.orders_count,
      amount: acc.amount + row.total_price_sum,
    }),
    { markets: 0, orders: 0, amount: 0 },
  );

export type TodayMarketsSortKey = "name" | "orders" | "amount";

/** Saralash — mijoz tomonida (ro'yxat to'liq keladi, sahifalash yo'q). `null` — server tartibi. */
export const sortTodayMarkets = <T extends SourceListLikeRow>(
  rows: readonly T[],
  sort: { key: string; direction: "asc" | "desc" } | null,
  language?: string,
): T[] => {
  if (!sort) return [...rows];
  const sign = sort.direction === "asc" ? 1 : -1;
  const compare = (a: T, b: T) => {
    switch (sort.key as TodayMarketsSortKey) {
      case "name":
        return a.name.localeCompare(b.name, language);
      case "orders":
        return a.orders_count - b.orders_count;
      case "amount":
        return a.total_price_sum - b.total_price_sum;
      default:
        return 0;
    }
  };
  return [...rows].sort((a, b) => sign * compare(a, b));
};
