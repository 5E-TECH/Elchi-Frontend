import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the two collaborators the interceptor depends on. `vi.hoisted` lets the
// hoisted `vi.mock` factories reference these shared spies.
const mocks = vi.hoisted(() => ({
  getAccessToken: vi.fn<() => string | null>(),
  getSessionMetadata: vi.fn(),
  refreshAccessToken: vi.fn<() => Promise<string>>(),
  logoutAndRedirect: vi.fn<() => Promise<void>>(),
}));

vi.mock("./tokenStorage", () => ({
  default: {
    getAccessToken: mocks.getAccessToken,
    getSessionMetadata: mocks.getSessionMetadata,
  },
}));

vi.mock("./authService", () => ({
  refreshAccessToken: mocks.refreshAccessToken,
  logoutAndRedirect: mocks.logoutAndRedirect,
}));

import { setupAuthInterceptors } from "./setupInterceptors";

type Handler = (value: unknown) => unknown;

/** Build a fake axios instance and capture the interceptor callbacks. */
const wireInterceptors = () => {
  let requestHandler: Handler = (c) => c;
  let responseError: Handler = (e) => Promise.reject(e);

  const api = vi.fn(async (config: unknown) => ({ data: "retried", config })) as unknown as {
    (config: unknown): Promise<unknown>;
    interceptors: {
      request: { use: (fn: Handler) => void };
      response: { use: (ok: Handler, err: Handler) => void };
    };
  };
  api.interceptors = {
    request: { use: (fn) => { requestHandler = fn; } },
    response: { use: (_ok, err) => { responseError = err; } },
  };

  setupAuthInterceptors(api as never);
  return { api, runRequest: (c: unknown) => requestHandler(c), runResponseError: (e: unknown) => responseError(e) };
};

describe("setupAuthInterceptors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // No token-expiry metadata by default → no proactive/forced refresh path.
    mocks.getSessionMetadata.mockReturnValue({
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
      refreshTokenWarnAt: null,
    });
    mocks.logoutAndRedirect.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("request interceptor", () => {
    it("attaches the Bearer token when one is available", async () => {
      mocks.getAccessToken.mockReturnValue("tok123");
      const { runRequest } = wireInterceptors();

      const config = (await runRequest({ headers: {} })) as { headers: Record<string, string> };

      expect(config.headers.Authorization).toBe("Bearer tok123");
    });

    it("does not attach an Authorization header when there is no token", async () => {
      mocks.getAccessToken.mockReturnValue(null);
      const { runRequest } = wireInterceptors();

      const config = (await runRequest({ headers: {} })) as { headers: Record<string, string> };

      expect(config.headers.Authorization).toBeUndefined();
    });
  });

  describe("401 refresh flow", () => {
    it("refreshes the token and retries the original request with the new token", async () => {
      mocks.getAccessToken.mockReturnValue("stale");
      mocks.refreshAccessToken.mockResolvedValue("fresh-token");
      const { api, runResponseError } = wireInterceptors();

      const originalRequest = { url: "/orders", headers: {} as Record<string, string> };
      await runResponseError({ response: { status: 401 }, config: originalRequest });

      expect(mocks.refreshAccessToken).toHaveBeenCalledTimes(1);
      expect(api).toHaveBeenCalledTimes(1);
      const retried = (api as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0] as {
        _retry?: boolean;
        headers: Record<string, string>;
      };
      expect(retried._retry).toBe(true);
      expect(retried.headers.Authorization).toBe("Bearer fresh-token");
      expect(mocks.logoutAndRedirect).not.toHaveBeenCalled();
    });

    it("logs out and redirects when the refresh itself fails", async () => {
      mocks.getAccessToken.mockReturnValue("stale");
      mocks.refreshAccessToken.mockRejectedValue(new Error("refresh failed"));
      const { api, runResponseError } = wireInterceptors();

      await expect(
        runResponseError({ response: { status: 401 }, config: { url: "/orders", headers: {} } }),
      ).rejects.toThrow("refresh failed");

      expect(mocks.logoutAndRedirect).toHaveBeenCalledTimes(1);
      expect(api).not.toHaveBeenCalled();
    });

    it("does not refresh on the login/refresh endpoints or non-401 errors", async () => {
      mocks.getAccessToken.mockReturnValue("stale");
      const { runResponseError } = wireInterceptors();

      await expect(
        runResponseError({ response: { status: 500 }, config: { url: "/orders", headers: {} } }),
      ).rejects.toBeDefined();
      await expect(
        runResponseError({ response: { status: 401 }, config: { url: "/auth/login", headers: {} } }),
      ).rejects.toBeDefined();

      expect(mocks.refreshAccessToken).not.toHaveBeenCalled();
    });
  });
});
