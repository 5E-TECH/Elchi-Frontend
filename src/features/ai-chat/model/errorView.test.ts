import { describe, expect, it } from "vitest";
import { CUT_VIEW, classifyAfterAccess, classifyHttpFailure, classifyNetworkFailure, classifyStreamError } from "./errorView";

describe("xato → ko'rinish (maketlar -unavailable, -offline, -limit-reached)", () => {
  it("`meta` dan oldingi xato — «Javob olib bo'lmadi» + «Savol saqlanmadi — qayta yuboring.»", () => {
    expect(classifyStreamError({ code: "ai_error" }, false)).toEqual({
      action: "turn",
      view: expect.objectContaining({ variant: "failed", titleKey: "errors.answerFailed", descriptionKey: "errors.notSaved", canRetry: true }),
    });
    expect(classifyHttpFailure(500, null)).toMatchObject({ action: "turn", view: { descriptionKey: "errors.notSaved" } });
    expect(classifyHttpFailure(504, null)).toMatchObject({ action: "turn", view: { descriptionKey: "errors.notSaved" } });
    expect(classifyNetworkFailure(false)).toMatchObject({ action: "turn", view: { descriptionKey: "errors.notSaved" } });
  });

  it("`meta` dan keyingi xato — savol saqlangan, sababi kod bo'yicha", () => {
    for (const code of ["refused", "message_limit", "truncated", "ai_error"]) {
      expect(classifyStreamError({ code }, true)).toMatchObject({ action: "turn", view: { descriptionKey: `errors.codes.${code}` } });
    }
    expect(classifyStreamError({ code: "yangi_kod" }, true)).toMatchObject({ view: { descriptionKey: "errors.codes.ai_error" } });
  });

  it("uzilish: `meta` dan keyin «Aloqa uzildi» (qisman javob), oldin — javob olinmadi", () => {
    expect(classifyStreamError({ code: "network" }, true)).toEqual({ action: "turn", view: CUT_VIEW });
    expect(classifyNetworkFailure(true)).toEqual({ action: "turn", view: CUT_VIEW });
    expect(classifyStreamError({ code: "network" }, false)).toMatchObject({ view: { variant: "failed" } });
  });

  it("busy — xabar; invalid_message / 400 — maydon xatosi; daily_limit, o'chiq AI — `access/me` holati", () => {
    expect(classifyStreamError({ code: "busy" }, false)).toEqual({ action: "notify", titleKey: "errors.codes.busy" });
    expect(classifyStreamError({ code: "invalid_message" }, false)).toEqual({ action: "field", messageKey: "errors.codes.invalid_message" });
    expect(classifyHttpFailure(400, { message: ["message should not be empty"] })).toEqual({ action: "field", messageKey: "errors.codes.invalid_message" });
    expect(classifyStreamError({ code: "daily_limit" }, false)).toEqual({ action: "access" });
    expect(classifyStreamError({ code: "feature_disabled" }, false)).toEqual({ action: "access" });
    expect(classifyStreamError({ code: "ai_disabled" }, true)).toMatchObject({ action: "turn" });
  });

  it("xarajat shifti — ogohlantirish qutisi, `reset_at` gacha kiritish o'chiq", () => {
    expect(classifyStreamError({ code: "assistant_usd_cap", resetAt: "2026-11-11T00:00:00+05:00" }, false)).toEqual({
      action: "turn",
      view: expect.objectContaining({ variant: "cap", tone: "warning", canRetry: false, resetAt: "2026-11-11T00:00:00+05:00" }),
    });
    expect(classifyStreamError({ code: "cap_exceeded" }, true)).toMatchObject({ view: { variant: "cap", titleKey: "errors.codes.cap_exceeded" } });
  });

  it("suhbat to'lgan / topilmadi — «Yangi suhbat» amali", () => {
    expect(classifyStreamError({ code: "conversation_full" }, false)).toMatchObject({
      view: { newChat: true, canRetry: false, descriptionKey: "errors.notSavedNewChat" },
    });
    expect(classifyStreamError({ code: "conversation_not_found" }, false)).toMatchObject({
      view: { newChat: true, descriptionKey: "errors.notSavedNewChat" },
    });
  });

  it("401 va 403 PASSWORD_CHANGE_REQUIRED — global hal qilinadi (jim); oddiy 403 — ruxsat yo'q", () => {
    expect(classifyHttpFailure(401, null)).toEqual({ action: "silent" });
    expect(classifyHttpFailure(403, { code: "PASSWORD_CHANGE_REQUIRED" })).toEqual({ action: "silent" });
    expect(classifyHttpFailure(403, { statusCode: 403 })).toMatchObject({ action: "turn", view: { descriptionKey: "errors.codes.role_forbidden", canRetry: false } });
  });

  it("429 / 503 — avval `access/me`: limit tugagan yoki AI o'chiq → sahifa holati; aks holda IP cheklovi / javob xatosi (B8)", () => {
    expect(classifyHttpFailure(429, null)).toEqual({ action: "check-access" });
    expect(classifyHttpFailure(503, null)).toEqual({ action: "check-access" });
    const exhausted = { allowed: true, reason: null, remainingToday: 0 };
    const fine = { allowed: true, reason: null, remainingToday: 12 };
    expect(classifyAfterAccess(429, exhausted, 60)).toEqual({ action: "access" });
    expect(classifyAfterAccess(503, { allowed: false, reason: "feature_disabled", remainingToday: 50 }, null)).toEqual({ action: "access" });
    expect(classifyAfterAccess(429, fine, 60)).toEqual({
      action: "notify",
      titleKey: "errors.throttled",
      descriptionKey: "errors.throttledIn",
      values: { count: 60 },
    });
    expect(classifyAfterAccess(429, null, null)).toMatchObject({ action: "notify", descriptionKey: "errors.throttledLater" });
    expect(classifyAfterAccess(503, fine, null)).toMatchObject({ action: "turn", view: { descriptionKey: "errors.notSaved" } });
  });
});
