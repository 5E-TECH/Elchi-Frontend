import { describe, expect, it } from "vitest";
import { aiUsageParams, normalizeAiOrders, normalizeAiUsageDashboard } from "./aiUsage";

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
