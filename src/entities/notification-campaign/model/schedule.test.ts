import { describe, expect, it } from "vitest";
import {
  firstAvailableSlot,
  isFutureSlot,
  isQuietTime,
  quietReleaseMoment,
  relativeTashkentDay,
  scheduleDayRange,
  scheduleTimeSlots,
  tashkentNowIso,
  tashkentToday,
  toScheduledAt,
  toTashkentMoment,
} from "./schedule";

/** 2026-10-21 19:10 Toshkent = 14:10 UTC. */
const EVENING = Date.parse("2026-10-21T14:10:00Z");
const QUIET = { start: "18:00", end: "09:00", enabled: true };

describe("schedule (KM-3) — Toshkent vaqti, brauzer mintaqasidan qat'i nazar", () => {
  it("lahza → Toshkent kuni va soati; yarim tundan o'tganda kun almashadi", () => {
    expect(toTashkentMoment("2026-10-21T14:10:00Z")).toEqual({ day: "2026-10-21", time: "19:10" });
    expect(toTashkentMoment("2026-10-21T20:30:00Z")).toEqual({ day: "2026-10-22", time: "01:30" });
    expect(toTashkentMoment("2026-10-22T10:00:00+05:00")).toEqual({ day: "2026-10-22", time: "10:00" });
    expect(toTashkentMoment("bo'sh")).toBeNull();
    expect(toTashkentMoment(null)).toBeNull();
  });

  it("scheduled_at — aniq zona bilan (+05:00), «hozir» ham", () => {
    expect(toScheduledAt("2026-10-22", "10:00")).toBe("2026-10-22T10:00:00+05:00");
    expect(tashkentNowIso(EVENING)).toBe("2026-10-21T19:10:00+05:00");
    expect(tashkentToday(Date.parse("2026-10-21T19:30:00Z"))).toBe("2026-10-22");
  });

  it("30 daqiqali soatlar: 48 ta, 00:00 dan 23:30 gacha", () => {
    const slots = scheduleTimeSlots();
    expect(slots).toHaveLength(48);
    expect(slots[0]).toBe("00:00");
    expect(slots.at(-1)).toBe("23:30");
  });

  it("taqiq oynasi: yarim tundan o'tadigan (18–09), oddiy oyna, o'chiq va noma'lum", () => {
    expect(isQuietTime("18:00", QUIET)).toBe(true);
    expect(isQuietTime("23:30", QUIET)).toBe(true);
    expect(isQuietTime("08:30", QUIET)).toBe(true);
    expect(isQuietTime("09:00", QUIET)).toBe(false);
    expect(isQuietTime("17:30", QUIET)).toBe(false);
    expect(isQuietTime("13:30", { start: "13:00", end: "14:00", enabled: true })).toBe(true);
    expect(isQuietTime("14:00", { start: "13:00", end: "14:00", enabled: true })).toBe(false);
    expect(isQuietTime("20:00", { ...QUIET, enabled: false })).toBe(false);
    expect(isQuietTime("20:00", null)).toBe(false);
  });

  it("o'tgan vaqt tanlanmaydi; kunlar — bugundan 90 kungacha", () => {
    expect(isFutureSlot("2026-10-21", "19:00", EVENING)).toBe(false);
    expect(isFutureSlot("2026-10-21", "19:30", EVENING)).toBe(true);
    expect(scheduleDayRange(90, EVENING)).toEqual({ min: "2026-10-21", max: "2027-01-18" });
  });

  it("kunning birinchi bo'sh soati: reklamada taqiq soatlari o'tkazib yuboriladi", () => {
    expect(firstAvailableSlot("2026-10-21", { quiet: QUIET, promo: false, now: EVENING })).toBe("19:30");
    // Bugun kechqurun — reklama uchun bo'sh soat qolmagan.
    expect(firstAvailableSlot("2026-10-21", { quiet: QUIET, promo: true, now: EVENING })).toBeNull();
    expect(firstAvailableSlot("2026-10-22", { quiet: QUIET, promo: true, now: EVENING })).toBe("09:00");
  });

  it("«Darhol» reklama taqiqda: kechqurun — ertaga 09:00, tunda — bugun 09:00, kunduzi — yo'q", () => {
    expect(quietReleaseMoment(QUIET, EVENING)).toEqual({ day: "2026-10-22", time: "09:00" });
    expect(quietReleaseMoment(QUIET, Date.parse("2026-10-20T22:00:00Z"))).toEqual({
      day: "2026-10-21",
      time: "09:00",
    });
    expect(quietReleaseMoment(QUIET, Date.parse("2026-10-21T07:00:00Z"))).toBeNull();
    expect(quietReleaseMoment(null, EVENING)).toBeNull();
  });

  it("bugun / ertaga / kecha — Toshkent kuni bo'yicha", () => {
    expect(relativeTashkentDay("2026-10-21", EVENING)).toBe("today");
    expect(relativeTashkentDay("2026-10-22", EVENING)).toBe("tomorrow");
    expect(relativeTashkentDay("2026-10-20", EVENING)).toBe("yesterday");
    expect(relativeTashkentDay("2026-10-06", EVENING)).toBeNull();
  });
});
