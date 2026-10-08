import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatTrackingDate } from "./formatTrackingDate";

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
