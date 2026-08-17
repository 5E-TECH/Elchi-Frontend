import { describe, expect, it } from "vitest";
import { getBackendErrorMessage } from "./backendError";

describe("getBackendErrorMessage", () => {
  it("extracts backend messages regardless of response status", () => {
    expect(getBackendErrorMessage({
      response: { status: 400, data: { message: "Validation failed" } },
    })).toBe("Validation failed");
    expect(getBackendErrorMessage({
      response: { status: 500, data: { message: "Internal error" } },
    })).toBe("Internal error");
  });

  it("supports arrays, nested payloads and client errors", () => {
    expect(getBackendErrorMessage({
      response: { data: { errors: ["First", "Second"] } },
    })).toBe("First, Second");
    expect(getBackendErrorMessage({
      response: { data: { data: { detail: "Nested error" } } },
    })).toBe("Nested error");
    expect(getBackendErrorMessage({ message: "Network Error" })).toBe("Network Error");
  });
});
