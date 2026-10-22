import { getThisMonthRange, getThisWeekRange, getTodayRange } from "../../../shared/lib/dateRange";
import {
  buildOrderListParams,
  countPanelFilters,
  EMPTY_ORDER_FILTERS,
  FILTER_STATUSES,
  getOrderFilterScope,
  matchOrderStatusTab,
  matchQuickPeriod,
  normalizeFilterStatuses,
  parseStatusValues,
  readOrdersTotal,
  type OrderFilterValues,
} from "./orderFilterModel";

const filled: OrderFilterValues = {
  marketId: "m1",
  branchId: "b1",
  regionId: "r1",
  districtId: "d1",
  courierId: "c1",
  deliveryType: "address",
  statuses: ["waiting", "sold"],
  dateFrom: "2026-10-01",
  dateTo: "2026-10-08",
};

describe("orderFilterModel", () => {
  it("parses the URL status list and drops unknown values and duplicates", () => {
    expect(parseStatusValues("waiting, sold,bogus,waiting")).toEqual(["waiting", "sold"]);
    expect(parseStatusValues("cancelled,cancelled (sent)")).toEqual(["cancelled", "cancelled (sent)"]);
    expect(parseStatusValues("")).toEqual([]);
    expect(parseStatusValues(undefined)).toEqual([]);
  });

  it("«Marketga topshirildi» filtri: `status=returned_to_market` (taklif §5.1; backend enum'ida bor)", () => {
    expect(FILTER_STATUSES).toContain("returned_to_market");
    expect(FILTER_STATUSES.indexOf("returned_to_market")).toBe(FILTER_STATUSES.indexOf("cancelled") + 1);
    expect(parseStatusValues("returned_to_market,bogus")).toEqual(["returned_to_market"]);
    expect(normalizeFilterStatuses(["returned_to_market", "cancelled (sent)"])).toEqual(["returned_to_market"]);
    expect(
      buildOrderListParams({ ...EMPTY_ORDER_FILTERS, statuses: ["returned_to_market"] }, "superadmin", { page: 1, limit: 25 })
        .status,
    ).toEqual(["returned_to_market"]);
  });

  it("keeps only the «Holat» filter options when the status filter changes", () => {
    expect(normalizeFilterStatuses(["cancelled (sent)", "sold", "new"])).toEqual(["new", "sold"]);
  });

  it("matches a status set to its tab regardless of order", () => {
    expect(matchOrderStatusTab(["waiting"])).toBe("waiting");
    expect(matchOrderStatusTab(["partly_paid", "paid"])).toBe("paid");
    expect(matchOrderStatusTab(["cancelled (sent)", "cancelled"])).toBe("cancelled");
    expect(matchOrderStatusTab([])).toBe("all");
    expect(matchOrderStatusTab(["waiting", "sold"])).toBeNull();
    expect(matchOrderStatusTab(["cancelled"])).toBeNull();
  });

  it("builds GET /orders params with the same role rules as the page", () => {
    expect(buildOrderListParams({ ...filled, search: "12" }, "superadmin", { page: 1, limit: 10 })).toEqual({
      page: 1,
      limit: 10,
      market_id: "m1",
      branch_id: "b1",
      region_id: "r1",
      courier_id: "c1",
      status: ["waiting", "sold"],
      where_deliver: "address",
      start_day: "2026-10-01",
      end_day: "2026-10-08",
      search: "12",
    });
    // Registrator: filial yo'q; menejer: viloyat o'rniga tuman; market: market va kuryer yo'q.
    expect(buildOrderListParams(filled, "registrator", { page: 1, limit: 1 })).not.toHaveProperty("branch_id");
    const manager = buildOrderListParams(filled, "manager", { page: 1, limit: 1 });
    expect(manager).toMatchObject({ district_id: "d1", market_id: "m1", courier_id: "c1" });
    expect(manager).not.toHaveProperty("region_id");
    const market = buildOrderListParams(filled, "market", { page: 1, limit: 1 });
    expect(market).toMatchObject({ region_id: "r1", where_deliver: "address" });
    expect(market).not.toHaveProperty("market_id");
    expect(market).not.toHaveProperty("courier_id");
    expect(buildOrderListParams(EMPTY_ORDER_FILTERS, "admin", { page: 2, limit: 10 })).toEqual({ page: 2, limit: 10 });
  });

  it("counts panel filters per role, with several statuses as one filter", () => {
    expect(countPanelFilters(filled, getOrderFilterScope("superadmin"))).toBe(6);
    expect(countPanelFilters(filled, getOrderFilterScope("registrator"))).toBe(5);
    expect(countPanelFilters(filled, getOrderFilterScope("market"))).toBe(3);
    expect(countPanelFilters(filled, getOrderFilterScope("superadmin"), { includeStatus: false })).toBe(5);
    expect(countPanelFilters(EMPTY_ORDER_FILTERS, getOrderFilterScope("admin"))).toBe(0);
  });

  it("recognises the quick periods of the phone sheet", () => {
    const today = getTodayRange();
    const week = getThisWeekRange();
    const month = getThisMonthRange();
    expect(matchQuickPeriod(today.from, today.to)).toBe("today");
    expect(matchQuickPeriod("", "")).toBe("all");
    expect(matchQuickPeriod("2000-01-01", "2000-01-05")).toBeNull();
    // Hafta/oy bugun bilan ustma-ust tushishi mumkin (dushanba, 1-sana) — birinchi mosi qaytadi.
    expect(["today", "week"]).toContain(matchQuickPeriod(week.from, week.to));
    expect(["today", "week", "month"]).toContain(matchQuickPeriod(month.from, month.to));
  });

  it("reads the total from the list response", () => {
    expect(readOrdersTotal({ data: [], total: 124 })).toBe(124);
    expect(readOrdersTotal({ data: { meta: { total: 7 } } })).toBe(7);
    expect(readOrdersTotal({ data: [] })).toBeNull();
    expect(readOrdersTotal(undefined)).toBeNull();
  });
});
