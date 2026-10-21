import { describe, expect, it } from "vitest";
import {
  minutesToHhmm,
  quietHoursNotice,
  smsCampaignErrorKind,
  smsDailyQuota,
  tashkentMinuteOfDay,
} from "./campaign";

const QUIET = { start: 18 * 60, end: 9 * 60 };
/** Toshkent (UTC+5) devor soati → UTC vaqt belgisi. */
const tashkent = (hhmm: string) => new Date(`2026-10-21T${hhmm}:00+05:00`).getTime();

describe("KM-1 SMS kampaniya yordamchilari", () => {
  it("Toshkent soati — UTC+5, kun chegarasidan o'tadi", () => {
    expect(tashkentMinuteOfDay(new Date("2026-10-21T14:10:00Z"))).toBe(19 * 60 + 10);
    expect(tashkentMinuteOfDay(new Date("2026-10-21T20:30:00Z"))).toBe(1 * 60 + 30);
    expect(minutesToHhmm(9 * 60)).toBe("09:00");
    expect(minutesToHhmm(19 * 60 + 5)).toBe("19:05");
  });

  it("⭐ tungi taqiq: kechqurun — «ertaga 09:00», tunda — «bugun 09:00», kunduzi — izoh yo'q", () => {
    expect(quietHoursNotice(QUIET, tashkent("19:10"))).toEqual({ now: 19 * 60 + 10, sendAt: 9 * 60, day: "tomorrow" });
    expect(quietHoursNotice(QUIET, tashkent("18:00"))).toMatchObject({ day: "tomorrow" });
    expect(quietHoursNotice(QUIET, tashkent("03:00"))).toEqual({ now: 3 * 60, sendAt: 9 * 60, day: "today" });
    expect(quietHoursNotice(QUIET, tashkent("09:00"))).toBeNull();
    expect(quietHoursNotice(QUIET, tashkent("12:00"))).toBeNull();
  });

  it("taqiq oynasi yarim tundan o'tmasa ham ishlaydi; start = end yoki noma'lum — o'chiq", () => {
    expect(quietHoursNotice({ start: 1 * 60, end: 6 * 60 }, tashkent("02:00"))).toMatchObject({ day: "today" });
    expect(quietHoursNotice({ start: 1 * 60, end: 6 * 60 }, tashkent("07:00"))).toBeNull();
    expect(quietHoursNotice({ start: 600, end: 600 }, tashkent("10:00"))).toBeNull();
    expect(quietHoursNotice(undefined, tashkent("19:00"))).toBeNull();
  });

  it("kunlik limit: qoldiq ≥ 0; son bo'lmasa — noma'lum (null)", () => {
    expect(smsDailyQuota({ used_today: 80, daily_cap: 500 })).toEqual({ used: 80, cap: 500, remaining: 420 });
    expect(smsDailyQuota({ used_today: 620, daily_cap: 500 })).toEqual({ used: 620, cap: 500, remaining: 0 });
    expect(smsDailyQuota({ daily_cap: 500 })).toBeNull();
    expect(smsDailyQuota({ used_today: 1, daily_cap: 0 })).toBeNull();
    expect(smsDailyQuota(undefined)).toBeNull();
  });

  it("xato turi HTTP holatidan (gateway `reason` ni bermaydi)", () => {
    const http = (status: number) => ({ response: { status, data: { message: "xom matn" } } });
    expect(smsCampaignErrorKind(http(400))).toBe("badRequest");
    expect(smsCampaignErrorKind(http(409))).toBe("conflict");
    expect(smsCampaignErrorKind(http(504))).toBe("timeout");
    expect(smsCampaignErrorKind({ code: "ECONNABORTED" })).toBe("timeout");
    expect(smsCampaignErrorKind(http(403))).toBe("forbidden");
    expect(smsCampaignErrorKind(http(500))).toBe("unknown");
    expect(smsCampaignErrorKind(new Error("x"))).toBe("unknown");
  });
});
