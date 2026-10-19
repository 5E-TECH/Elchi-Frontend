import { describe, expect, it } from "vitest";
import {
  extractCourierBulkOrders,
  extractCourierBulkTotal,
  filterCourierBulkOrders,
  getCourierBulkCounts,
  getCourierBulkFinalizeLabelCounts,
  getCourierBulkUnmarkedCount,
  isCourierBulkOrderMarked,
  mergeCourierBulkOrders,
  runLimited,
  sortCourierBulkOrders,
  type CourierBulkOrder,
  type CourierBulkResultFilter,
} from "./courierBulk";

describe("courierBulk model", () => {
  it("extracts courier orders from common backend response shapes", () => {
    expect(extractCourierBulkOrders({ data: [{ id: "1" }] })).toHaveLength(1);
    expect(extractCourierBulkOrders({ data: { data: [{ id: "2" }] } })).toHaveLength(1);
    expect(extractCourierBulkOrders({ data: { items: [{ id: "3" }] } })).toHaveLength(1);
  });

  it("extracts total from paginated backend response shapes", () => {
    expect(extractCourierBulkTotal({ total: 240 })).toBe(240);
    expect(extractCourierBulkTotal({ data: { total: 241, data: [] } })).toBe(241);
    expect(extractCourierBulkTotal({ data: { meta: { total: 242 }, items: [] } })).toBe(242);
  });

  it("merges paginated orders without duplicates", () => {
    expect(mergeCourierBulkOrders([
      [{ id: "1" } as any, { id: "2" } as any],
      [{ id: "2" } as any, { id: "3" } as any],
    ]).map((order) => order.id)).toEqual(["1", "2", "3"]);
  });

  it("counts default sold and scanned actions", () => {
    const counts = getCourierBulkCounts(
      [{ id: "1" }, { id: "2" }, { id: "3" }],
      { "2": "cancel", "3": "tomorrow" },
    );

    expect(counts).toEqual({ cancel: 1, sold: 1, tomorrow: 1, total: 3 });
    expect(getCourierBulkFinalizeLabelCounts(counts)).toEqual({ changed: 2, sold: 1 });
  });

  it("counts unmarked orders (explicit «sold» is a mark)", () => {
    const orders = [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }];
    const actions = { "2": "cancel", "3": "sold" } as const;

    expect(getCourierBulkUnmarkedCount(orders, actions)).toBe(2);
    expect(isCourierBulkOrderMarked("3", actions)).toBe(true);
    expect(isCourierBulkOrderMarked("4", actions)).toBe(false);
    expect(getCourierBulkUnmarkedCount([], actions)).toBe(0);
  });

  it("filters by search (name, phone digits, id) and result — client-side", () => {
    const orders = [
      { id: "10240", customer: { name: "Laylo Hasanova", phone_number: "+998902146631" } },
      { id: "10238", customer: { name: "Javohir Toshmatov", phone_number: "+998977013345" } },
      { id: "10236", customer: { name: "Kamron Ahmedov", phone_number: "+998931182047" } },
    ] as unknown as CourierBulkOrder[];
    const actions = { "10238": "tomorrow", "10236": "sold" } as const;
    const ids = (query: string, result: CourierBulkResultFilter = "all") =>
      filterCourierBulkOrders(orders, actions, { query, result }).map((order) => order.id);

    expect(ids("")).toEqual(["10240", "10238", "10236"]);
    expect(ids("laylo")).toEqual(["10240"]);
    expect(ids("90 214")).toEqual(["10240"]);
    expect(ids("№10236")).toEqual(["10236"]);
    expect(ids("", "unmarked")).toEqual(["10240"]);
    expect(ids("", "sold")).toEqual(["10240", "10236"]);
    expect(ids("", "tomorrow")).toEqual(["10238"]);
    expect(ids("", "cancel")).toEqual([]);
    expect(ids("javohir", "sold")).toEqual([]);
  });

  it("sorts by date or amount, stable; null keeps backend order", () => {
    const orders = [
      { id: "a", total_price: 300, createdAt: "2026-10-15T08:00:00.000Z" },
      { id: "b", total_price: 100, created_at: "2026-10-16T08:00:00.000Z" },
      { id: "c", total_price: 300, createdAt: "2026-10-14T08:00:00.000Z" },
    ] as unknown as CourierBulkOrder[];
    const ids = (sort: Parameters<typeof sortCourierBulkOrders>[1]) =>
      sortCourierBulkOrders(orders, sort).map((order) => order.id);

    expect(ids({ key: "createdAt", direction: "desc" })).toEqual(["b", "a", "c"]);
    expect(ids({ key: "createdAt", direction: "asc" })).toEqual(["c", "a", "b"]);
    expect(ids({ key: "amount", direction: "desc" })).toEqual(["a", "c", "b"]);
    expect(ids({ key: "amount", direction: "asc" })).toEqual(["b", "a", "c"]);
    expect(ids(null)).toEqual(["a", "b", "c"]);
  });

  it("runs tasks with a limited queue", async () => {
    const handled: number[] = [];
    const results = await runLimited([1, 2, 3], 2, async (item) => {
      handled.push(item);
    });

    expect(handled.sort()).toEqual([1, 2, 3]);
    expect(results).toHaveLength(3);
    expect(results.every((result) => result.status === "fulfilled")).toBe(true);
  });
});
