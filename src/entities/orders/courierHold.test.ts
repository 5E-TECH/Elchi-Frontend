import { describe, expect, it } from "vitest";
import {
  canViewCourierHold,
  courierHoldHours,
  courierHoldLevel,
  isCourierHoldFilter,
  parseCourierHoldFilter,
  toCourierHoldSummary,
} from "./courierHold";

/**
 * onXzDc5n — kuryerdagi buyurtmalar: filtr qiymatlari, kim ko'radi (backend `COURIER_HOLD_ROLES` bilan bir xil),
 * soat va daraja (36 / 48 / 72 chegaralari), jamlama javobini o'qish.
 */
describe("courierHold (onXzDc5n)", () => {
  it("⭐ filtr: faqat any / near_48 / over_48 / over_72 (kichik harfga), boshqasi — bo'sh", () => {
    for (const value of ["any", "near_48", "over_48", "over_72"]) {
      expect(isCourierHoldFilter(value)).toBe(true);
      expect(parseCourierHoldFilter(` ${value.toUpperCase()} `)).toBe(value);
    }
    expect(parseCourierHoldFilter("72")).toBe("");
    expect(parseCourierHoldFilter("over_96")).toBe("");
    expect(parseCourierHoldFilter(undefined)).toBe("");
    expect(parseCourierHoldFilter(["over_72"])).toBe("");
  });

  it("⭐ kim ko'radi: superadmin, admin, menejer, kuryer, market; registrator / operator / market operatori / logist — yo'q", () => {
    for (const role of ["superadmin", "admin", "manager", "courier", "market", " Market "]) {
      expect(canViewCourierHold(role), role).toBe(true);
    }
    for (const role of ["registrator", "operator", "market_operator", "logist", "investor", "", null, undefined]) {
      expect(canViewCourierHold(role), String(role)).toBe(false);
    }
  });

  it("⭐ soat — to'liq soat (pastga), kelajak — 0; sana yo'q / noto'g'ri — null", () => {
    const now = Date.parse("2026-11-27T12:00:00.000Z");
    expect(courierHoldHours("2026-11-26T00:00:00.000Z", now)).toBe(36);
    expect(courierHoldHours("2026-11-26T00:00:01.000Z", now)).toBe(35);
    expect(courierHoldHours("2026-11-24T12:00:00.000Z", now)).toBe(72);
    expect(courierHoldHours("2026-11-28T00:00:00.000Z", now)).toBe(0);
    expect(courierHoldHours(null, now)).toBeNull();
    expect(courierHoldHours("falonchi", now)).toBeNull();
  });

  it("⭐ daraja: <36 oddiy · 36–48 yaqin · 48–72 muddat o'tgan · 72+ jiddiy (chegaralar backend bilan bir xil)", () => {
    expect(courierHoldLevel(null)).toBe("ok");
    expect(courierHoldLevel(35)).toBe("ok");
    expect(courierHoldLevel(36)).toBe("near");
    expect(courierHoldLevel(47)).toBe("near");
    expect(courierHoldLevel(48)).toBe("over_48");
    expect(courierHoldLevel(71)).toBe("over_48");
    expect(courierHoldLevel(72)).toBe("over_72");
  });

  it("jamlama javobi: `{ data }` ichidan, kuryer ismi/telefoni, noto'g'ri qator tashlanadi, `totals` bo'lmasa — yig'indi", () => {
    const summary = toCourierHoldSummary({
      statusCode: 200,
      data: {
        couriers: [
          {
            courier_id: "26",
            total: 3,
            under_36: 1,
            near_48: 1,
            over_48: "0",
            over_72: 1,
            oldest_since: "2026-11-23T08:00:00.000Z",
            oldest_hours: 98,
            cancelled_held: 2,
            courier: { id: "26", name: " Aziz ", phone_number: "+998901112233" },
          },
          { total: 5 },
          { courier_id: 27, total: 1, under_36: 1, oldest_hours: null, courier: { id: "27", name: null, phone_number: null } },
        ],
      },
    });
    expect(summary.couriers).toEqual([
      {
        courierId: "26",
        name: "Aziz",
        phone: "+998901112233",
        total: 3,
        under36: 1,
        near48: 1,
        over48: 0,
        over72: 1,
        oldestSince: "2026-11-23T08:00:00.000Z",
        oldestHours: 98,
        cancelledHeld: 2,
      },
      expect.objectContaining({ courierId: "27", name: null, phone: null, total: 1, oldestHours: null }),
    ]);
    expect(summary.totals).toMatchObject({ couriers: 2, total: 4, near48: 1, over72: 1, cancelledHeld: 2 });

    const withTotals = toCourierHoldSummary({
      couriers: [],
      totals: { couriers: 4, total: 9, under_36: 2, near_48: 3, over_48: 1, over_72: 3, cancelled_held: 1, oldest_hours: 80 },
    });
    expect(withTotals.totals).toEqual({
      couriers: 4,
      total: 9,
      under36: 2,
      near48: 3,
      over48: 1,
      over72: 3,
      cancelledHeld: 1,
      oldestHours: 80,
    });
    expect(toCourierHoldSummary(null).couriers).toEqual([]);
  });
});
