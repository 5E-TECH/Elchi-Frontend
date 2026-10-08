import { describe, expect, it } from "vitest";
import { applySettingsPatch, DEFAULT_SETTINGS, mergeSettings } from "./index";

/**
 * Bildirishnoma sozlamalari (kanal / kategoriya / sokin soatlar).
 *
 * Backend `admins.settings` ni opaque jsonb sifatida saqlaydi — shakl va
 * tozalash FAQAT shu yerda. Eski yoki buzuq qiymat ekranni yiqitmasligi va
 * patch'lar bir-birini o'chirmasligi shu testlarda qulflangan.
 */
describe("mergeSettings — notifications", () => {
  it("eski sozlama (faqat push) — push saqlanadi, qolgani default", () => {
    const merged = mergeSettings({ notifications: { push: true } });
    expect(merged.notifications).toEqual({
      ...DEFAULT_SETTINGS.notifications,
      push: true,
    });
  });

  it("default: hamma kanal yoqiq, hech narsa o'chirilmagan, sokin soat o'chiq", () => {
    const { notifications } = mergeSettings(undefined);
    expect(notifications.channels).toEqual({ in_app: true, realtime: true, telegram: true, sms: true });
    expect(notifications.muted_categories).toEqual([]);
    expect(notifications.quiet_hours).toEqual({ enabled: false, from: "22:00", to: "08:00" });
  });

  it("saqlangan qiymatlar o'qiladi", () => {
    const { notifications } = mergeSettings({
      notifications: {
        push: false,
        channels: { in_app: true, realtime: false, telegram: false, sms: true },
        muted_categories: ["marketing", "logistics"],
        quiet_hours: { enabled: true, from: "23:30", to: "07:15" },
      },
    });
    expect(notifications.channels).toEqual({ in_app: true, realtime: false, telegram: false, sms: true });
    // Katalog tartibida qaytadi.
    expect(notifications.muted_categories).toEqual(["logistics", "marketing"]);
    expect(notifications.quiet_hours).toEqual({ enabled: true, from: "23:30", to: "07:15" });
  });

  it("buzuq qiymatlar defaultga tushadi, noma'lum kategoriya va takror tashlanadi", () => {
    const { notifications } = mergeSettings({
      notifications: {
        push: "yes",
        channels: { sms: "false", telegram: 0 },
        muted_categories: ["marketing", "marketing", "spam", 42],
        quiet_hours: { enabled: "on", from: "25:00", to: "8:00" },
      },
    });
    expect(notifications.push).toBe(false);
    expect(notifications.channels.sms).toBe(true);
    expect(notifications.channels.telegram).toBe(true);
    expect(notifications.muted_categories).toEqual(["marketing"]);
    expect(notifications.quiet_hours).toEqual(DEFAULT_SETTINGS.notifications.quiet_hours);
  });

  it("muted_categories massiv bo'lmasa — bo'sh ro'yxat", () => {
    expect(mergeSettings({ notifications: { muted_categories: "marketing" } }).notifications.muted_categories).toEqual(
      [],
    );
  });
});

describe("applySettingsPatch — notifications", () => {
  const base = mergeSettings(undefined);

  it("bitta kanal o'zgaradi, qolganlari va push tegilmaydi", () => {
    const next = applySettingsPatch({ ...base, notifications: { ...base.notifications, push: true } }, {
      notifications: { channels: { sms: false } },
    });
    expect(next.notifications.channels).toEqual({ in_app: true, realtime: true, telegram: true, sms: false });
    expect(next.notifications.push).toBe(true);
  });

  it("kategoriya ovozini o'chirish va qaytarish", () => {
    const muted = applySettingsPatch(base, { notifications: { mute: { marketing: true } } });
    expect(muted.notifications.muted_categories).toEqual(["marketing"]);
    const unmuted = applySettingsPatch(muted, { notifications: { mute: { marketing: false } } });
    expect(unmuted.notifications.muted_categories).toEqual([]);
  });

  it("ketma-ket patch'lar bir-birini O'CHIRMAYDI (tez bosish)", () => {
    // Navbatdagi mutatsiyalar har biri eng so'nggi holatga qo'llanadi.
    let state = base;
    state = applySettingsPatch(state, { notifications: { mute: { order: true } } });
    state = applySettingsPatch(state, { notifications: { mute: { marketing: true } } });
    state = applySettingsPatch(state, { notifications: { mute: { finance: true } } });
    expect(state.notifications.muted_categories).toEqual(["order", "finance", "marketing"]);
  });

  it("sokin soatlar qisman yangilanadi", () => {
    const next = applySettingsPatch(base, { notifications: { quiet_hours: { enabled: true } } });
    expect(next.notifications.quiet_hours).toEqual({ enabled: true, from: "22:00", to: "08:00" });
    const later = applySettingsPatch(next, { notifications: { quiet_hours: { to: "06:30" } } });
    expect(later.notifications.quiet_hours).toEqual({ enabled: true, from: "22:00", to: "06:30" });
  });

  it("push patch'i (PushSync) yangi bo'limlarni yo'qotmaydi", () => {
    const configured = applySettingsPatch(base, {
      notifications: { channels: { telegram: false }, mute: { marketing: true } },
    });
    const next = applySettingsPatch(configured, { notifications: { push: true } });
    expect(next.notifications.push).toBe(true);
    expect(next.notifications.channels.telegram).toBe(false);
    expect(next.notifications.muted_categories).toEqual(["marketing"]);
  });
});
