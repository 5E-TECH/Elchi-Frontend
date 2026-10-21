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
