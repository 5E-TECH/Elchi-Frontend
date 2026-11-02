import { describe, expect, it } from "vitest";
import {
  canManagePasswordSms,
  formatCountdown,
  isFinalPasswordSmsStatus,
  readCreatedUser,
  readPasswordSmsState,
  readResendLimit,
  secondsUntil,
} from "./passwordSms";

const sms = {
  status: "sent",
  failure_reason: null,
  failure_message: null,
  requested_at: "2026-10-26T09:32:00.000Z",
  sent_at: "2026-10-26T09:32:01.000Z",
  delivered_at: null,
  resend_available_at: "2026-10-26T09:33:00.000Z",
  resends_left_today: 5,
};

describe("passwordSms (aidsxJ2H)", () => {
  it("yaratish javobi — axios javobi ham, tana ham; parol maydoni o'qilmaydi", () => {
    const body = {
      statusCode: 201,
      message: "Kuryer yaratildi",
      data: { id: 91, name: "Sardor Qodirov", phone_number: "+998901234567", role: "courier", password_mode: "generate_sms", password_sms: sms },
    };
    for (const response of [{ data: body, status: 201 }, body]) {
      const created = readCreatedUser(response);
      expect(created).toEqual({
        id: "91",
        name: "Sardor Qodirov",
        phoneNumber: "+998901234567",
        role: "courier",
        passwordMode: "generate_sms",
        passwordSms: { ...sms, status: "sent" },
      });
      expect(JSON.stringify(created)).not.toMatch(/password"?:\s*"/);
    }
  });

  it("`manual` — password_sms null; noma'lum status — null", () => {
    expect(readCreatedUser({ data: { statusCode: 201, data: { id: "5", password_mode: "manual", password_sms: null } } }).passwordSms).toBeNull();
    expect(readPasswordSmsState({ statusCode: 200, data: { user_id: "5", password_sms: { status: "weird" } } }).passwordSms).toBeNull();
    expect(readPasswordSmsState({ statusCode: 200, data: { user_id: "5", must_change_password: false, password_sms: sms } })).toEqual({
      passwordSms: sms,
      mustChangePassword: false,
    });
  });

  it("yakuniy holat — delivered / failed", () => {
    expect(isFinalPasswordSmsStatus("delivered")).toBe(true);
    expect(isFinalPasswordSmsStatus("failed")).toBe(true);
    expect(isFinalPasswordSmsStatus("sent")).toBe(false);
    expect(isFinalPasswordSmsStatus("pending")).toBe(false);
  });

  it("huquq backend bilan aynan: superadmin — hammasi; admin — admin'dan boshqasi; menejer — faqat kuryer", () => {
    for (const target of ["admin", "registrator", "logist", "courier", "manager", "marketing", "market"]) {
      expect(canManagePasswordSms("superadmin", target)).toBe(true);
    }
    expect(canManagePasswordSms("superadmin", "superadmin")).toBe(false);
    expect(canManagePasswordSms("admin", "admin")).toBe(false);
    expect(canManagePasswordSms("admin", "courier")).toBe(true);
    expect(canManagePasswordSms("admin", "marketing")).toBe(true);
    expect(canManagePasswordSms("manager", "courier")).toBe(true);
    expect(canManagePasswordSms("manager", "registrator")).toBe(false);
    expect(canManagePasswordSms("manager", "marketing")).toBe(false);
    expect(canManagePasswordSms("registrator", "courier")).toBe(false);
    expect(canManagePasswordSms(null, "courier")).toBe(false);
  });

  it("429 — cooldown / daily, retry_after_seconds yoki Retry-After", () => {
    expect(
      readResendLimit({ response: { status: 429, data: { code: "PASSWORD_SMS_COOLDOWN", retry_after_seconds: 41 } } }),
    ).toEqual({ kind: "cooldown", retryAfterSeconds: 41 });
    expect(
      readResendLimit({ response: { status: 429, data: { code: "PASSWORD_SMS_DAILY_LIMIT" }, headers: { "retry-after": "3600" } } }),
    ).toEqual({ kind: "daily", retryAfterSeconds: 3600 });
    expect(readResendLimit({ response: { status: 429, data: {} } })).toEqual({ kind: "cooldown", retryAfterSeconds: 60 });
    expect(readResendLimit({ response: { status: 403, data: {} } })).toBeNull();
  });

  it("sanoq: soniyalar va `0:48`", () => {
    const now = Date.parse("2026-10-26T09:32:12.000Z");
    expect(secondsUntil("2026-10-26T09:33:00.000Z", now)).toBe(48);
    expect(secondsUntil("2026-10-26T09:30:00.000Z", now)).toBe(0);
    expect(secondsUntil(null, now)).toBe(0);
    expect(formatCountdown(48)).toBe("0:48");
    expect(formatCountdown(61)).toBe("1:01");
  });
});
