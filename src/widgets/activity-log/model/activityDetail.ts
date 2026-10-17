import type { ActivityLog } from "../../../entities/activity-log";

const sameValue = (before: unknown, after: unknown) => JSON.stringify(before ?? null) === JSON.stringify(after ?? null);

export const changedKeys = (before: Record<string, unknown> | null, after: Record<string, unknown> | null): string[] => {
  const keys = new Set<string>([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  return [...keys].filter((key) => !sameValue(before?.[key], after?.[key]));
};

const filled = (value: unknown) => value !== null && value !== undefined && value !== "";

/**
 * Ochiladigan tafsilot bormi (aks holda qatorda tugma yo'q — «Tafsilot yo'q»). Faqat bo'sh qiymatli
 * `metadata` (`{ operator_id: null }`) tafsilot emas.
 */
export const hasActivityDetail = (log: ActivityLog) =>
  Boolean(
    changedKeys(log.old_value, log.new_value).length ||
      Object.values(log.metadata ?? {}).some(filled) ||
      log.trace_id,
  );

const OS_PATTERNS: [RegExp, string][] = [
  [/Android/i, "Android"],
  [/iPhone|iPod/i, "iPhone"],
  [/iPad/i, "iPad"],
  [/Windows/i, "Windows"],
  [/CrOS/i, "ChromeOS"],
  [/Macintosh|Mac OS X/i, "macOS"],
  [/Linux/i, "Linux"],
];

// Tartib muhim: Edge/Opera/Yandex satrida «Chrome» ham bor, Chrome satrida esa «Safari».
const BROWSER_PATTERNS: [RegExp, string][] = [
  [/YaBrowser/i, "Yandex"],
  [/Edg(e|A|iOS)?\//i, "Edge"],
  [/OPR\/|Opera/i, "Opera"],
  [/SamsungBrowser/i, "Samsung Internet"],
  [/Firefox|FxiOS/i, "Firefox"],
  [/Chrome\/|CriOS/i, "Chrome"],
  [/Safari\//i, "Safari"],
];

/**
 * `user_agent` dan qisqa qurilma nomi («Android · Chrome», «Windows · Edge»). Tanilmasa (ilova, skript) — `null`,
 * u holda xom satr ko'rsatiladi.
 */
export const deviceFromUserAgent = (userAgent: string): string | null => {
  const os = OS_PATTERNS.find(([pattern]) => pattern.test(userAgent))?.[1];
  const browser = BROWSER_PATTERNS.find(([pattern]) => pattern.test(userAgent))?.[1];
  const parts = [os, browser].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
};

const text = (value: unknown) => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return filled(value) ? JSON.stringify(value) : "";
};

export type MetadataRow = {
  key: string;
  value: unknown;
  /** Qiymat ustiga olib borilganda to'liq matn (masalan, to'liq `user_agent`). */
  title?: string;
};

/** Qatorning boshida (maket: «Manba», «Filial»). */
const LEADING_KEYS = ["source", "branch_name", "branch"] as const;
/** So'rov konteksti — alohida qatorlar emas, «Qurilma» va «IP manzil» ga yig'iladi (f2Ud5tju). */
const CONTEXT_KEYS = new Set(["device", "device_name", "user_agent", "device_id", "ip"]);

/**
 * «Qo'shimcha ma'lumot» qatorlari maket tartibida (`superadmin-activity-logs-row-expanded`): «Manba», «Filial»,
 * boshqa kalitlar, so'ng har doim «Qurilma» va «IP manzil». So'rov kontekstisiz yozuvda (cron, bot, webhook yoki
 * 30 kundan eski qator) bu ikkisi «—».
 */
export const metadataRows = (metadata: Record<string, unknown> | null | undefined): MetadataRow[] => {
  const source = metadata ?? {};
  const rows: MetadataRow[] = [];

  for (const key of LEADING_KEYS) {
    // «Filial» bir marta: nomi bo'lsa — nomi.
    if (key === "branch" && filled(source.branch_name)) continue;
    if (filled(source[key])) rows.push({ key, value: source[key] });
  }

  for (const [key, value] of Object.entries(source)) {
    if ((LEADING_KEYS as readonly string[]).includes(key) || CONTEXT_KEYS.has(key) || !filled(value)) continue;
    rows.push({ key, value });
  }

  const userAgent = text(source.user_agent);
  const deviceName = text(source.device_name) || text(source.device);
  rows.push({
    key: "device",
    value: deviceName || (userAgent ? (deviceFromUserAgent(userAgent) ?? userAgent) : null),
    title: userAgent || undefined,
  });
  rows.push({ key: "ip", value: text(source.ip) || null });
  return rows;
};
