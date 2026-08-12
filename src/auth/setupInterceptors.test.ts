import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AxiosInstance } from "axios";

// Hoisted mocks so the vi.mock factories below can reference them.
const mocks = vi.hoisted(() => ({
  getAccessToken: vi.fn<() => string | null>(),
  refreshAccessToken: vi.fn<() => Promise<string>>(),
  logoutAndRedirect: vi.fn<() => Promise<void>>(),
}));

vi.mock("./tokenStorage", () => ({
  default: {
    getAccessToken: mocks.getAccessToken,
    setAccessToken: vi.fn(),
    clear: vi.fn(),
  },
}));

vi.mock("./authService", () => ({
  refreshAccessToken: mocks.refreshAccessToken,
  logoutAndRedirect: mocks.logoutAndRedirect,
}));

import { setupAuthInterceptors } from "./setupInterceptors";

type TestConfig = { headers: Record<string, string>; url?: string; _retry?: boolean };
type RequestHandler = (config: TestConfig) => TestConfig;
type ErrorHandler = (error: unknown) => Promise<unknown>;

// Minimal fake axios instance that records the registered interceptor handlers
// and is itself callable (the response handler retries via `api(originalRequest)`).
function makeFakeApi() {
  let requestHandler: RequestHandler | undefined;
  let errorHandler: ErrorHandler | undefined;
  const retry = vi.fn().mockResolvedValue({ data: "ok" });

  const fakeApi = Object.assign((config: TestConfig) => retry(config), {
    interceptors: {
      request: {
        use: (fn: RequestHandler) => {
          requestHandler = fn;
        },
      },
      response: {
        use: (_onFulfilled: (res: unknown) => unknown, onRejected: ErrorHandler) => {
          errorHandler = onRejected;
        },
      },
    },
  });

  setupAuthInterceptors(fakeApi as unknown as AxiosInstance);

  return {
    retry,
    runRequest: (config: TestConfig) => requestHandler!(config),
    runError: (error: unknown) => errorHandler!(error),
  };
}

describe("setupAuthInterceptors — request interceptor", () => {
  beforeEach(() => {
    mocks.getAccessToken.mockReset();
    mocks.refreshAccessToken.mockReset();
    mocks.logoutAndRedirect.mockReset();
  });

  it("attaches the Bearer token when one is available", () => {
    mocks.getAccessToken.mockReturnValue("tok");
    const { runRequest } = makeFakeApi();

    const config = runRequest({ headers: {} });

    expect(config.headers.Authorization).toBe("Bearer tok");
  });

  it("does not attach an Authorization header when there is no token", () => {
    mocks.getAccessToken.mockReturnValue(null);
    const { runRequest } = makeFakeApi();

    const config = runRequest({ headers: {} });

    expect(config.headers.Authorization).toBeUndefined();
  });
});

describe("setupAuthInterceptors — 401 refresh flow", () => {
  beforeEach(() => {
    mocks.getAccessToken.mockReset();
    mocks.refreshAccessToken.mockReset();
    mocks.logoutAndRedirect.mockReset();
    mocks.getAccessToken.mockReturnValue(null);
  });

  it("refreshes the token and retries the original request with the new token", async () => {
    mocks.refreshAccessToken.mockResolvedValue("newtok");
    const { runError, retry } = makeFakeApi();

    await runError({ response: { status: 401 }, config: { url: "/orders", headers: {} } });

    expect(mocks.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(retry).toHaveBeenCalledTimes(1);
    const retriedConfig = retry.mock.calls[0][0] as TestConfig;
    expect(retriedConfig.headers.Authorization).toBe("Bearer newtok");
    expect(retriedConfig._retry).toBe(true);
  });

  it("logs out and redirects when the refresh itself fails", async () => {
    mocks.refreshAccessToken.mockRejectedValue(new Error("refresh failed"));
    mocks.logoutAndRedirect.mockResolvedValue(undefined);
    const { runError } = makeFakeApi();

    await expect(
      runError({ response: { status: 401 }, config: { url: "/orders", headers: {} } }),
    ).rejects.toBeTruthy();

    expect(mocks.logoutAndRedirect).toHaveBeenCalledTimes(1);
  });

  it("does not attempt a refresh for the login endpoint", async () => {
    const { runError } = makeFakeApi();
    const error = { response: { status: 401 }, config: { url: "/auth/login", headers: {} } };

    await expect(runError(error)).rejects.toBe(error);

    expect(mocks.refreshAccessToken).not.toHaveBeenCalled();
  });

  it("de-duplicates concurrent refreshes (single-flight)", async () => {
    let resolveRefresh!: (value: string) => void;
    mocks.refreshAccessToken.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveRefresh = resolve;
      }),
    );
    const { runError, retry } = makeFakeApi();

    const first = runError({ response: { status: 401 }, config: { url: "/a", headers: {} } });
    const second = runError({ response: { status: 401 }, config: { url: "/b", headers: {} } });
    resolveRefresh("newtok");
    await Promise.all([first, second]);

    expect(mocks.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(retry).toHaveBeenCalledTimes(2);
  });
});
