import { describe, expect, it } from "vitest";
import { normalizeCancelReasonStats } from "./cancelReasonStats";

describe("normalizeCancelReasonStats (GNWDKvmZ)", () => {
  it("⭐ ko'pi birinchi, ulush `count / total`, son 0 sabab chiqmaydi", () => {
    const stats = normalizeCancelReasonStats({
      statusCode: 200,
      data: {
        total: 8,
        by_reason: [
          { reason: "OTHER", label: "Boshqa", count: 2 },
          { reason: "CUSTOMER_REFUSED", label: "Mijoz rad etdi", count: "6" },
          { reason: "WRONG_ADDRESS", label: "Manzil noto'g'ri", count: 0 },
        ],
        applied_range: { startDate: "2026-10-01", endDate: "2026-10-31" },
      },
    });

    expect(stats.total).toBe(8);
    expect(stats.reasons.map((row) => [row.reason, row.count, row.share])).toEqual([
      ["CUSTOMER_REFUSED", 6, 75],
      ["OTHER", 2, 25],
    ]);
    expect(stats.appliedRange).toEqual({ from: "2026-10-01", to: "2026-10-31" });
  });

  it("`total` kelmasa — qatorlar yig'indisi", () => {
    expect(normalizeCancelReasonStats({ by_reason: [{ reason: "OTHER", count: 3 }] }).total).toBe(3);
  });

  it("sababsiz qator `UNKNOWN` bo'ladi, backend yorlig'i saqlanadi", () => {
    const [row] = normalizeCancelReasonStats({ data: { by_reason: [{ reason: null, label: "Noma'lum", count: 1 }] } }).reasons;

    expect(row).toMatchObject({ reason: "UNKNOWN", label: "Noma'lum" });
  });

  it("⭐ bo'sh yoki tushunarsiz javob — nol, soxta qator yo'q", () => {
    const empty = { total: 0, reasons: [], appliedRange: null };

    expect(normalizeCancelReasonStats(null)).toEqual(empty);
    expect(normalizeCancelReasonStats({ data: [] })).toEqual(empty);
    expect(normalizeCancelReasonStats({ data: { total: "?", by_reason: "?" } })).toEqual(empty);
  });
});
