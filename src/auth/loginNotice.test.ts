import { afterEach, describe, expect, it } from "vitest";
import { clearLoginNotice, peekLoginNotice, peekLoginNoticeDetails, rememberLoginNotice } from "./loginNotice";

const KEY = "elchi_login_notice";

describe("loginNotice", () => {
  afterEach(() => window.sessionStorage.clear());

  it("stores the notice as JSON and peeks it without clearing", () => {
    rememberLoginNotice("passwordChanged");

    expect(JSON.parse(window.sessionStorage.getItem(KEY) ?? "null")).toEqual({ notice: "passwordChanged" });
    expect(peekLoginNotice()).toBe("passwordChanged");
    expect(peekLoginNotice()).toBe("passwordChanged");
    expect(peekLoginNoticeDetails()).toEqual({ notice: "passwordChanged", at: null });
  });

  it("keeps the expiry time of a sessionExpired notice", () => {
    rememberLoginNotice("sessionExpired", { at: 1_793_102_400_000 });

    expect(peekLoginNotice()).toBe("sessionExpired");
    expect(peekLoginNoticeDetails()).toEqual({ notice: "sessionExpired", at: 1_793_102_400_000 });
  });

  it("still reads the old plain-string format", () => {
    window.sessionStorage.setItem(KEY, "passwordChanged");

    expect(peekLoginNoticeDetails()).toEqual({ notice: "passwordChanged", at: null });
  });

  it("ignores unknown values, broken JSON and invalid times", () => {
    window.sessionStorage.setItem(KEY, "somethingElse");
    expect(peekLoginNotice()).toBeNull();

    window.sessionStorage.setItem(KEY, "{broken");
    expect(peekLoginNotice()).toBeNull();

    window.sessionStorage.setItem(KEY, JSON.stringify({ notice: "hacked", at: 1 }));
    expect(peekLoginNotice()).toBeNull();

    window.sessionStorage.setItem(KEY, JSON.stringify({ notice: "sessionExpired", at: "soon" }));
    expect(peekLoginNoticeDetails()).toEqual({ notice: "sessionExpired", at: null });
  });

  it("only one notice exists at a time — the last writer wins", () => {
    rememberLoginNotice("sessionExpired", { at: 1_000 });
    rememberLoginNotice("passwordChanged");

    expect(peekLoginNoticeDetails()).toEqual({ notice: "passwordChanged", at: null });
  });

  it("sessionExpired + revoked (sessiya boshqa qurilmadan yopilgan) — saqlanadi va o'qiladi; boshqa holatlarda kalit yo'q", () => {
    rememberLoginNotice("sessionExpired", { at: 1_000, revoked: true });
    expect(JSON.parse(window.sessionStorage.getItem(KEY) ?? "null")).toEqual({ notice: "sessionExpired", at: 1_000, revoked: true });
    expect(peekLoginNoticeDetails()).toEqual({ notice: "sessionExpired", at: 1_000, revoked: true });

    rememberLoginNotice("passwordChanged", { revoked: true });
    expect(peekLoginNoticeDetails()).toEqual({ notice: "passwordChanged", at: null });

    window.sessionStorage.setItem(KEY, JSON.stringify({ notice: "sessionExpired", at: 1_000, revoked: "yes" }));
    expect(peekLoginNoticeDetails()).toEqual({ notice: "sessionExpired", at: 1_000 });
  });

  it("clearLoginNotice removes it", () => {
    rememberLoginNotice("sessionExpired", { at: 1_000 });
    clearLoginNotice();

    expect(peekLoginNotice()).toBeNull();
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
  });
});
