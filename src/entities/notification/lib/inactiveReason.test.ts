import { describe, expect, it } from "vitest";
import {
  NOTIFICATION_INACTIVE_REASONS,
  inactiveReasonKey,
  inactiveReasonTone,
  parseInactiveReason,
} from "./inactiveReason";

/** NG-C (G085w5Qr): `inactive_reason` → matn guruhi va ton; `null` / noma'lum qiymat — umumiy neytral izoh (D1). */
describe("inactiveReason", () => {
  it("backend enumi bilan bir xil (TELEGRAM_MARKET_INACTIVE_REASONS)", () => {
    expect(NOTIFICATION_INACTIVE_REASONS).toEqual(["kicked", "left", "blocked_on_send", "chat_not_found", "manual"]);
  });

  it.each([
    ["kicked", "botRemoved", "danger"],
    ["left", "botRemoved", "danger"],
    ["blocked_on_send", "sendBlocked", "danger"],
    ["chat_not_found", "chatNotFound", "danger"],
    ["manual", "manual", "neutral"],
  ] as const)("%s → %s, %s", (reason, key, tone) => {
    expect(parseInactiveReason(reason)).toBe(reason);
    expect(inactiveReasonKey(reason)).toBe(key);
    expect(inactiveReasonTone(reason)).toBe(tone);
  });

  it.each([null, undefined, "", "archived", "KICKED", 42, {}])("noma'lum qiymat %o → null, unknown, neutral", (value) => {
    const reason = parseInactiveReason(value);
    expect(reason).toBeNull();
    expect(inactiveReasonKey(reason)).toBe("unknown");
    expect(inactiveReasonTone(reason)).toBe("neutral");
  });
});
