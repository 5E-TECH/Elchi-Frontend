import type { TFunction } from "i18next";

/**
 * «TELEGRAM BOT HOLATI» (BOT-DIAG) — `GET /health/notification-bot` / `POST …/recheck` javobini o'qish va
 * nosozlik turini aniqlash (`ui/BotStatusPanel.tsx` matn va tonni shundan oladi).
 *
 * Javob (api-gateway `NotificationBotHealthResponseDto`, konvertsiz): `{ status: "ok" | "degraded", bot: { enabled,
 * mode, healthy, username, reason, checked_at, error_kind, error_status, error_text, restart_required }, timestamp,
 * rechecked? }`. Konvertli javob (`{ statusCode, message, data }`) ham tushuniladi. `bot` bo'lmasa — `null`
 * (sahifa umumiy matnni qoldiradi).
 *
 * `error_text` — server texnik matni (inglizcha, ≤ 200 belgi, token yashirilgan): asosiy matn emas, faqat
 * «Texnik sabab» qatori. Asosiy matn — `error_kind` bo'yicha i18n.
 */

export const BOT_ERROR_KINDS = ["token_rejected", "timeout", "network", "telegram_error", "unknown"] as const;

export type BotErrorKind = (typeof BOT_ERROR_KINDS)[number];

const ERROR_KINDS = new Set<string>(BOT_ERROR_KINDS);

/** Server matni uchun yuqori chegara (backend ham 200 da kesadi — himoya). */
const ERROR_TEXT_MAX = 200;

export type BotHealth = {
  /** Bot tokeni sozlanganmi (placeholder emas). */
  enabled: boolean;
  /** `true` — sog', `false` — tekshiruvdan o'tmadi, `null` — hali tekshirilmagan. */
  healthy: boolean | null;
  username: string | null;
  /** Oxirgi token tekshiruvi (ISO) yoki `null`. */
  checkedAt: string | null;
  errorKind: BotErrorKind | null;
  /** Telegram HTTP statusi (401, 404, 429, 5xx …) yoki `null`. */
  errorStatus: number | null;
  errorText: string | null;
  /** Token rad etilgan: «Qayta tekshirish» befoyda, yangi token bilan xizmatni qayta ishga tushirish kerak. */
  restartRequired: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const readText = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text.slice(0, ERROR_TEXT_MAX) : null;
};

/** Javob → bot holati; `bot` yo'q yoki shakli buzuq bo'lsa — `null`. */
export const readBotHealth = (raw: unknown): BotHealth | null => {
  if (!isRecord(raw)) return null;
  const body = isRecord(raw.bot) ? raw : isRecord(raw.data) && isRecord(raw.data.bot) ? raw.data : null;
  if (!body) return null;
  const bot = body.bot as Record<string, unknown>;
  const status = bot.error_status;
  return {
    enabled: bot.enabled === true,
    healthy: typeof bot.healthy === "boolean" ? bot.healthy : null,
    username: readText(bot.username),
    checkedAt: readText(bot.checked_at),
    errorKind: typeof bot.error_kind === "string" && ERROR_KINDS.has(bot.error_kind) ? (bot.error_kind as BotErrorKind) : null,
    errorStatus: typeof status === "number" && Number.isInteger(status) ? status : null,
    errorText: readText(bot.error_text),
    restartRequired: bot.restart_required === true,
  };
};

/**
 * Ko'rsatiladigan nosozlik (i18n `system.health.bot.<kind>`):
 *  tokenRejected — Telegram tokenni rad etdi (401/404): yangi token + qayta ishga tushirish;
 *  network / timeout — server Telegram'ga ulana olmayapti (tarmoq tiklansa o'zi tiklanadi);
 *  telegramError — Telegram boshqa xato qaytardi (429, 5xx …);
 *  unknown — kutilmagan xato;
 *  pending — token bor, lekin tekshiruv hali tugamagan (`healthy: null`);
 *  disabled — serverda token sozlanmagan.
 */
export type BotIssueKind = "tokenRejected" | "network" | "timeout" | "telegramError" | "unknown" | "pending" | "disabled";

export type BotIssue = {
  kind: BotIssueKind;
  /** Telegram HTTP statusi (sarlavhada qavs ichida). */
  status: number | null;
  /** «Qayta tekshirish» foydali emas — tugma o'rniga «Qayta ishga tushirish kerak». */
  restartRequired: boolean;
};

const KIND_OF: Record<BotErrorKind, BotIssueKind> = {
  token_rejected: "tokenRejected",
  network: "network",
  timeout: "timeout",
  telegram_error: "telegramError",
  unknown: "unknown",
};

/**
 * Bot holati → nosozlik. `null` — ko'rsatadigan aniq sabab yo'q: bot sog' (NOTIFICATION boshqa sabab bilan
 * nosoz — umumiy matn qoladi) yoki eski notification-service (`healthy: false`, lekin `error_kind` yo'q).
 */
export const botIssue = (health: BotHealth): BotIssue | null => {
  if (health.healthy === true) return null;
  if (!health.enabled) return { kind: "disabled", status: null, restartRequired: true };
  if (health.errorKind) {
    const kind = KIND_OF[health.errorKind];
    return {
      kind,
      status: health.errorStatus,
      restartRequired: health.restartRequired || kind === "tokenRejected",
    };
  }
  if (health.healthy === null) return { kind: "pending", status: null, restartRequired: health.restartRequired };
  return null;
};

/** `telegram_error` izohi statusga qarab: 429 — so'rovlar ko'p, 5xx — Telegram tomonida, qolgani — umumiy. */
export const telegramErrorHint = (status: number | null): "rateLimit" | "server" | "other" =>
  status === 429 ? "rateLimit" : status !== null && status >= 500 && status < 600 ? "server" : "other";

/** Sabab sarlavhasi — panelda ham, xizmatlar jadvalidagi NOTIFICATION qatorida ham. */
export const botIssueTitle = (t: TFunction<"ops">, issue: BotIssue): string => {
  const base = `system.health.bot.${issue.kind}`;
  if ((issue.kind === "tokenRejected" || issue.kind === "telegramError") && issue.status !== null) {
    return t(`${base}.titleStatus`, { status: issue.status });
  }
  return t(`${base}.title`);
};

export const botIssueText = (t: TFunction<"ops">, issue: BotIssue): string =>
  issue.kind === "telegramError"
    ? t(`system.health.bot.telegramError.${telegramErrorHint(issue.status)}`)
    : t(`system.health.bot.${issue.kind}.text`);

/** Bot holatidan ko'rsatiladigan nosozlik; javob yo'q / bot sog' / sabab noma'lum — `null` (umumiy matn qoladi). */
export const readBotIssue = (raw: unknown): { health: BotHealth; issue: BotIssue } | null => {
  const health = readBotHealth(raw);
  const issue = health ? botIssue(health) : null;
  return health && issue ? { health, issue } : null;
};
