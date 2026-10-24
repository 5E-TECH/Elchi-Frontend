import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authClient, login, refreshAccessToken } from "./authService";
import { DEVICE_ID_STORAGE_KEY } from "./deviceId";
import {
  DEVICE_NAME_MAX,
  DEVICE_NAME_STORAGE_KEY,
  deviceNameFromHints,
  deviceNameFromUserAgent,
  deviceNameHeaders,
  getDeviceName,
  primeDeviceName,
  resetDeviceNameForTests,
  type HighEntropyValues,
  type UserAgentDataLike,
} from "./deviceName";
import tokenStorage from "./tokenStorage";

/**
 * `X-Device-Name` (Elchi Pochta #3): aniq qurilma nomi — Chromium'da Client Hints (model, OT va brauzer
 * versiyasi), qolganlarida User-Agent; ilova ochilganda hisoblanib saqlanadi, login/refresh uni kutmaydi.
 */

const UA = {
  chromeAndroidReduced:
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36",
  chromeWindows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
  safariIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  safariIphone26:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1",
  chromeIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1",
  safariIpadDesktop:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  firefoxAndroid: "Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0",
  firefoxWindows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0",
  firefoxLinux: "Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0",
  samsungInternet:
    "Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-A515F) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36",
  androidBuild:
    "Mozilla/5.0 (Linux; Android 12; Redmi Note 11 Build/SKQ1.211103.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  androidTablet:
    "Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  telegramAndroid:
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36 Telegram-Android/11.2.3",
  safariMac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  edgeWindows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0",
  windows7: "Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:115.0) Gecko/20100101 Firefox/115.0",
};

const brands = (...list: [string, string][]) => list.map(([brand, version]) => ({ brand, version }));
const CHROME_155 = brands(["Not)A;Brand", "8.0.0.0"], ["Chromium", "155.0.7000.12"], ["Google Chrome", "155.0.7000.12"]);

describe("deviceNameFromHints — Chromium Client Hints", () => {
  it.each<[string, HighEntropyValues, string | null]>([
    [
      "Android: model (Samsung prefiksi), OT va brauzer versiyasi",
      { platform: "Android", mobile: true, model: "SM-A515F", platformVersion: "13.0.0", fullVersionList: CHROME_155 },
      "Samsung SM-A515F · Android 13 · Chrome 155",
    ],
    [
      "Android: brendli model o'zicha",
      { platform: "Android", mobile: true, model: "Redmi Note 11", platformVersion: "12.0.0", fullVersionList: CHROME_155 },
      "Redmi Note 11 · Android 12 · Chrome 155",
    ],
    [
      "Android: model bo'sh — tur (telefon / planshet)",
      { platform: "Android", mobile: false, model: "", platformVersion: "14", fullVersionList: CHROME_155 },
      "Planshet · Android 14 · Chrome 155",
    ],
    [
      "Windows: platformVersion ≥ 13 — Windows 11",
      { platform: "Windows", mobile: false, model: "", platformVersion: "15.0.0", fullVersionList: brands(["Google Chrome", "154.0.1"]) },
      "Windows 11 · Chrome 154",
    ],
    [
      "Windows: 1–12 — Windows 10",
      { platform: "Windows", platformVersion: "10.0.0", fullVersionList: brands(["Chromium", "154.0"], ["Microsoft Edge", "154.0.2"]) },
      "Windows 10 · Edge 154",
    ],
    [
      "Windows: 0 (7 / 8.1) — versiyasiz",
      { platform: "Windows", platformVersion: "0.3.0", fullVersionList: brands(["Google Chrome", "109.0"]) },
      "Windows · Chrome 109",
    ],
    [
      "macOS: asosiy versiya",
      { platform: "macOS", platformVersion: "14.5.0", fullVersionList: brands(["Opera", "112.0"], ["Chromium", "126.0"]) },
      "macOS 14 · Opera 112",
    ],
    ["Linux va ChromeOS", { platform: "Linux", platformVersion: "6.5.0", fullVersionList: CHROME_155 }, "Linux · Chrome 155"],
    ["ChromeOS", { platform: "Chrome OS", platformVersion: "15633.69.0", brands: CHROME_155 }, "ChromeOS · Chrome 155"],
    [
      "faqat GREASE va noma'lum brend — brauzersiz",
      { platform: "Windows", platformVersion: "15.0.0", fullVersionList: brands(["Not_A Brand", "99"], ["Foo", "1"]) },
      "Windows 11",
    ],
    ["platforma tanilmadi — `null` (User-Agent zaxirasi)", { platform: "", fullVersionList: CHROME_155 }, null],
  ])("%s", (_name, hints, expected) => {
    expect(deviceNameFromHints(hints)).toBe(expected);
  });

  it("Telegram ichki brauzeri — User-Agent'dan; model ASCII'ga tozalanadi va qisqartiriladi", () => {
    expect(
      deviceNameFromHints(
        { platform: "Android", mobile: true, model: "SM-S918B", platformVersion: "14.0.0", fullVersionList: CHROME_155 },
        UA.telegramAndroid,
      ),
    ).toBe("Samsung SM-S918B · Android 14 · Telegram");
    const label = deviceNameFromHints({
      platform: "Android",
      mobile: true,
      model: `Тест\u0000 ${"X".repeat(60)} · model`,
      platformVersion: "13",
      fullVersionList: CHROME_155,
    });
    expect(label).toMatch(/^[\x20-\x7E·]+$/);
    expect(label!.length).toBeLessThanOrEqual(DEVICE_NAME_MAX);
    expect(label).toBe(`${"X".repeat(32)} · Android 13 · Chrome 155`);
  });
});

describe("deviceNameFromUserAgent — Safari, Firefox va zaxira", () => {
  it.each<[string, string, number, string | null]>([
    ["iPhone Safari — Safari versiyasi takrorlanmaydi", UA.safariIphone, 5, "iPhone · iOS 17 · Safari"],
    ["iOS 26 (UA'da muzlatilgan 18_6) — Safari versiyasidan", UA.safariIphone26, 5, "iPhone · iOS 26 · Safari"],
    ["iPhone Chrome", UA.chromeIphone, 5, "iPhone · iOS 17 · Chrome 120"],
    ["iPad (kompyuter rejimidagi UA, sensorli)", UA.safariIpadDesktop, 5, "iPad · iPadOS 17 · Safari"],
    ["Mac Safari (OT versiyasi muzlatilgan)", UA.safariMac, 0, "macOS · Safari 17"],
    ["Chrome Android qisqartirilgan UA — versiya va model muzlatilgan", UA.chromeAndroidReduced, 5, "Telefon · Android · Chrome 155"],
    ["Firefox Android — modelsiz telefon", UA.firefoxAndroid, 5, "Telefon · Android 14 · Firefox 131"],
    ["Samsung Internet — model va brend", UA.samsungInternet, 5, "Samsung SM-A515F · Android 13 · Samsung Internet 23"],
    ["Android `Build/` qo'shimchasisiz", UA.androidBuild, 5, "Redmi Note 11 · Android 12 · Chrome 120"],
    ["Android planshet (Mobile yo'q)", UA.androidTablet, 5, "Samsung SM-X200 · Android 13 · Chrome 120"],
    ["Telegram ichki brauzeri", UA.telegramAndroid, 5, "Telefon · Android · Telegram"],
    ["Windows Firefox — 10 va 11 farqlanmaydi", UA.firefoxWindows, 0, "Windows · Firefox 131"],
    ["Windows Chrome (Client Hints'gacha zaxira)", UA.chromeWindows, 0, "Windows · Chrome 154"],
    ["Windows Edge", UA.edgeWindows, 0, "Windows · Edge 140"],
    ["Windows 7", UA.windows7, 0, "Windows 7 · Firefox 115"],
    ["Linux Firefox", UA.firefoxLinux, 0, "Linux · Firefox 131"],
    ["skript — `null` (backend o'zi yozadi)", "curl/8.4.0", 0, null],
    ["bo'sh — `null`", "", 0, null],
  ])("%s", (_name, userAgent, touchPoints, expected) => {
    expect(deviceNameFromUserAgent(userAgent, touchPoints)).toBe(expected);
  });
});

describe("primeDeviceName / getDeviceName / sarlavha", () => {
  const original = {
    userAgent: Object.getOwnPropertyDescriptor(window.navigator, "userAgent"),
    maxTouchPoints: Object.getOwnPropertyDescriptor(window.navigator, "maxTouchPoints"),
  };
  const setNavigator = (userAgent: string, data?: UserAgentDataLike, maxTouchPoints = 0) => {
    Object.defineProperty(window.navigator, "userAgent", { value: userAgent, configurable: true });
    Object.defineProperty(window.navigator, "maxTouchPoints", { value: maxTouchPoints, configurable: true });
    Object.defineProperty(window.navigator, "userAgentData", { value: data, configurable: true });
  };

  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    resetDeviceNameForTests();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    for (const key of ["userAgent", "maxTouchPoints"] as const) {
      const descriptor = original[key];
      if (descriptor) Object.defineProperty(window.navigator, key, descriptor);
      else delete (window.navigator as unknown as Record<string, unknown>)[key];
    }
    delete (window.navigator as unknown as Record<string, unknown>).userAgentData;
    resetDeviceNameForTests();
  });

  it("Client Hints: aniq nom hisoblanadi, `localStorage` ga yoziladi va sarlavhada URI-kodlangan", async () => {
    const getHighEntropyValues = vi.fn().mockResolvedValue({
      platform: "Android",
      mobile: true,
      model: "SM-A515F",
      platformVersion: "13.0.0",
      fullVersionList: CHROME_155,
    });
    setNavigator(UA.chromeAndroidReduced, { brands: CHROME_155, mobile: true, platform: "Android", getHighEntropyValues });

    // Hali hisoblanmagan — User-Agent'dan darhol (kutmasdan).
    expect(getDeviceName()).toBe("Telefon · Android · Chrome 155");
    await expect(primeDeviceName()).resolves.toBe("Samsung SM-A515F · Android 13 · Chrome 155");
    expect(getHighEntropyValues).toHaveBeenCalledWith(["model", "platformVersion", "fullVersionList"]);
    expect(window.localStorage.getItem(DEVICE_NAME_STORAGE_KEY)).toBe("Samsung SM-A515F · Android 13 · Chrome 155");

    resetDeviceNameForTests();
    expect(getDeviceName()).toBe("Samsung SM-A515F · Android 13 · Chrome 155");
    const headers = deviceNameHeaders();
    expect(headers).toEqual({ "X-Device-Name": "Samsung%20SM-A515F%20%C2%B7%20Android%2013%20%C2%B7%20Chrome%20155" });
    expect(headers["X-Device-Name"]).toMatch(/^[\x21-\x7E]+$/);
    expect(decodeURIComponent(headers["X-Device-Name"])).toBe("Samsung SM-A515F · Android 13 · Chrome 155");
  });

  it("Client Hints xato bersa yoki javob bermasa — User-Agent nomi saqlanadi", async () => {
    setNavigator(UA.chromeWindows, { platform: "Windows", getHighEntropyValues: vi.fn().mockRejectedValue(new Error("x")) });
    await expect(primeDeviceName()).resolves.toBe("Windows · Chrome 154");

    vi.useFakeTimers();
    setNavigator(UA.edgeWindows, { platform: "Windows", getHighEntropyValues: () => new Promise(() => undefined) });
    const pending = primeDeviceName();
    await vi.advanceTimersByTimeAsync(3_000);
    await expect(pending).resolves.toBe("Windows · Edge 140");
    expect(window.localStorage.getItem(DEVICE_NAME_STORAGE_KEY)).toBe("Windows · Edge 140");
  });

  it("Client Hints yo'q (Safari) — User-Agent'dan; aniqlanmasa sarlavha yo'q", async () => {
    setNavigator(UA.safariIphone, undefined, 5);
    await expect(primeDeviceName()).resolves.toBe("iPhone · iOS 17 · Safari");

    window.localStorage.clear();
    resetDeviceNameForTests();
    setNavigator("curl/8.4.0");
    await expect(primeDeviceName()).resolves.toBeNull();
    expect(getDeviceName()).toBeNull();
    expect(deviceNameHeaders()).toEqual({});
  });

  it("buzilgan saqlangan qiymat e'tiborga olinmaydi; saqlab bo'lmasa — xotiradagi nom", async () => {
    setNavigator(UA.firefoxLinux);
    window.localStorage.setItem(DEVICE_NAME_STORAGE_KEY, "<script>\u0000" + "x".repeat(100));
    expect(getDeviceName()).toBe("Linux · Firefox 131");

    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("denied", "QuotaExceededError");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    await expect(primeDeviceName()).resolves.toBe("Linux · Firefox 131");
    expect(getDeviceName()).toBe("Linux · Firefox 131");
  });

  it("POST auth/login va auth/refresh — `X-Device-Id` bilan birga `X-Device-Name`", async () => {
    setNavigator(UA.firefoxWindows);
    await primeDeviceName();
    const post = vi.spyOn(authClient, "post").mockResolvedValue({ data: { accessToken: "token-login" } });
    vi.spyOn(authClient, "get").mockResolvedValue({ data: { data: { id: "56", role: "courier", name: "Kuryer" } } });

    await login({ phone_number: "+998901234567", password: "secret" });
    const id = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    const expected = { "X-Device-Id": id, "X-Device-Name": encodeURIComponent("Windows · Firefox 131") };
    expect(post).toHaveBeenCalledWith("auth/login", { phone_number: "+998901234567", password: "secret" }, { headers: expected });

    post.mockClear();
    post.mockResolvedValue({ data: { accessToken: "token-new" } });
    vi.spyOn(tokenStorage, "tokenMatchesCurrentSession").mockReturnValue(true);
    await expect(refreshAccessToken()).resolves.toBe("token-new");
    expect(post).toHaveBeenCalledWith("auth/refresh", {}, { headers: expected });
  });
});
