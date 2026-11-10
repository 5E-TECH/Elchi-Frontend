import { describe, expect, it } from "vitest";
import { failedStopCode, isAnswerStop, messageKind } from "./messageKind";

describe("tarix qatori turi (B10)", () => {
  it("javob: end_turn / max_steps / truncated (yoki `stop` yo'q)", () => {
    for (const stop of ["end_turn", "max_steps", "truncated", null, ""]) expect(isAnswerStop(stop)).toBe(true);
    expect(messageKind({ role: "assistant", stop: "end_turn" })).toBe("answer");
    expect(messageKind({ role: "user", stop: null })).toBe("user");
  });

  it("javobsiz yakuniy qator (backend xato matnini saqlagan) — `failed`", () => {
    for (const stop of ["refused", "network", "limit", "cap_exceeded", "disabled", "other"]) {
      expect(messageKind({ role: "assistant", stop }), stop).toBe("failed");
    }
  });

  it("`stop` → xato kodi (ai-service `errorCode()` bilan bir xil)", () => {
    expect(failedStopCode("refused")).toBe("refused");
    expect(failedStopCode("network")).toBe("network");
    expect(failedStopCode("cap_exceeded")).toBe("cap_exceeded");
    expect(failedStopCode("disabled")).toBe("ai_disabled");
    expect(failedStopCode("limit")).toBe("message_limit");
    expect(failedStopCode("other")).toBe("ai_error");
    expect(failedStopCode(null)).toBe("ai_error");
  });
});
