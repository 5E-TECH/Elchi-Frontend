import { describe, expect, it } from "vitest";
import {
  extractTodayMarkets,
  filterTodayMarkets,
  listOf,
  sortTodayMarkets,
  sumTodayMarkets,
  type TodayMarketRow,
} from "./todayMarkets";

const raw = [
  { market_id: "1", orders_count: 9, total_price_sum: 4860000, market: { name: "Nur Elektronika", phone_number: "+998936041872" } },
  // Postgres `COUNT`/`SUM` xom satr bo'lib kelishi mumkin — yig'indi satr ulanib ketmasin.
  { market_id: "2", orders_count: "14", total_price_sum: "3420000", market: { name: "Baraka Shop", phone_number: "+998903152241" } },
  { market_id: "3", orders_count: 2, total_price_sum: 310000, market: null },
  { orders_count: 5, total_price_sum: 1 },
];

describe("extractTodayMarkets", () => {
  it("massiv va { data } o'ramini o'qiydi, sonlarni Number qiladi, id siz qatorni tashlaydi", () => {
    for (const response of [raw, { data: raw }]) {
      const rows = extractTodayMarkets(response);
      expect(rows.map((row) => row.market_id)).toEqual(["1", "2", "3"]);
      expect(rows[1]).toEqual({
        market_id: "2",
        name: "Baraka Shop",
        phone_number: "+998903152241",
        orders_count: 14,
        total_price_sum: 3420000,
      });
      expect(rows[2].name).toBe("—");
    }
  });

  it("noma'lum shakl — bo'sh ro'yxat", () => {
    expect(extractTodayMarkets(undefined)).toEqual([]);
    expect(extractTodayMarkets({ data: { foo: 1 } })).toEqual([]);
  });

  it("listOf: items / orders o'ramlari", () => {
    expect(listOf({ data: { items: [1, 2] } })).toEqual([1, 2]);
    expect(listOf({ orders: [3] })).toEqual([3]);
  });
});

describe("filter / sum / sort", () => {
  const rows = extractTodayMarkets(raw);

  it("qidiruv: nom (katta-kichik harfsiz) va telefon raqamlari bo'yicha", () => {
    expect(filterTodayMarkets(rows, "baraka").map((r) => r.market_id)).toEqual(["2"]);
    expect(filterTodayMarkets(rows, "90 315").map((r) => r.market_id)).toEqual(["2"]);
    expect(filterTodayMarkets(rows, "+99893604").map((r) => r.market_id)).toEqual(["1"]);
    expect(filterTodayMarkets(rows, "  ")).toHaveLength(3);
    expect(filterTodayMarkets(rows, "yo'q market")).toEqual([]);
  });

  it("xulosa: marketlar, buyurtmalar va summa (satr sonlar ham)", () => {
    expect(sumTodayMarkets(rows)).toEqual({ markets: 3, orders: 25, amount: 8590000 });
  });

  it("saralash: buyurtmalar kamayish (sukut), nom o'sish, summa; null — server tartibi", () => {
    const ids = (list: TodayMarketRow[]) => list.map((r) => r.market_id);
    expect(ids(sortTodayMarkets(rows, { key: "orders", direction: "desc" }))).toEqual(["2", "1", "3"]);
    expect(ids(sortTodayMarkets(rows, { key: "name", direction: "asc" }, "uz"))).toEqual(["3", "2", "1"]);
    expect(ids(sortTodayMarkets(rows, { key: "amount", direction: "asc" }))).toEqual(["3", "2", "1"]);
    expect(ids(sortTodayMarkets(rows, null))).toEqual(["1", "2", "3"]);
  });
});
