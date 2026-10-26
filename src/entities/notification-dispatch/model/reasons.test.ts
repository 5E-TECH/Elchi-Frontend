import i18n from "../../../i18n";
import { failureReasonKey } from "./reasons";

const text = (channel: string, status: string, reason: string | null) => {
  const key = failureReasonKey(channel, status, reason);
  return key ? i18n.t(key, { ns: "notifications", lng: "uz" }) : null;
};

describe("failureReasonKey — faqat kod xaritasi (ega S4)", () => {
  it("translates known reason codes", () => {
    expect(text("telegram", "skipped", "no_telegram_id")).toBe("Telegram ulanmagan");
    expect(text("telegram", "failed", "bot_blocked")).toBe("Botni bloklagan");
    expect(text("sms", "skipped", "no_phone")).toBe("Telefon raqami yo'q");
    expect(text("sms", "blocked", "daily_cap_exceeded")).toBe("Kunlik SMS chegarasi tugagan");
    expect(text("push", "skipped", "muted")).toBe("Bildirishnomani o'chirgan");
  });

  it("never shows raw provider text — falls back by status and channel", () => {
    expect(text("telegram", "failed", "Forbidden: bot was blocked by the user")).toBe("Telegram xatosi");
    expect(text("sms", "failed", "Eskiz 500 Internal Server Error")).toBe("SMS yetkazilmadi");
    expect(text("realtime", "failed", "socket closed")).toBe("Yetkazilmadi");
    expect(text("sms", "no_provider", null)).toBe("Provayder ulanmagan");
    expect(text("push", "no_subscription", null)).toBe("Push obunasi yo'q");
    // Kodsiz «o'tkazib yuborildi» — badge yetarli, matn yo'q.
    expect(failureReasonKey("telegram", "skipped", "some raw text")).toBeNull();
  });

  it("every reason key exists in uz, ru and en", () => {
    const keys = new Set<string>();
    for (const [channel, status, reason] of [
      ["telegram", "skipped", "no_telegram_id"],
      ["telegram", "failed", "bot_blocked"],
      ["telegram", "skipped", "no_telegram_group"],
      ["sms", "skipped", "no_phone"],
      ["sms", "no_provider", "sms_disabled"],
      ["sms", "no_provider", "provider_not_configured"],
      ["sms", "blocked", "daily_cap_exceeded"],
      ["sms", "blocked", null],
      ["sms", "skipped", "duplicate"],
      ["push", "failed", "push_disabled"],
      ["push", "skipped", "online"],
      ["push", "skipped", "quiet_hours"],
      ["push", "no_subscription", null],
      ["sms", "not_eligible", null],
      ["telegram", "failed", null],
      ["sms", "failed", null],
      ["push", "failed", null],
      ["realtime", "failed", null],
      ["telegram", "skipped", "muted"],
    ] as const) {
      keys.add(failureReasonKey(channel, status, reason)!);
    }
    for (const lng of ["uz", "ru", "en"]) {
      for (const key of keys) expect(i18n.exists(key, { ns: "notifications", lng })).toBe(true);
    }
  });
});

describe("failureReasonKey — N9 (lkQiuyQu) `reason_code` kodlari", () => {
  it("push xatosi tasnifi, SMS darvozasi va operator hisoboti — uchala tilda", () => {
    expect(text("push", "failed", "subscription_expired")).toBe("Push obunasi eskirgan");
    expect(text("push", "failed", "rate_limited")).toBe("Push xizmati so'rovlarni chekladi");
    expect(text("push", "failed", "push_failed")).toBe("Push yetkazilmadi");
    expect(text("push", "no_subscription", "no_subscription")).toBe("Push obunasi yo'q");
    expect(text("sms", "blocked", "no_consent")).toBe("Reklama SMS'ga rozilik yo'q");
    expect(text("sms", "skipped", "campaign_cancelled")).toBe("Kampaniya bekor qilindi");
    expect(text("sms", "rejected", null)).toBe("Operator rad etdi");
    expect(text("sms", "not_delivered", "provider raw")).toBe("SMS yetkazilmadi");
    const codes = [
      "subscription_expired",
      "payload_too_large",
      "rate_limited",
      "push_rejected",
      "push_service_error",
      "network_error",
      "push_failed",
      "no_consent",
      "fanout_exceeded",
      "opt_out_not_configured",
      "campaign_cancelled",
    ];
    const keys = new Set([
      ...codes.map((code) => failureReasonKey("push", "failed", code)!),
      failureReasonKey("sms", "rejected", null)!,
      failureReasonKey("sms", "expired", null)!,
    ]);
    for (const lng of ["uz", "ru", "en"]) {
      for (const key of keys) expect(i18n.exists(key, { ns: "notifications", lng })).toBe(true);
    }
  });
});
