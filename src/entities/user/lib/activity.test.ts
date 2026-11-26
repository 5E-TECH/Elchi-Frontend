import { describe, expect, it } from "vitest";
import { hasActivity, isActivityRole, lastActivityAt } from "./activity";

describe("pe71yf8L — faollik yordamchilari", () => {
  it("faqat market va market operatori", () => {
    expect(isActivityRole("market")).toBe(true);
    expect(isActivityRole("market_operator")).toBe(true);
    expect(isActivityRole("courier")).toBe(false);
    expect(isActivityRole(undefined)).toBe(false);
  });

  it("hasActivity — rol va `is_online` (boolean) bo'lsa", () => {
    expect(hasActivity({ role: "market", is_online: false })).toBe(true);
    expect(hasActivity({ role: "market" })).toBe(false);
    expect(hasActivity({ role: "admin", is_online: true })).toBe(false);
  });

  it("lastActivityAt — kechrog'i; ikkalasi null — null; kalitlar yo'q — undefined", () => {
    expect(lastActivityAt({ last_login_at: "2026-11-27T08:00:00Z", last_seen_at: "2026-11-27T09:00:00Z" })).toBe(
      "2026-11-27T09:00:00Z",
    );
    expect(lastActivityAt({ last_login_at: "2026-11-27T10:00:00Z", last_seen_at: "2026-11-27T09:00:00Z" })).toBe(
      "2026-11-27T10:00:00Z",
    );
    expect(lastActivityAt({ last_login_at: "2026-11-27T10:00:00Z", last_seen_at: null })).toBe("2026-11-27T10:00:00Z");
    expect(lastActivityAt({ last_login_at: null, last_seen_at: null })).toBeNull();
    expect(lastActivityAt({})).toBeUndefined();
  });
});
