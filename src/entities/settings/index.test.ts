import { describe, expect, it, vi } from "vitest";
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

/**
 * DIZAYN v2 — sukut mavzusi LIGHT (ega qarori 2026-10-09). Ilgari sukut "dark"
 * edi va to'liq sozlama har yozuvda serverga ketardi, ya'ni serverdagi "dark"
 * ko'pincha tanlov emas, eski sukut. Faqat `themeChosen: true` bilan yozilgani
 * hurmat qilinadi.
 */
describe("mergeSettings — dizayn v2 mavzu migratsiyasi", () => {
  it("⭐ belgisiz saqlangan 'dark' (eski avtomatik sukut) light'ga qaytadi", () => {
    expect(mergeSettings({ appearance: { theme: "dark", language: "ru" } }).appearance).toEqual({
      theme: "light",
      language: "ru",
    });
  });

  it("⭐ foydalanuvchi O'ZI tanlagan dark saqlanadi", () => {
    expect(mergeSettings({ appearance: { theme: "dark", language: "uz", themeChosen: true } }).appearance).toEqual({
      theme: "dark",
      language: "uz",
      themeChosen: true,
    });
  });

  it("bo'sh sozlama — light", () => {
    expect(mergeSettings(undefined).appearance.theme).toBe("light");
  });
});

describe("readStoredTheme — dizayn v2 versiya belgisi", () => {
  it("⭐ versiyasiz localStorage 'dark' e'tiborga olinmaydi, writeStoredTheme bilan yozilgani o'qiladi", async () => {
    const { readStoredTheme, writeStoredTheme } = await import("../../shared/lib/preferencesStorage");
    window.localStorage.clear();
    window.localStorage.setItem("theme", "dark");
    expect(readStoredTheme()).toBeNull();
    writeStoredTheme("dark");
    expect(readStoredTheme()).toBe("dark");
    window.localStorage.clear();
  });
});

describe("scanner.camera / scanner.feedback — Sozlamalar → Skaner → «Kamera» (skaner 4-bosqichi)", () => {
  it("eski sozlama (faqat ovozlar) — kamera va signal sukutlari: orqa, o'rta ramka, hammasi yoqiq", () => {
    const merged = mergeSettings({ scanner: { sounds: { success: "bell", error: "soft" } } });
    expect(merged.scanner).toEqual({
      sounds: { success: "bell", error: "soft" },
      camera: { facing: "environment", frame: "md", torchAuto: true, continuous: true },
      feedback: { sound: true, vibration: true, voice: true },
    });
  });

  it("saqlangan qiymatlar o'qiladi, buzuqlari sukutga tushadi", () => {
    const merged = mergeSettings({
      scanner: {
        camera: { facing: "user", frame: "xl", torchAuto: "ha", continuous: false },
        feedback: { sound: false, vibration: 0, voice: "yo'q" },
      },
    });
    expect(merged.scanner.camera).toEqual({ facing: "user", frame: "md", torchAuto: true, continuous: false });
    expect(merged.scanner.feedback).toEqual({ sound: false, vibration: true, voice: true });
  });

  it("patch bitta qiymatni o'zgartiradi, qolganlari (ovozlar ham) tegilmaydi", () => {
    const step1 = applySettingsPatch(DEFAULT_SETTINGS, { scanner: { camera: { frame: "lg" } } });
    const step2 = applySettingsPatch(step1, { scanner: { feedback: { vibration: false } } });
    expect(step2.scanner).toEqual({
      sounds: DEFAULT_SETTINGS.scanner.sounds,
      camera: { ...DEFAULT_SETTINGS.scanner.camera, frame: "lg" },
      feedback: { sound: true, vibration: false, voice: true },
    });
  });
});

describe("preferencesStorage — kamera ko'zgusi", () => {
  it("bo'sh yoki buzuq localStorage — sukut; yozilgani o'qiladi; chiqishda tozalanadi", async () => {
    const storage = await import("../../shared/lib/preferencesStorage");
    window.localStorage.clear();
    expect(storage.readStoredScannerCameraPrefs()).toEqual(storage.DEFAULT_SCANNER_CAMERA_PREFS);
    expect(storage.readStoredScannerFeedbackPrefs()).toEqual({ sound: true, vibration: true, voice: true });

    window.localStorage.setItem("scanner-frame-size", "huge");
    expect(storage.readStoredScannerCameraPrefs().frame).toBe("md");

    storage.writeStoredScannerCameraPrefs({ facing: "user", frame: "sm", continuous: false });
    storage.writeStoredScannerFeedbackPrefs({ vibration: false });
    expect(storage.readStoredScannerCameraPrefs()).toEqual({
      facing: "user",
      frame: "sm",
      torchAuto: true,
      continuous: false,
    });
    expect(storage.readStoredScannerFeedbackPrefs()).toEqual({ sound: true, vibration: false, voice: true });

    storage.clearStoredUiPreferences();
    expect(storage.readStoredScannerCameraPrefs()).toEqual(storage.DEFAULT_SCANNER_CAMERA_PREFS);
  });

  it("localStorage yopiq (xato tashlaydi) — sukut, yozish yiqilmaydi", async () => {
    const storage = await import("../../shared/lib/preferencesStorage");
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(storage.readStoredScannerCameraPrefs()).toEqual(storage.DEFAULT_SCANNER_CAMERA_PREFS);
    expect(() => storage.writeStoredScannerCameraPrefs({ frame: "lg" })).not.toThrow();
    get.mockRestore();
    set.mockRestore();
  });
});

describe("scanner.sounds — JX0EBpa7 yumshoq ovozlar va zaxira", () => {
  it("yangi ovoz ID'lari saqlanadi va o'qiladi", () => {
    const { scanner } = mergeSettings({ scanner: { sounds: { success: "marimba", error: "glass" } } });
    expect(scanner.sounds).toEqual({ success: "marimba", error: "glass" });
  });

  it("eski ID'lar buzilmaydi", () => {
    const { scanner } = mergeSettings({ scanner: { sounds: { success: "bell", error: "digital" } } });
    expect(scanner.sounds).toEqual({ success: "bell", error: "digital" });
  });

  it("noma'lum yoki buzuq ID — sukut (beepost), boshqa sozlamalar tegilmaydi", () => {
    const { scanner } = mergeSettings({
      scanner: { sounds: { success: "eski-ovoz", error: 42 }, feedback: { sound: false } },
    });
    expect(scanner.sounds).toEqual({ success: "beepost", error: "beepost" });
    expect(scanner.feedback.sound).toBe(false);
  });
});

describe("scanner.sounds — BeePost sukut ovozi va «Ovozli xabar» (2026-11-04)", () => {
  it("yangi foydalanuvchi (sozlamasiz) — BeePost ovozi, «Ovozli xabar» yoqiq", () => {
    const { scanner } = mergeSettings(undefined);
    expect(scanner.sounds).toEqual({ success: "beepost", error: "beepost" });
    expect(scanner.feedback).toEqual({ sound: true, vibration: true, voice: true });
    expect(DEFAULT_SETTINGS.scanner.sounds).toEqual({ success: "beepost", error: "beepost" });
  });

  it("tanlov belgisisiz `classic` — eski avtomatik sukut, BeePost'ga o'tadi", () => {
    const { scanner } = mergeSettings({ scanner: { sounds: { success: "classic", error: "classic" } } });
    expect(scanner.sounds).toEqual({ success: "beepost", error: "beepost" });
  });

  it("aniq tanlangan ovoz saqlanadi: belgili `classic` va har qanday boshqa ovoz", () => {
    expect(
      mergeSettings({ scanner: { sounds: { success: "classic", error: "classic", chosen: true } } }).scanner.sounds,
    ).toEqual({ success: "classic", error: "classic", chosen: true });
    // `classic` dan boshqa ovoz faqat tanlab qo'yiladi — belgisiz ham o'z o'rnida, yonidagi `classic` esa sukutga.
    expect(mergeSettings({ scanner: { sounds: { success: "chime", error: "classic" } } }).scanner.sounds).toEqual({
      success: "chime",
      error: "beepost",
    });
  });

  it("tanlov belgisi patch bilan qo'shiladi va keyingi o'qishda saqlanadi", () => {
    const current = mergeSettings({ scanner: { sounds: { success: "classic", error: "classic" } } });
    const next = applySettingsPatch(current, { scanner: { sounds: { success: "classic", chosen: true } } });
    expect(next.scanner.sounds).toEqual({ success: "classic", error: "beepost", chosen: true });
    expect(mergeSettings(next).scanner.sounds).toEqual({ success: "classic", error: "beepost", chosen: true });
  });

  it("«Ovozli xabar» o'chirilgani o'qiladi va patch faqat uni o'zgartiradi", () => {
    expect(mergeSettings({ scanner: { feedback: { voice: false } } }).scanner.feedback).toEqual({
      sound: true,
      vibration: true,
      voice: false,
    });
    const next = applySettingsPatch(DEFAULT_SETTINGS, { scanner: { feedback: { voice: false } } });
    expect(next.scanner.feedback).toEqual({ sound: true, vibration: true, voice: false });
    expect(next.scanner.sounds).toEqual(DEFAULT_SETTINGS.scanner.sounds);
  });
});
