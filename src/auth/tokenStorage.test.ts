import { afterEach, beforeEach, describe, expect, it } from "vitest";
import tokenStorage from "./tokenStorage";

describe("tokenStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    tokenStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    tokenStorage.clear();
  });

  it("returns null when no token has been set", () => {
    expect(tokenStorage.getAccessToken()).toBeNull();
  });

  it("stores the access token in memory and mirrors it to localStorage", () => {
    tokenStorage.setAccessToken("abc123");

    expect(tokenStorage.getAccessToken()).toBe("abc123");
    expect(window.localStorage.getItem("accessToken")).toBe("abc123");
  });

  it("overwrites a previously stored token", () => {
    tokenStorage.setAccessToken("first");
    tokenStorage.setAccessToken("second");

    expect(tokenStorage.getAccessToken()).toBe("second");
    expect(window.localStorage.getItem("accessToken")).toBe("second");
  });

  it("clear() removes the token from both memory and localStorage", () => {
    tokenStorage.setAccessToken("abc123");
    tokenStorage.clear();

    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(window.localStorage.getItem("accessToken")).toBeNull();
  });

  it("setAccessToken(null) behaves like clear()", () => {
    tokenStorage.setAccessToken("abc123");
    tokenStorage.setAccessToken(null);

    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(window.localStorage.getItem("accessToken")).toBeNull();
  });
});
