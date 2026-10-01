import { AxiosError, type AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

const refreshHttpError = (status: number) =>
  new AxiosError("Request failed", "ERR_BAD_RESPONSE", undefined, undefined, {
    status,
    data: {},
  } as AxiosResponse);

/**
 * fix3 RBAC-11 / C10 — refresh 429/5xx/tarmoq xatosida interceptor
 * foydalanuvchini tizimdan chiqarmaydi; 401 da esa avvalgidek chiqaradi.
 */
describe("setupAuthInterceptors — vaqtinchalik refresh xatosi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSessionMetadata.mockReturnValue({
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
      refreshTokenWarnAt: null,
    });
    mocks.logoutAndRedirect.mockResolvedValue(undefined);
    mocks.getAccessToken.mockReturnValue("stale");
  });

  it.each([429, 503])("401 → refresh %s: logout YO'Q, so'rov rad etiladi", async (status) => {
    mocks.refreshAccessToken.mockRejectedValue(refreshHttpError(status));
    const { api, runResponseError } = wireInterceptors();

    await expect(
      runResponseError({ response: { status: 401 }, config: { url: "/orders", headers: {} } }),
    ).rejects.toBeInstanceOf(AxiosError);

    expect(mocks.logoutAndRedirect).not.toHaveBeenCalled();
    expect(api).not.toHaveBeenCalled();
  });

  it("muddati o'tgan access token, refresh 429 — so'rov rad etiladi, logout YO'Q", async () => {
    mocks.getSessionMetadata.mockReturnValue({
      accessTokenExpiresAt: Date.now() - 1_000,
      refreshTokenExpiresAt: Date.now() + 60_000,
      refreshTokenWarnAt: null,
    });
    mocks.refreshAccessToken.mockRejectedValue(refreshHttpError(429));
    const { runRequest } = wireInterceptors();

    await expect(runRequest({ headers: {} })).rejects.toBeInstanceOf(AxiosError);
    expect(mocks.logoutAndRedirect).not.toHaveBeenCalled();
  });

  it("tarmoq xatosida ham logout yo'q va 'Tarmoq xatosi' hodisasi chiqadi", async () => {
    const listener = vi.fn();
    window.addEventListener("elchi:network-error", listener);
    mocks.refreshAccessToken.mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));
    const { runResponseError } = wireInterceptors();

    await expect(
      runResponseError({ response: { status: 401 }, config: { url: "/orders", headers: {} } }),
    ).rejects.toBeDefined();

    expect(mocks.logoutAndRedirect).not.toHaveBeenCalled();
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener("elchi:network-error", listener);
  });

  it("refresh 401 (sessiya yaroqsiz) — avvalgidek logout", async () => {
    mocks.refreshAccessToken.mockRejectedValue(refreshHttpError(401));
    const { runResponseError } = wireInterceptors();

    await expect(
      runResponseError({ response: { status: 401 }, config: { url: "/orders", headers: {} } }),
    ).rejects.toBeDefined();

    expect(mocks.logoutAndRedirect).toHaveBeenCalledTimes(1);
  });
});
