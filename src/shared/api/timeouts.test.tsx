import { describe, expect, it } from "vitest";
import { api, API_TIMEOUT_MS, LONG_REQUEST_TIMEOUT_MS } from "./api";
import { authClient, AUTH_TIMEOUT_MS } from "../../auth/authService";

describe("axios timeouts (qJjLP109)", () => {
  it("the shared api instance gives up after 20 s", () => {
    expect(API_TIMEOUT_MS).toBe(20000);
    expect(api.defaults.timeout).toBe(20000);
  });

  it("the bootstrap/auth client gives up after 15 s", () => {
    expect(AUTH_TIMEOUT_MS).toBe(15000);
    expect(authClient.defaults.timeout).toBe(15000);
  });

  it("long requests (uploads, exports) get a separate, longer limit", () => {
    expect(LONG_REQUEST_TIMEOUT_MS).toBe(120000);
  });
});
