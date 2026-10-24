import { describe, expect, it } from "vitest";
import type { RegionItem } from "../../../entities/region";
import { regionStep, summarizeRegions, toRegionRows } from "./regionModel";
import { findRegionTile, normalizeRegionName, REGION_TILES } from "./regionTileLayout";

const region = (id: string, name: string, ordersCount: number, deliveredOrders: number, extra: Partial<RegionItem> = {}): RegionItem => ({
  id,
  name,
  districtCount: 10,
  activeCouriers: 2,
  ordersCount,
  deliveredOrders,
  cancelledOrders: 0,
  pendingOrders: 0,
  totalRevenue: 0,
  successRate: 0,
  ...extra,
});

describe("regionTileLayout", () => {
  it("14 katak, takror pozitsiya yo'q", () => {
    expect(REGION_TILES).toHaveLength(14);
    const cells = new Set(REGION_TILES.map((tile) => `${tile.row}:${tile.col}`));
    expect(cells.size).toBe(14);
  });

  it("API nomlari kataklarga moslashadi (apostrof, «viloyati», «Respublikasi», Toshkent shahri/viloyati)", () => {
    expect(normalizeRegionName("Toshkent shahri")).toBe("toshkentshahri");
    expect(normalizeRegionName("Toshkent sh.")).toBe("toshkentshahri");
    expect(normalizeRegionName("Toshkent viloyati")).toBe("toshkentviloyati");
    expect(normalizeRegionName("Toshkent")).toBe("toshkentviloyati");
    expect(normalizeRegionName("Farg'ona viloyati")).toBe("fargona");
    expect(normalizeRegionName("Fargʻona")).toBe("fargona");
    expect(normalizeRegionName("Qoraqalpog'iston Respublikasi")).toBe("qoraqalpogiston");
    expect(findRegionTile("Samarqand viloyati")?.short).toBe("SM");
    expect(findRegionTile("Noma'lum")).toBeUndefined();
  });
});

describe("regionModel", () => {
  it("qatorlar buyurtma bo'yicha kamayadi; foiz yo'q bo'lsa sotilgan/jami dan", () => {
    const rows = toRegionRows([
      region("2", "Samarqand viloyati", 31, 24),
      region("1", "Toshkent shahri", 112, 91, { successRate: 81.3 }),
    ]);
    expect(rows.map((row) => row.name)).toEqual(["Toshkent sh.", "Samarqand"]);
    expect(rows[0].rate).toBe(81.3);
    expect(rows[1].rate).toBeCloseTo(77.42, 1);
  });

  it("shkala pog'onalari: buyurtmalar 1–9 · 10–29 · 30–79 · 80+, 0 — bo'sh", () => {
    const [a, b, c, d, e] = toRegionRows([
      region("a", "Andijon", 0, 0),
      region("b", "Buxoro", 5, 1),
      region("c", "Navoiy", 12, 5),
      region("d", "Jizzax", 40, 30),
      region("e", "Xorazm", 90, 80),
    ]).sort((x, y) => x.orders - y.orders);
    expect([a, b, c, d, e].map((row) => regionStep(row, "orders", 0))).toEqual([0, 1, 2, 3, 4]);
  });

  it("xulosa: eng ko'p, eng past sotuv va eng yuqori bekor ulushi — faqat 10+ ta", () => {
    const summary = summarizeRegions(
      toRegionRows([
        region("1", "Toshkent shahri", 112, 91),
        region("2", "Andijon", 21, 15, { cancelledOrders: 3 }),
        region("3", "Navoiy", 5, 1, { cancelledOrders: 4 }),
      ]),
    );
    expect(summary.top?.name).toBe("Toshkent sh.");
    expect(summary.lowest?.name).toBe("Andijon");
    expect(summary.mostCancelled?.name).toBe("Andijon");
    expect(summary.totalOrders).toBe(138);
    expect(summary.activeCouriers).toBe(6);
    expect(summary.regionsWithCouriers).toBe(3);
  });

  it("o2j9uDtT: backend kuryerlar sonini bermasa (`couriersKnown: false`) — yolg'on 0 emas, «ma'lum emas»", () => {
    const unknown = toRegionRows([
      region("1", "Toshkent shahri", 20, 10, { activeCouriers: 0, couriersKnown: false }),
      region("2", "Andijon", 12, 6, { activeCouriers: 0, couriersKnown: false }),
    ]);
    expect(unknown.every((row) => row.couriersKnown === false)).toBe(true);
    const summary = summarizeRegions(unknown);
    expect(summary.couriersKnown).toBe(false);
    expect(summary.regionsWithCouriers).toBe(0);

    // Aralash: faqat ma'lum hududlar qo'shiladi; belgi yo'q (eski javob) — ma'lum hisoblanadi.
    const mixed = summarizeRegions(
      toRegionRows([
        region("1", "Toshkent shahri", 20, 10, { activeCouriers: 3, couriersKnown: true }),
        region("2", "Andijon", 12, 6, { activeCouriers: 0, couriersKnown: false }),
        region("3", "Buxoro", 11, 6, { activeCouriers: 2 }),
      ]),
    );
    expect(mixed.couriersKnown).toBe(true);
    expect(mixed.activeCouriers).toBe(5);
    expect(mixed.regionsWithCouriers).toBe(2);
  });
});
