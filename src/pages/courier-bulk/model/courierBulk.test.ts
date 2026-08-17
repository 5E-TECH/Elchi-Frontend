import { describe, expect, it } from "vitest";
import {
  extractCourierBulkOrders,
  extractCourierBulkTotal,
  findCourierBulkOrderByScanCandidates,
  getCourierBulkCounts,
  getCourierBulkFinalizeLabelCounts,
  mergeCourierBulkOrders,
  runLimited,
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

  it("finds order by scanner id or token candidates", () => {
    const orders = [
      { id: "1", qr_code_token: "abc-token" },
      { id: "2", qr_code_token: "xyz-token" },
    ] as any[];

    expect(findCourierBulkOrderByScanCandidates(orders, ["2"])?.id).toBe("2");
    expect(findCourierBulkOrderByScanCandidates(orders, ["abc-token"])?.id).toBe("1");
    expect(findCourierBulkOrderByScanCandidates(orders, ["missing"])).toBeUndefined();
  });

  it("counts default sold and scanned actions", () => {
    const counts = getCourierBulkCounts(
      [{ id: "1" }, { id: "2" }, { id: "3" }],
      { "2": "cancel", "3": "tomorrow" },
    );

    expect(counts).toEqual({ cancel: 1, sold: 1, tomorrow: 1, total: 3 });
    expect(getCourierBulkFinalizeLabelCounts(counts)).toEqual({ changed: 2, sold: 1 });
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
