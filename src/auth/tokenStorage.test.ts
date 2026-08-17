import { afterEach, beforeEach, describe, expect, it } from "vitest";
import tokenStorage from "./tokenStorage";

// tokenStorage keeps the access token in memory + sessionStorage and
// deliberately keeps it OUT of localStorage (hardening against XSS token theft
// and cross-tab persistence). These tests lock that contract in.
describe("tokenStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    tokenStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    tokenStorage.clear();
  });

  it("returns null when no token has been set", () => {
    expect(tokenStorage.getAccessToken()).toBeNull();
  });

  it("stores the access token in memory and sessionStorage, never localStorage", () => {
    tokenStorage.setAccessToken("abc123");

    expect(tokenStorage.getAccessToken()).toBe("abc123");
    expect(window.sessionStorage.getItem("accessToken")).toBe("abc123");
    expect(window.localStorage.getItem("accessToken")).toBeNull();
  });

  it("purges any stray localStorage token when storing (migration/hardening)", () => {
    window.localStorage.setItem("accessToken", "stray-legacy-token");
    tokenStorage.setAccessToken("fresh");

    expect(window.localStorage.getItem("accessToken")).toBeNull();
    expect(window.sessionStorage.getItem("accessToken")).toBe("fresh");
  });

  it("overwrites a previously stored token", () => {
    tokenStorage.setAccessToken("first");
    tokenStorage.setAccessToken("second");

    expect(tokenStorage.getAccessToken()).toBe("second");
    expect(window.sessionStorage.getItem("accessToken")).toBe("second");
  });

  it("clear() removes the token from both memory and sessionStorage", () => {
    tokenStorage.setAccessToken("abc123");
    tokenStorage.clear();

    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(window.sessionStorage.getItem("accessToken")).toBeNull();
  });

  it("setAccessToken(null) behaves like clear()", () => {
    tokenStorage.setAccessToken("abc123");
    tokenStorage.setAccessToken(null);

    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(window.sessionStorage.getItem("accessToken")).toBeNull();
    expect(window.localStorage.getItem("accessToken")).toBeNull();
  });
});
