import { describe, expect, it } from "vitest";
import type { SmsReport, SmsReportDay } from "../../../entities/sms";
import {
  addDays,
  buildDaily,
  daysBetween,
  defaultReportRange,
  deliveryZone,
  reportQueryRange,
  sortDayRows,
  summarizeByClass,
  summarizeTotals,
  tashkentDay,
} from "./smsReport";

const row = (
  day: string,
  message_class: SmsReportDay["message_class"],
  extra: Partial<SmsReportDay> = {},
): SmsReportDay => ({
  day,
  message_class,
  total: 0,
  delivered: 0,
  failed: 0,
  parts: 0,
  cost: 0,
  untariffed: 0,
  ...extra,
});

const ROWS: SmsReportDay[] = [
  row("2026-10-07", "transactional", {
    total: 1412,
    delivered: 1389,
    failed: 23,
    parts: 1507,
    cost: 173305,
  }),
  row("2026-10-07", "promo", {
    total: 2480,
    delivered: 2391,
    failed: 89,
    parts: 4960,
    cost: 793600,
  }),
  row("2026-10-07", "security", {
    total: 52,
    delivered: 51,
    failed: 1,
    parts: 52,
    cost: 0,
    untariffed: 52,
  }),
  row("2026-10-08", "transactional", {
    total: 1236,
    delivered: 1168,
    failed: 14,
    parts: 1318,
    cost: 151570,
  }),
];

describe("smsReport — kunlar va davr", () => {
  it("Toshkent kuni (UTC+5): 19:30 UTC — ertasi kun", () => {
    expect(tashkentDay(new Date("2026-10-07T19:30:00Z"))).toBe("2026-10-08");
    expect(tashkentDay(new Date("2026-10-07T18:59:00Z"))).toBe("2026-10-07");
  });

  it("sukut davri — oxirgi 30 kun, so'rov yarim ochiq oraliq (+05:00) — avvalgi xulq", () => {
    const range = defaultReportRange(new Date("2026-10-08T06:00:00Z"));
    expect(range).toEqual({ from: "2026-09-09", to: "2026-10-08" });
    expect(daysBetween(range.from, range.to)).toHaveLength(30);
    expect(reportQueryRange("2026-09-09", "2026-10-08")).toEqual({
      from: "2026-09-09T00:00:00+05:00",
      to: "2026-10-09T00:00:00+05:00",
    });
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("kunlik qatorlar: bo'sh kunlar nol bilan, sinflar bo'yicha yig'indi", () => {
    const daily = buildDaily(ROWS, "2026-10-06", "2026-10-08");
    expect(daily.map((point) => point.day)).toEqual(["2026-10-06", "2026-10-07", "2026-10-08"]);
    expect(daily[0]).toMatchObject({ total: 0, parts: 0, cost: 0 });
    expect(daily[1]).toMatchObject({
      transactional: 1412,
      promo: 2480,
      security: 52,
      total: 3944,
      parts: 6519,
      cost: 966905,
    });
  });
});

describe("smsReport — yig'indilar", () => {
  it("sinflar: kutilmoqda = jami − yetkazildi − xato; ulush; tariflanmagan sinf belgisi", () => {
    const [transactional, promo, security] = summarizeByClass(ROWS);
    expect(transactional).toMatchObject({
      total: 2648,
      delivered: 2557,
      failed: 37,
      pending: 54,
      cost: 324875,
      notCounted: false,
    });
    expect(promo.costShare).toBeCloseTo((793600 / (324875 + 793600)) * 100, 5);
    expect(security).toMatchObject({ notCounted: true, cost: 0, costShare: 0 });
    expect(security.deliveryRate).toBeCloseTo((51 / 52) * 100, 5);
  });

  it("jami: yetkazilish = yetkazildi / jami yuborilgan (maket yorlig'i), kuniga o'rtacha, 1 SMS = N bo'lak", () => {
    const report: SmsReport = {
      days: ROWS,
      totals: {
        total: 5180,
        delivered: 4999,
        failed: 127,
        parts: 7837,
        cost: 1118475,
        untariffed: 52,
        success_rate: 97.5,
        tariff_configured: true,
      },
    };
    const totals = summarizeTotals(report, 2);
    expect(totals.deliveryRate).toBeCloseTo((4999 / 5180) * 100, 5);
    expect(totals.pending).toBe(54);
    expect(totals.perDay).toBe(2590);
    expect(totals.partsPerSms).toBeCloseTo(7837 / 5180, 5);
  });

  it("zona: ≥ 70 yashil, 40–70 sariq, < 40 qizil", () => {
    expect(deliveryZone(96.8)).toBe("success");
    expect(deliveryZone(70)).toBe("success");
    expect(deliveryZone(55)).toBe("warning");
    expect(deliveryZone(12)).toBe("danger");
  });

  it("«Kunlar bo'yicha»: yangi kun tepada, kun ichida maket tartibi", () => {
    expect(sortDayRows(ROWS).map((item) => `${item.day}/${item.message_class}`)).toEqual([
      "2026-10-08/transactional",
      "2026-10-07/transactional",
      "2026-10-07/promo",
      "2026-10-07/security",
    ]);
  });
});
