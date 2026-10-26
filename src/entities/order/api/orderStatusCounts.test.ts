import { describe, expect, it } from "vitest";
import { orderStatusCountsQueryKey, parseOrderStatusCounts, toStatusCountsParams } from "./orderStatusCounts";

/** GaBIPi3Z — `GET /orders/status-counts` javobi va parametrlari (FRONTEND_CHANGELOG 2026-10-26). */
describe("parseOrderStatusCounts", () => {
  const data = {
    all: 71,
    new: 12,
    received: 8,
    on_the_road: 6,
    waiting: 5,
    sold: 21,
    paid: 4,
    cancelled: 7,
    new_incoming: 12,
    by_status: { waiting_customer: 1 },
    search_truncated: false,
  };

  it("`successRes` konverti → 8 tab soni + `new_incoming`", () => {
    expect(parseOrderStatusCounts({ statusCode: 200, data })).toEqual({
      all: 71,
      new: 12,
      received: 8,
      on_the_road: 6,
      waiting: 5,
      sold: 21,
      paid: 4,
      cancelled: 7,
      new_incoming: 12,
    });
  });

  it("`new_incoming: null` (operator, kuryer, logist) — `null`, tab sonlari qoladi", () => {
    const parsed = parseOrderStatusCounts({ data: { ...data, new_incoming: null } });
    expect(parsed?.new_incoming).toBeNull();
    expect(parsed?.all).toBe(71);
  });

  it("satr ko'rinishidagi son ham qabul qilinadi; 0 — 0", () => {
    expect(parseOrderStatusCounts({ data: { ...data, all: "1248", new: 0 } })).toMatchObject({ all: 1248, new: 0 });
  });

  it.each([
    ["konvertsiz", data],
    ["bo'sh", null],
    ["massiv", { data: [] }],
    ["tab soni yo'q", { data: { ...data, sold: undefined } }],
    ["manfiy son", { data: { ...data, paid: -1 } }],
    ["son emas", { data: { ...data, waiting: "ko'p" } }],
  ])("shakl boshqacha (%s) — `null` (tablar sonsiz)", (_label, body) => {
    expect(parseOrderStatusCounts(body)).toBeNull();
  });
});

describe("toStatusCountsParams / kalit", () => {
  it("holat, sahifa, saralash olib tashlanadi — filtrlar qoladi", () => {
    expect(
      toStatusCountsParams({
        page: 3,
        limit: 25,
        status: ["cancelled", "cancelled (sent)"],
        sort_by: "created_at",
        sort_dir: "desc",
        market_id: "37",
        region_id: "5",
        start_day: "2026-10-01",
        end_day: "2026-10-26",
        search: "Ali",
        where_deliver: "address",
      }),
    ).toEqual({
      market_id: "37",
      region_id: "5",
      start_day: "2026-10-01",
      end_day: "2026-10-26",
      search: "Ali",
      where_deliver: "address",
    });
  });

  it("tab yoki sahifa almashsa kalit o'zgarmaydi; filtrsiz kalit — badge bilan umumiy `{}`", () => {
    expect(orderStatusCountsQueryKey({ page: 1, limit: 10, status: ["new"] })).toEqual(["orders", "status-counts", {}]);
    expect(orderStatusCountsQueryKey({ page: 2, limit: 50 })).toEqual(orderStatusCountsQueryKey({}));
  });
});
