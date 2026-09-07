import { describe, expect, it } from "vitest";
import { getApiErrorMessage } from "./apiError";

describe("getApiErrorMessage", () => {
  it("prefers the backend response.data.message", () => {
    const error = { response: { data: { message: "Filial band" } } };
    expect(getApiErrorMessage(error, "fallback")).toBe("Filial band");
  });

  it("falls back to response.data.error", () => {
    const error = { response: { data: { error: "Conflict" } } };
    expect(getApiErrorMessage(error, "fallback")).toBe("Conflict");
  });

  it("returns the fallback when the body has no message", () => {
    expect(getApiErrorMessage({ response: { data: {} } }, "fallback")).toBe("fallback");
    expect(getApiErrorMessage(new Error("Network Error"), "fallback")).toBe("fallback");
    expect(getApiErrorMessage(undefined, "fallback")).toBe("fallback");
  });

  it("ignores blank/non-string body messages", () => {
    expect(getApiErrorMessage({ response: { data: { message: "   " } } }, "fb")).toBe("fb");
    expect(getApiErrorMessage({ response: { data: { message: 42 } } }, "fb")).toBe("fb");
  });

  it("defaults the fallback to an empty string", () => {
    expect(getApiErrorMessage({})).toBe("");
  });
});
