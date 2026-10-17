import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatTrackingDate, formatTrackingDateTime, isTashkentToday } from "./formatTrackingDate";

/**
 * SANA — DOIM Asia/Tashkent zonasida.
 *
 * Test jarayoni zonasi ATAYLAB UTC qilinadi: kompyuter Toshkentda (+05) bo'lsa
 * zonasiz formatlovchi ham to'g'ri chiqardi va xato yashirinib qolardi.
 */
describe("formatTrackingDate — Asia/Tashkent", () => {
  beforeEach(() => {
    vi.stubEnv("TZ", "UTC");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("test muhiti haqiqatan UTC'da (aks holda test hech narsani isbotlamaydi)", () => {
    expect(new Date("2026-07-20T08:38:49.865Z").getHours()).toBe(8);
  });

  it("⭐ #95 yaratilgan vaqti: 08:38:49Z → 20.07.2026, 13:38:49 (Toshkent)", () => {
    expect(formatTrackingDate("2026-07-20T08:38:49.865Z")).toBe("20.07.2026, 13:38:49");
  });

  it("⭐ UTC kun siljishi yo'q: 19-iyul 20:30Z — Toshkentda allaqachon 20-iyul 01:30", () => {
    expect(formatTrackingDate("2026-07-19T20:30:00.000Z")).toBe("20.07.2026, 01:30:00");
  });

  it("epoch ms (sold_at) va Date ham qabul qilinadi; buzuq qiymat — \"—\"", () => {
    expect(formatTrackingDate(1784557174975)).toBe(formatTrackingDate(new Date(1784557174975)));
    expect(formatTrackingDate("yaroqsiz")).toBe("—");
  });
});

describe("formatTrackingDateTime — tarix yozuvi vaqti (dizayn v2), Asia/Tashkent", () => {
  beforeEach(() => {
    vi.stubEnv("TZ", "UTC");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // «Hozir» — Toshkentda 20-iyul 15:00 (UTC 10:00).
  const now = new Date("2026-07-20T10:00:00.000Z");

  it("⭐ bugun (Toshkent kuni bo'yicha) — «Bugun, 13:38»", () => {
    expect(formatTrackingDateTime("2026-07-20T08:38:49.865Z", { now })).toBe("Bugun, 13:38");
  });

  it("⭐ UTC'da 19-iyul 20:30, Toshkentda esa 20-iyul 01:30 — «Bugun», «Kecha» emas", () => {
    expect(formatTrackingDateTime("2026-07-19T20:30:00.000Z", { now })).toBe("Bugun, 01:30");
  });

  it("kecha va eskiroq; ru/en yorliqlari", () => {
    expect(formatTrackingDateTime("2026-07-19T13:00:00.000Z", { now })).toBe("Kecha, 18:00");
    expect(formatTrackingDateTime("2026-07-19T13:00:00.000Z", { now, language: "ru" })).toBe("Вчера, 18:00");
    expect(formatTrackingDateTime("2026-07-17T13:00:00.000Z", { now, language: "en" })).toBe("17.07.2026, 18:00");
  });

  it("buzuq qiymat — «—»", () => {
    expect(formatTrackingDateTime("yaroqsiz", { now })).toBe("—");
    expect(formatTrackingDateTime(null, { now })).toBe("—");
  });
});

describe("isTashkentToday (D-07)", () => {
  // «Hozir» — Toshkentda 20-iyul 15:00 (UTC 10:00).
  const now = new Date("2026-07-20T10:00:00.000Z");

  it("Toshkent kuni bo'yicha bugun — true; kecha va eski — false", () => {
    expect(isTashkentToday("2026-07-20T08:38:49.865Z", now)).toBe(true);
    // UTC'da hali 19-iyul, Toshkentda esa 20-iyul 01:30.
    expect(isTashkentToday("2026-07-19T20:30:00.000Z", now)).toBe(true);
    expect(isTashkentToday("2026-07-19T13:00:00.000Z", now)).toBe(false);
    expect(isTashkentToday("2026-10-06T09:00:00.000Z", now)).toBe(false);
  });

  it("buzuq yoki bo'sh qiymat — false", () => {
    expect(isTashkentToday("yaroqsiz", now)).toBe(false);
    expect(isTashkentToday(null, now)).toBe(false);
  });
});
