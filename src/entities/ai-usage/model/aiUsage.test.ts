import { describe, expect, it } from "vitest";
import { aiUsageParams, normalizeAiMargin, normalizeAiOrders, normalizeAiUsageDashboard } from "./aiUsage";

describe("AI xarajat paneli (Celz3rKJ) — normalizatsiya", () => {
  it("summary (son, satr emas), feature/model kesimi (xarajat bo'yicha), Toshkent kunlari, manba ulushi", () => {
    const dashboard = normalizeAiUsageDashboard({
      statusCode: 200,
      message: "ok",
      data: {
        from: "2026-09-27",
        to: "2026-10-26",
        usdUzsRate: 12650,
        summary: { totalCostUsd: "1.25", totalCostUzs: 15812, totalCalls: 41, aiOrderCount: 9, avgCostPerAiOrderUzs: 1500, avgCostPerAiOrderUsd: 0.12 },
        byFeature: [
          { feature: "order_district", area: "order", calls: 30, steps: 30, inputTokens: 900, outputTokens: 60, costUsd: 0.2, costUzs: 2530 },
          { feature: "order_extract_multi", area: "order", calls: 11, steps: 11, inputTokens: 5400, outputTokens: 1300, costUsd: 1.05, costUzs: 13282 },
        ],
        byModel: [{ model: "claude-haiku", calls: 41, costUsd: 1.25, costUzs: 15812 }],
        dailySeries: [
          { day: "2026-10-01", costUsd: 0.5, costUzs: 6325, calls: 10, aiOrders: 3 },
          { day: "2026-09-30", costUsd: 0, costUzs: 0, calls: 0, aiOrders: 0 },
          { day: "not-a-day", costUzs: 1 },
        ],
        orderSources: {
          total: 100,
          ai: 9,
          manual: 70,
          bot: 6,
          external: 10,
          branch: 5,
          shares: { ai: 9, manual: 70, bot: 6, external: 10, branch: 5 },
          applied_range: null,
        },
        degraded: false,
        failed_parts: [],
      },
    });

    expect(dashboard.summary.totalCostUsd).toBe(1.25);
    expect(dashboard.summary.totalCostUzs).toBe(15812);
    expect(dashboard.usdUzsRate).toBe(12650);
    expect(dashboard.byFeature.map((row) => row.feature)).toEqual(["order_extract_multi", "order_district"]);
    // Kun backenddan tayyor — qayta hisoblanmaydi, faqat tartiblanadi.
    expect(dashboard.dailySeries.map((day) => day.day)).toEqual(["2026-09-30", "2026-10-01"]);
    expect(dashboard.orderSources?.counts).toEqual({ ai: 9, manual: 70, bot: 6, external: 10, branch: 5 });
    expect(dashboard.orderSources?.shares.bot).toBe(6);
    expect(dashboard.degraded).toBe(false);
  });

  it("order-service javob bermadi (`orderSources: null`, `failed_parts`) — manba `null`, xarajat baribir", () => {
    const dashboard = normalizeAiUsageDashboard({
      data: { summary: { totalCostUzs: 500 }, orderSources: null, degraded: true, failed_parts: ["orderSources"] },
    });
    expect(dashboard.orderSources).toBeNull();
    expect(dashboard.degraded).toBe(true);
    expect(dashboard.summary.totalCostUzs).toBe(500);
    expect(dashboard.byFeature).toEqual([]);
  });

  it("ulushlar kelmasa (eski javob) — sondan hisoblanadi (1 xona)", () => {
    const dashboard = normalizeAiUsageDashboard({ data: { orderSources: { total: 3, ai: 1, manual: 2 } } });
    expect(dashboard.orderSources?.shares).toEqual({ ai: 33.3, manual: 66.7, bot: 0, external: 0, branch: 0 });
  });

  it("AI buyurtmalar: raqam/holat/summa, draft xarajati; id'siz qator tashlanadi", () => {
    const list = normalizeAiOrders({
      data: {
        total: 2,
        limit: 100,
        items: [
          { orderId: 81, orderNumber: "EL-100081", status: "sold", totalPrice: "185000", model: "claude-haiku", createdAt: "2026-10-26T07:00:00.000Z", draftCostUsd: 0.1, draftCostUzs: 1265, draftOrders: 3 },
          { orderId: null },
        ],
        degraded: true,
      },
    });
    expect(list.items).toHaveLength(1);
    expect(list.items[0]).toMatchObject({ orderId: "81", orderNumber: "EL-100081", totalPrice: 185000, draftOrders: 3 });
    expect(list.degraded).toBe(true);
    expect(list.total).toBe(2);
  });

  it("so'rov parametrlari: oraliq — `fromDate` / `toDate`, bo'sh — backend sukuti", () => {
    expect(aiUsageParams({ from: "2026-10-01", to: "2026-10-26" })).toEqual({ fromDate: "2026-10-01", toDate: "2026-10-26" });
    expect(aiUsageParams({ from: "", to: "" })).toEqual({});
    expect(aiUsageParams(null)).toEqual({});
  });
});

describe("normalizeAiMargin (NFiXfmq6)", () => {
  it("⭐ `totals` va market qatorlari: son satr bo'lsa ham son, eng past marja birinchi", () => {
    const report = normalizeAiMargin({
      statusCode: 200,
      data: {
        totals: { chargedUzs: "12000", costUzs: "15000", marginUzs: "-3000", aiOrders: "40", marginNegative: true },
        markets: [
          { marketId: 7, marketName: "Baraka", chargedUzs: "10000", costUzs: "4000", marginUzs: "6000", aiOrders: 30, marginNegative: false },
          { marketId: "9", marketName: "Nur", chargedUzs: 2000, costUzs: 11000, marginUzs: -9000, aiOrders: 10, marginNegative: true },
        ],
      },
    });

    expect(report).toMatchObject({ chargedUzs: 12_000, costUzs: 15_000, marginUzs: -3_000, aiOrders: 40, negative: true });
    expect(report.markets.map((row) => [row.marketId, row.marginUzs, row.negative])).toEqual([
      ["9", -9_000, true],
      ["7", 6_000, false],
    ]);
  });

  it("⭐ `marginUzs` kelmasa — olingan minus tannarx, manfiylik sonning o'zidan", () => {
    const report = normalizeAiMargin({ data: { markets: [{ marketId: 1, chargedUzs: 300, costUzs: 500 }] } });

    expect(report.markets[0]).toMatchObject({ marginUzs: -200, negative: true, marketName: null });
  });

  it("backend bayrog'i ustun: `marginNegative: true`", () => {
    const report = normalizeAiMargin({ data: { totals: { chargedUzs: 100, costUzs: 100, marginUzs: 0, marginNegative: true } } });

    expect(report).toMatchObject({ marginUzs: 0, negative: true });
  });

  it("⭐ bo'sh yoki tushunarsiz javob — nol va bo'sh ro'yxat, soxta raqam yo'q", () => {
    const empty = { chargedUzs: 0, costUzs: 0, marginUzs: 0, aiOrders: 0, negative: false, markets: [] };

    expect(normalizeAiMargin(null)).toEqual(empty);
    expect(normalizeAiMargin({ data: [] })).toEqual(empty);
    expect(normalizeAiMargin({ data: { markets: "?", totals: null } })).toEqual(empty);
  });

  it("`marketId` siz qator chiqarib tashlanadi; snake_case maydon ham o'qiladi", () => {
    const report = normalizeAiMargin({
      data: { perMarket: [{ chargedUzs: 5 }, { market_id: 3, market_name: "Ipak", chargedUzs: 5, costUzs: 1 }] },
    });

    expect(report.markets).toHaveLength(1);
    expect(report.markets[0]).toMatchObject({ marketId: "3", marketName: "Ipak", marginUzs: 4 });
  });
});
