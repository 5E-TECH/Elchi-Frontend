import { describe, expect, it } from "vitest";
import type { RegionItem } from "../../../entities/region";
import { buildLogistDashboard, logistRegionHref, regionStatsParams } from "./logistDashboard";

const item = (id: string, logistId: string | null, total: number, delivered: number, cancelled: number, couriersKnown = true): RegionItem => ({
  id,
  name: `${id} viloyati`,
  districtCount: 3,
  activeCouriers: 2,
  totalCouriers: 4,
  ordersCount: total,
  deliveredOrders: delivered,
  cancelledOrders: cancelled,
  pendingOrders: 0,
  totalRevenue: 1_000_000,
  successRate: 0,
  couriersKnown,
  logistId,
});

describe("buildLogistDashboard (LG-1)", () => {
  it("faqat o'z viloyatlari; jarayonda = jami − sotilgan − bekor; pul modelda yo'q", () => {
    const model = buildLogistDashboard([item("A", "1", 10, 6, 2), item("B", "2", 50, 40, 5), item("C", "1", 0, 0, 0)], "1");
    expect(model.rows.map((row) => row.name)).toEqual(["A", "C"]);
    expect(model.summary).toEqual({
      regionCount: 2,
      total: 10,
      delivered: 6,
      cancelled: 2,
      pending: 2,
      rate: 60,
      activeCouriers: 4,
      totalCouriers: 8,
    });
    expect(JSON.stringify(model)).not.toMatch(/revenue|Revenue/);
  });

  it("muvaffaqiyat — eng pastdan, buyurtmasizlar oxirida; ekstremumlar faqat ≥ 2 buyurtmali viloyatda", () => {
    const model = buildLogistDashboard(
      [item("A", "1", 10, 9, 0), item("B", "1", 0, 0, 0), item("C", "1", 10, 5, 1)],
      "1",
    );
    expect(model.bySuccess.map((row) => row.name)).toEqual(["C", "A", "B"]);
    expect(model.extremes?.lowest.name).toBe("C");
    expect(model.extremes?.highest.name).toBe("A");
    expect(buildLogistDashboard([item("A", "1", 10, 9, 0)], "1").extremes).toBeNull();
  });

  it("kuryerlar soni noma'lum bo'lsa — jami ham noma'lum (null)", () => {
    const model = buildLogistDashboard([item("A", "1", 1, 1, 0), item("B", "1", 1, 0, 0, false)], "1");
    expect(model.summary.activeCouriers).toBeNull();
    expect(model.summary.totalCouriers).toBeNull();
    expect(model.rows.find((row) => row.name === "B")?.activeCouriers).toBeNull();
  });

  it("logist aniqlanmasa — bo'sh", () => {
    expect(buildLogistDashboard([item("A", "1", 1, 1, 0)], null).rows).toEqual([]);
  });
});

describe("regionStatsParams", () => {
  it("«Barchasi» — sanasiz, qolgani aniq kunlar", () => {
    expect(regionStatsParams({ kind: "all", range: { from: "1970-01-01", to: "2026-10-21" } })).toEqual({});
    expect(regionStatsParams({ kind: "today", range: { from: "2026-10-21", to: "2026-10-21" } })).toEqual({
      startDate: "2026-10-21",
      endDate: "2026-10-21",
    });
  });
});

describe("logistRegionHref (LG-3: «Tafsilot» bosh sahifa davri bilan)", () => {
  const range = { from: "2026-10-19", to: "2026-10-21" };
  it("bugun · bu oy · barchasi — `/regions` tezkor davri", () => {
    expect(logistRegionHref("6", { kind: "today", range })).toBe("/regions?region=6&period=today");
    expect(logistRegionHref("6", { kind: "month", range })).toBe("/regions?region=6&period=month");
    expect(logistRegionHref("6", { kind: "all", range })).toBe("/regions?region=6&period=all");
  });
  it("hafta, yil, oraliq — aynan shu kunlar (`period=custom`), id kodlanadi", () => {
    expect(logistRegionHref("6", { kind: "week", range })).toBe(
      "/regions?region=6&period=custom&startDate=2026-10-19&endDate=2026-10-21",
    );
    expect(logistRegionHref("a b", { kind: "year", range: { from: "2025-01-01", to: "2025-12-31" } })).toBe(
      "/regions?region=a+b&period=custom&startDate=2025-01-01&endDate=2025-12-31",
    );
  });
});
