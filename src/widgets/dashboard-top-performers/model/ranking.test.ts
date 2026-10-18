import { describe, expect, it } from "vitest";
import type { RankingMeta } from "../../../entities/dashboard";
import type { PerformerRow } from "../lib/rankItems";
import { isLowDataRanking, rankingDescription, rankingPeriodLabel } from "./ranking";

/**
 * Reyting izohidagi davr va «Kam ma'lumot» qoidasi (9zbSDkUI, taxta `tizim-charts`). Avval dev'dagi
 * `RankingCard.test.tsx` da edi — karta `TopRankCard` ga birlashtirildi, qoidalar shu yerda.
 */

const meta = (over: Partial<RankingMeta>): RankingMeta => ({
  periodRule: null,
  periodDays: null,
  from: null,
  to: null,
  minOrders: 1,
  filteredOut: null,
  ...over,
});

const label = (count: number) => `oxirgi ${count} kun`;
const row = (total: number): PerformerRow => ({ id: `r-${total}`, name: "Market", total, successful: 1, rate: 50 });

describe("rankingPeriodLabel / rankingDescription", () => {
  it("izohda davr: last_30_days — «oxirgi 30 kun», selected_range — sanalar, meta yo'q — faqat formula", () => {
    const formula = "Sotuv foizi · sotilgan / jami";
    expect(rankingDescription(formula, meta({ periodRule: "last_30_days", periodDays: 30 }), label)).toBe(
      "Sotuv foizi · sotilgan / jami · oxirgi 30 kun",
    );
    expect(
      rankingDescription(
        formula,
        meta({ periodRule: "selected_range", from: "2026-10-12T07:00:00.000Z", to: "2026-10-15T07:00:00.000Z" }),
        label,
      ),
    ).toBe("Sotuv foizi · sotilgan / jami · 12.10 – 15.10.2026");
    expect(rankingDescription(formula, null, label)).toBe("Sotuv foizi · sotilgan / jami");
  });

  it("noma'lum qoida va sanasiz meta — davr yozilmaydi; «Barchasi» (1970 dan) — oraliq emas", () => {
    expect(rankingPeriodLabel(meta({ periodRule: "last_30_days" }), label)).toBe("oxirgi 30 kun");
    expect(rankingPeriodLabel(meta({ periodRule: "all_time" }), label)).toBeNull();
    expect(rankingPeriodLabel(meta({ periodRule: "selected_range", from: "yaroqsiz", to: "2026-10-15" }), label)).toBeNull();
    expect(rankingPeriodLabel(undefined, label)).toBeNull();
    expect(
      rankingPeriodLabel(meta({ periodRule: "selected_range", from: "1970-01-01T00:00:00+05:00", to: "2026-10-17T23:59:59+05:00" }), label),
    ).toBeNull();
    expect(
      rankingPeriodLabel(meta({ periodRule: "selected_range", from: "1969-12-31T19:00:00.000Z", to: "2026-10-17T12:00:00.000Z" }), label),
    ).toBeNull();
  });

  it("davr Toshkent kuni bo'yicha — brauzer zonasi (UTC) boshlanishni bir kun oldin ko'rsatmaydi", () => {
    // Backend: «Bu hafta» = 12.10 00:00 – 15.10 23:59 Toshkent.
    expect(
      rankingPeriodLabel(meta({ periodRule: "selected_range", from: "2026-10-11T19:00:00.000Z", to: "2026-10-15T18:59:59.999Z" }), label),
    ).toBe("12.10 – 15.10.2026");
    expect(rankingPeriodLabel(meta({ periodRule: "selected_range", from: "2026-10-12", to: "2026-10-15" }), label)).toBe(
      "12.10 – 15.10.2026",
    );
  });
});

describe("isLowDataRanking («Kam ma'lumot»)", () => {
  it("30 dan kam buyurtmali qator yoki chetda qolganlar (`filteredOut`) — izoh kerak", () => {
    expect(isLowDataRanking([row(45), row(18)], null)).toBe(true);
    expect(isLowDataRanking([row(45), row(30)], meta({ filteredOut: 2 }))).toBe(true);
  });

  it("hammasi 30+ va chetda qolgan yo'q — izoh yo'q", () => {
    expect(isLowDataRanking([row(45), row(30)], meta({ filteredOut: 0 }))).toBe(false);
    expect(isLowDataRanking([], undefined)).toBe(false);
  });
});
