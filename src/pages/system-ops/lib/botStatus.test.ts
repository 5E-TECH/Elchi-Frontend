import { beforeAll, describe, expect, it } from "vitest";
import i18n from "../../../i18n";
import {
  botIssue,
  botIssueText,
  botIssueTitle,
  readBotHealth,
  readBotIssue,
  telegramErrorHint,
  type BotHealth,
} from "./botStatus";

/** api-gateway `GET /health/notification-bot` (BOT-DIAG-BE, `NotificationBotHealthResponseDto`) — konvertsiz. */
const response = (bot: Record<string, unknown> = {}) => ({
  status: "degraded",
  bot: {
    enabled: true,
    mode: "off",
    healthy: false,
    username: null,
    reason: "token rad etildi",
    checked_at: "2026-11-17T09:05:00.000Z",
    error_kind: "network",
    error_status: null,
    error_text: "Telegram getMe failed (0): fetch failed (ENOTFOUND)",
    restart_required: false,
    ...bot,
  },
  timestamp: "2026-11-17T09:05:01.000Z",
});

const health = (patch: Partial<BotHealth> = {}): BotHealth => ({
  enabled: true,
  healthy: false,
  username: null,
  checkedAt: "2026-11-17T09:05:00.000Z",
  errorKind: "network",
  errorStatus: null,
  errorText: null,
  restartRequired: false,
  ...patch,
});

const t = i18n.getFixedT("uz", "ops");

describe("readBotHealth", () => {
  it("konvertsiz javob → maydonlar", () => {
    expect(readBotHealth(response({ error_kind: "token_rejected", error_status: 401, restart_required: true }))).toEqual({
      enabled: true,
      healthy: false,
      username: null,
      checkedAt: "2026-11-17T09:05:00.000Z",
      errorKind: "token_rejected",
      errorStatus: 401,
      errorText: "Telegram getMe failed (0): fetch failed (ENOTFOUND)",
      restartRequired: true,
    });
  });

  it("konvertli javob (`{ statusCode, message, data }`) ham o'qiladi", () => {
    expect(readBotHealth({ statusCode: 200, message: "OK", data: response() })?.errorKind).toBe("network");
  });

  it.each([
    ["null", null],
    ["massiv", []],
    ["`bot` siz", { status: "ok" }],
    ["bo'sh konvert", { statusCode: 200, message: "OK", data: {} }],
  ])("%s → null", (_name, raw) => {
    expect(readBotHealth(raw)).toBeNull();
  });

  it("noma'lum `error_kind`, butun bo'lmagan status, bo'sh matnlar → null; uzun matn 200 belgida kesiladi", () => {
    const parsed = readBotHealth(
      response({ error_kind: "boom", error_status: 4.5, error_text: "x".repeat(260), username: " ", checked_at: "" }),
    );
    expect(parsed?.errorKind).toBeNull();
    expect(parsed?.errorStatus).toBeNull();
    expect(parsed?.errorText).toHaveLength(200);
    expect(parsed?.username).toBeNull();
    expect(parsed?.checkedAt).toBeNull();
  });
});

describe("botIssue", () => {
  it("sog' bot — sabab yo'q (umumiy matn qoladi)", () => {
    expect(botIssue(health({ healthy: true, errorKind: null }))).toBeNull();
  });

  it("eski notification-service: `healthy: false`, lekin `error_kind` yo'q — sabab yo'q", () => {
    expect(botIssue(health({ errorKind: null }))).toBeNull();
  });

  it.each([
    ["token_rejected", 401, false, { kind: "tokenRejected", status: 401, restartRequired: true }],
    ["network", null, false, { kind: "network", status: null, restartRequired: false }],
    ["timeout", null, false, { kind: "timeout", status: null, restartRequired: false }],
    ["telegram_error", 429, false, { kind: "telegramError", status: 429, restartRequired: false }],
    ["unknown", null, true, { kind: "unknown", status: null, restartRequired: true }],
  ] as const)("%s (%s) → tur, status va qayta ishga tushirish", (errorKind, errorStatus, restartRequired, expected) => {
    expect(botIssue(health({ errorKind, errorStatus, restartRequired }))).toEqual(expected);
  });

  it("token bor, tekshiruv hali bo'lmagan (`healthy: null`) — pending, qayta tekshirsa bo'ladi", () => {
    expect(botIssue(health({ healthy: null, errorKind: null, checkedAt: null }))).toEqual({
      kind: "pending",
      status: null,
      restartRequired: false,
    });
  });

  it("token sozlanmagan (`enabled: false`) — disabled, qayta ishga tushirish kerak", () => {
    expect(botIssue(health({ enabled: false, healthy: null, errorKind: null }))).toEqual({
      kind: "disabled",
      status: null,
      restartRequired: true,
    });
  });

  it("readBotIssue: javob → bot holati + sabab; sog' yoki shakli buzuq — null", () => {
    expect(readBotIssue(response())?.issue.kind).toBe("network");
    expect(readBotIssue(response({ healthy: true, error_kind: null }))).toBeNull();
    expect(readBotIssue({ statusCode: 404 })).toBeNull();
  });
});

describe("matnlar (uz)", () => {
  it("telegramErrorHint: 429 — rateLimit, 5xx — server, qolgani — other", () => {
    expect(telegramErrorHint(429)).toBe("rateLimit");
    expect(telegramErrorHint(502)).toBe("server");
    expect(telegramErrorHint(400)).toBe("other");
    expect(telegramErrorHint(null)).toBe("other");
  });

  it.each([
    [{ kind: "tokenRejected", status: 401 }, "Telegram bot tokeni rad etildi (401)", /^BotFather'dan yangi token oling/],
    [{ kind: "tokenRejected", status: null }, "Telegram bot tokeni rad etildi", /\.env\.production/],
    [{ kind: "network", status: null }, "Server Telegram'ga ulana olmayapti", /5 daqiqa ichida o'zi tiklanadi/],
    [{ kind: "timeout", status: null }, "Server Telegram'ga ulana olmayapti", /^Telegram belgilangan vaqtda javob bermadi/],
    [{ kind: "telegramError", status: 429 }, "Telegram xato qaytardi (429)", /^So'rovlar juda ko'p/],
    [{ kind: "telegramError", status: 502 }, "Telegram xato qaytardi (502)", /^Nosozlik Telegram tomonida/],
    [{ kind: "telegramError", status: null }, "Telegram xato qaytardi", /dasturchiga yuboring/],
    [{ kind: "unknown", status: null }, "Kutilmagan xato", /dasturchiga yuboring/],
    [{ kind: "pending", status: null }, "Tekshiruv hali tugamagan", /hali tekshirmagan/],
    [{ kind: "disabled", status: null }, "Bot o'chiq — token sozlanmagan", /^BotFather'dan token oling/],
  ] as const)("%o → «%s»", (partial, title, text) => {
    const issue = { ...partial, restartRequired: false };
    expect(botIssueTitle(t, issue)).toBe(title);
    expect(botIssueText(t, issue)).toMatch(text);
  });

  describe("ru / en", () => {
    beforeAll(async () => {
      await i18n.loadLanguages(["ru", "en"]);
      await i18n.loadNamespaces("ops");
    });

    it("ru va en: token rad etildi — tarjima, status sarlavhada", () => {
      const issue = { kind: "tokenRejected", status: 401, restartRequired: true } as const;
      expect(botIssueTitle(i18n.getFixedT("ru", "ops"), issue)).toBe("Telegram отклонил токен бота (401)");
      expect(botIssueTitle(i18n.getFixedT("en", "ops"), issue)).toBe("Telegram rejected the bot token (401)");
    });
  });

  it("uz/ru/en: har tur uchun sarlavha va matn bor (kalit qaytmaydi)", async () => {
    await i18n.loadLanguages(["ru", "en"]);
    await i18n.loadNamespaces("ops");
    for (const lang of ["uz", "ru", "en"]) {
      const tl = i18n.getFixedT(lang, "ops");
      for (const kind of ["tokenRejected", "network", "timeout", "telegramError", "unknown", "pending", "disabled"] as const) {
        const issue = { kind, status: 401, restartRequired: false };
        expect(botIssueTitle(tl, issue)).not.toMatch(/system\.health/);
        expect(botIssueText(tl, issue)).not.toMatch(/system\.health/);
      }
    }
  });
});
