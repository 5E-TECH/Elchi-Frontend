/**
 * BRAUZER QURILMA NOMI — `X-Device-Name` (Elchi Pochta #3, «Sessiyalar»).
 *
 * Backend sessiya qatoriga shu nomni yozadi (yuborilmasa — User-Agent'dan «Telefon · Android · Chrome»). Bir
 * xil «Telefon · Android · Chrome» bir nechta qurilmani ajratmaydi, shuning uchun nom imkon qadar aniq:
 *
 *  - Chromium (User-Agent Client Hints, `navigator.userAgentData.getHighEntropyValues`): model, OT versiyasi va
 *    brauzer versiyasi — «Samsung SM-A515F · Android 13 · Chrome 155», «Windows 11 · Chrome 154»
 *    (`platformVersion` ≥ 13 — Windows 11), «macOS 14 · Edge 140»;
 *  - qolganlari (Safari, Firefox, Client Hints yo'q) — User-Agent satridan: «iPhone · iOS 17 · Safari»,
 *    «Telefon · Android 14 · Firefox 131» (model noma'lum telefonda tur — u kartada joriy tilda yoziladi),
 *    «Windows · Firefox 131» (User-Agent'da Windows 10 va 11 farqlanmaydi). Muzlatilgan qiymatlar (Chrome'ning
 *    «Android 10; K», macOS «10_15_7») versiya sifatida olinmaydi.
 *
 * Nom ilova ochilganda bir marta hisoblanadi (`primeDeviceName`, asinxron) va `localStorage` da qurilma ID si
 * yonida saqlanadi; `POST auth/login` va `POST auth/refresh` uni kutmaydi — saqlangan yoki User-Agent'dan
 * darhol olingan nom ketadi. Nom faqat ko'rinadigan ASCII + « · » ajratkichi, ≤ 80 belgi; sarlavhada
 * `encodeURIComponent` bilan (backend `decodeURIComponent` qiladi). Aniqlab bo'lmasa — sarlavha yuborilmaydi.
 */
export const DEVICE_NAME_STORAGE_KEY = "elchi_device_name";
export const DEVICE_NAME_HEADER = "X-Device-Name";
export const DEVICE_NAME_MAX = 80;

const SEPARATOR = " · ";
const MODEL_MAX = 32;
const HIGH_ENTROPY_HINTS = ["model", "platformVersion", "fullVersionList"] as const;
/** Client Hints javobini kutish chegarasi — osilib qolgan va'da nomni to'xtatmasin. */
const HINTS_TIMEOUT_MS = 3_000;

type BrandVersion = { brand: string; version: string };

/** `navigator.userAgentData` (Chromium; TypeScript DOM tiplarida hali yo'q). */
export type UserAgentDataLike = {
  brands?: readonly BrandVersion[];
  mobile?: boolean;
  platform?: string;
  getHighEntropyValues?: (hints: string[]) => Promise<HighEntropyValues>;
};

export type HighEntropyValues = {
  brands?: readonly BrandVersion[];
  mobile?: boolean;
  platform?: string;
  model?: string;
  platformVersion?: string;
  fullVersionList?: readonly BrandVersion[];
};

/** Faqat ko'rinadigan ASCII, bo'shliqlar bittadan; ajratkich «·» ham olib tashlanadi. */
const ascii = (value: string | null | undefined, max = DEVICE_NAME_MAX): string =>
  (value ?? "")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .trim();

const major = (version: string | null | undefined): string | null => {
  const match = /^(\d+)/.exec((version ?? "").trim());
  return match ? match[1] : null;
};

const join = (parts: readonly (string | null | undefined)[]): string | null => {
  const clean = parts.map((part) => ascii(part)).filter(Boolean);
  if (clean.length === 0) return null;
  let label = clean.join(SEPARATOR);
  if (label.length > DEVICE_NAME_MAX) label = label.slice(0, DEVICE_NAME_MAX).trim();
  return label || null;
};

/** Model kodi → brend, faqat ishonchli prefiks bo'lsa («SM-A515F» → «Samsung SM-A515F»). */
const MODEL_BRAND_PREFIX: readonly [RegExp, string][] = [
  [/^SM-/i, "Samsung"],
  [/^RMX\d/i, "realme"],
];

const modelLabel = (raw: string | null | undefined): string | null => {
  const model = ascii(
    (raw ?? "")
      .replace(/\s+Build\/.*$/i, "")
      .replace(/^SAMSUNG\s+/i, ""),
    MODEL_MAX,
  );
  if (!model) return null;
  const brand = MODEL_BRAND_PREFIX.find(([pattern]) => pattern.test(model))?.[1];
  return brand ? `${brand} ${model}` : model;
};

/** Model emas: Chrome'ning qisqartirilgan UA'sidagi «K», Firefox'dagi «Mobile», WebView «wv», til kodi … */
const NOT_A_MODEL = /^(k|mobile|tablet|wv|u|linux|rv:.*|[a-z]{2}([-_][a-z]{2})?)$/i;

// ───────────────────────────── User-Agent satridan ─────────────────────────────

/**
 * Brauzer va uning asosiy versiyasi. Tartib muhim: Edge/Opera/Yandex/Samsung satrida «Chrome» ham bor, Chrome
 * satrida esa «Safari». Telegram ichki brauzeri — versiyasiz.
 */
const UA_BROWSERS: readonly [RegExp, string][] = [
  [/YaBrowser\/(\d+)/, "Yandex"],
  [/Edg(?:e|A|iOS)?\/(\d+)/, "Edge"],
  [/(?:OPR|OPT|Opera)\/(\d+)/, "Opera"],
  [/SamsungBrowser\/(\d+)/, "Samsung Internet"],
  [/(?:Firefox|FxiOS)\/(\d+)/, "Firefox"],
  [/(?:Chrome|CriOS)\/(\d+)/, "Chrome"],
  [/Version\/(\d+)[\d.]*.*Safari\//, "Safari"],
];

const browserFromUserAgent = (userAgent: string): { name: string; version: string | null } | null => {
  if (/Telegram/i.test(userAgent)) return { name: "Telegram", version: null };
  for (const [pattern, name] of UA_BROWSERS) {
    const match = pattern.exec(userAgent);
    if (match) return { name, version: match[1] ?? null };
  }
  return null;
};

const WINDOWS_NT: Record<string, string> = { "6.1": "Windows 7", "6.2": "Windows 8", "6.3": "Windows 8.1" };

/**
 * User-Agent satridan qurilma nomi (Safari, Firefox va Client Hints bo'lmagan brauzerlar; Chromium'da
 * Client Hints kelguncha zaxira). Aniqlab bo'lmasa (skript, noma'lum ilova) — `null`: backend o'zi yozadi.
 */
export const deviceNameFromUserAgent = (userAgent: string, maxTouchPoints = 0): string | null => {
  const ua = userAgent ?? "";
  if (!ua.trim()) return null;
  const browser = browserFromUserAgent(ua);
  const browserWith = (showVersion: boolean) =>
    browser ? [browser.name, showVersion ? browser.version : null].filter(Boolean).join(" ") : null;

  // iOS / iPadOS. iOS 26 dan Safari satridagi OT versiyasi muzlatilgan (18_6) — Safari versiyasi OT bilan teng,
  // shuning uchun kattasi olinadi.
  const iosDevice = /iPhone/.test(ua) ? "iPhone" : /iPod/.test(ua) ? "iPod" : /iPad/.test(ua) ? "iPad" : null;
  const ipadAsMac = !iosDevice && /Macintosh/.test(ua) && maxTouchPoints > 1;
  if (iosDevice || ipadAsMac) {
    const device = iosDevice ?? "iPad";
    const osMajor = Number(/OS (\d+)_/.exec(ua)?.[1] ?? 0);
    const safariMajor = browser?.name === "Safari" ? Number(browser.version ?? 0) : 0;
    const version = Math.max(ipadAsMac ? 0 : osMajor, safariMajor);
    const os = `${device === "iPad" ? "iPadOS" : "iOS"}${version ? ` ${version}` : ""}`;
    // Safari versiyasi OT versiyasi bilan bir xil — takrorlanmaydi.
    return join([device, os, browserWith(browser?.name !== "Safari")]);
  }

  const android = /Android(?:\s+([\d.]+))?(?:;\s*([^;)]+))?/.exec(ua);
  if (android) {
    // Chrome'ning qisqartirilgan satri («Android 10; K») — versiya ham, model ham muzlatilgan.
    const reduced = /Android 10; K\)/.test(ua);
    const version = reduced ? null : major(android[1]);
    const rawModel = (android[2] ?? "").trim();
    const model = !reduced && rawModel && !NOT_A_MODEL.test(rawModel) ? modelLabel(rawModel) : null;
    const kind = /Mobile/i.test(ua) ? "Telefon" : "Planshet";
    return join([model ?? kind, version ? `Android ${version}` : "Android", browserWith(true)]);
  }

  const windows = /Windows NT ([\d.]+)/.exec(ua);
  const os = windows
    ? (WINDOWS_NT[windows[1]] ?? "Windows")
    : /CrOS/.test(ua)
      ? "ChromeOS"
      : /Macintosh|Mac OS X/.test(ua)
        ? "macOS"
        : /Linux/i.test(ua)
          ? "Linux"
          : null;
  // Faqat OT ma'lum (brauzer tanilmadi) — backendning «Kompyuter · Linux» yorlig'idan aniqroq emas.
  if (!os || !browser) return null;
  return join([os, browserWith(true)]);
};

// ───────────────────────────── Client Hints (Chromium) ─────────────────────────────

/** Brend ustuvorligi: aniq brauzer → Chrome → Chromium. GREASE («Not)A;Brand») va noma'lumlari tashlanadi. */
const HINT_BRANDS: readonly [RegExp, string][] = [
  [/^Microsoft Edge$/i, "Edge"],
  [/^Opera( GX)?$/i, "Opera"],
  [/^(YaBrowser|Yandex)$/i, "Yandex"],
  [/^Samsung Internet$/i, "Samsung Internet"],
  [/^Brave$/i, "Brave"],
  [/^Android WebView$/i, "WebView"],
  [/^Google Chrome$/i, "Chrome"],
  [/^Chromium$/i, "Chromium"],
];

const browserFromBrands = (brands: readonly BrandVersion[] | undefined): string | null => {
  const list = Array.isArray(brands) ? brands : [];
  for (const [pattern, name] of HINT_BRANDS) {
    const hit = list.find((entry) => pattern.test((entry?.brand ?? "").trim()));
    if (hit) return [name, major(hit.version)].filter(Boolean).join(" ");
  }
  return null;
};

const windowsName = (platformVersion: string | undefined) => {
  const value = Number(major(platformVersion) ?? NaN);
  if (!Number.isFinite(value)) return "Windows";
  if (value >= 13) return "Windows 11";
  if (value >= 1) return "Windows 10";
  return "Windows";
};

const macName = (platformVersion: string | undefined) => {
  const match = /^(\d+)(?:\.(\d+))?/.exec((platformVersion ?? "").trim());
  if (!match) return "macOS";
  // macOS 10.x da asosiy raqam ikkinchisi (10.15); 11 dan boshlab birinchisi.
  return match[1] === "10" && match[2] ? `macOS 10.${match[2]}` : `macOS ${match[1]}`;
};

/**
 * Client Hints qiymatlaridan nom. Platforma tanilmasa — `null` (User-Agent zaxirasi ishlaydi).
 * `userAgent` faqat Telegram ichki brauzerini tanish uchun.
 */
export const deviceNameFromHints = (hints: HighEntropyValues, userAgent = ""): string | null => {
  const platform = (hints.platform ?? "").trim().toLowerCase();
  const browser = /Telegram/i.test(userAgent)
    ? "Telegram"
    : browserFromBrands(hints.fullVersionList?.length ? hints.fullVersionList : hints.brands);

  if (platform === "android") {
    const version = major(hints.platformVersion);
    const model = modelLabel(hints.model);
    const kind = hints.mobile === false ? "Planshet" : "Telefon";
    return join([model ?? kind, version ? `Android ${version}` : "Android", browser]);
  }
  if (platform === "windows") return join([windowsName(hints.platformVersion), browser]);
  if (platform === "macos") return join([macName(hints.platformVersion), browser]);
  if (/^(chrome|chromium) ?os$/.test(platform)) return join(["ChromeOS", browser]);
  if (platform === "linux") return join(["Linux", browser]);
  return null;
};

// ───────────────────────────── Saqlash va sarlavha ─────────────────────────────

/** Saqlangan qiymat tekshiruvi: ko'rinadigan ASCII + «·», ≤ 80. */
const isValidName = (value: unknown): value is string =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  value.length <= DEVICE_NAME_MAX &&
  /^[\x20-\x7E·]+$/.test(value);

/** Saqlab bo'lmagan brauzerda (maxfiy rejim) ham shu ochilish davomida ishlatiladi. */
let memoryName: string | null = null;

const readStored = (): string | null => {
  try {
    const stored = window.localStorage.getItem(DEVICE_NAME_STORAGE_KEY);
    return isValidName(stored) ? stored : null;
  } catch {
    return null;
  }
};

const store = (name: string) => {
  memoryName = name;
  try {
    if (window.localStorage.getItem(DEVICE_NAME_STORAGE_KEY) !== name) {
      window.localStorage.setItem(DEVICE_NAME_STORAGE_KEY, name);
    }
  } catch {
    // Saqlab bo'lmasa — xotiradagi qiymat yetarli.
  }
};

const navigatorInfo = () => {
  if (typeof navigator === "undefined") return { userAgent: "", maxTouchPoints: 0, data: undefined };
  return {
    userAgent: navigator.userAgent ?? "",
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    data: (navigator as Navigator & { userAgentData?: UserAgentDataLike }).userAgentData,
  };
};

const withTimeout = <T>(promise: Promise<T>, ms: number) =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });

/**
 * Eng aniq nomni hisoblaydi (Client Hints → User-Agent) va saqlaydi. Ilova ochilganda bir marta chaqiriladi
 * (`main.tsx`); hech qachon xato tashlamaydi. Natija — saqlangan nom yoki `null`.
 */
export const primeDeviceName = async (): Promise<string | null> => {
  const { userAgent, maxTouchPoints, data } = navigatorInfo();
  let name: string | null = null;
  if (data && typeof data.getHighEntropyValues === "function") {
    try {
      const hints = await withTimeout(data.getHighEntropyValues([...HIGH_ENTROPY_HINTS]), HINTS_TIMEOUT_MS);
      const merged: HighEntropyValues = {
        ...hints,
        brands: hints.brands ?? data.brands,
        mobile: hints.mobile ?? data.mobile,
        platform: hints.platform ?? data.platform,
      };
      name = deviceNameFromHints(merged, userAgent);
    } catch {
      name = null;
    }
  }
  name ??= deviceNameFromUserAgent(userAgent, maxTouchPoints);
  if (name) store(name);
  return name;
};

/**
 * Hozir yuboriladigan nom (sinxron): saqlangan (Client Hints'li) nom, bo'lmasa User-Agent'dan; aniqlanmasa `null`.
 */
export const getDeviceName = (): string | null => {
  const cached = memoryName ?? readStored();
  if (cached) return cached;
  const { userAgent, maxTouchPoints } = navigatorInfo();
  return deviceNameFromUserAgent(userAgent, maxTouchPoints);
};

/** `authClient` so'roviga qo'shiladigan sarlavha (nom bo'lmasa — bo'sh ob'ekt); qiymat URI-kodlangan. */
export const deviceNameHeaders = (): Record<string, string> => {
  const name = getDeviceName();
  return name ? { [DEVICE_NAME_HEADER]: encodeURIComponent(name) } : {};
};

/** Faqat testlar uchun: xotiradagi nomni tozalash. */
export const resetDeviceNameForTests = () => {
  memoryName = null;
};
