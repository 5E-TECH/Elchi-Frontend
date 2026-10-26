import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAccessToken: vi.fn<() => string | null>(),
  getSessionMetadata: vi.fn(),
  refreshAccessToken: vi.fn<() => Promise<string>>(),
  logoutAndRedirect: vi.fn<(options?: { reason?: "sessionExpired" }) => Promise<void>>(),
}));

vi.mock("./tokenStorage", () => ({
  default: { getAccessToken: mocks.getAccessToken, getSessionMetadata: mocks.getSessionMetadata },
}));

vi.mock("./authService", () => ({
  refreshAccessToken: mocks.refreshAccessToken,
  logoutAndRedirect: mocks.logoutAndRedirect,
}));

import { notify } from "../shared/lib/notify";
import { SESSION_CHECK_TOAST_ID, setupAuthInterceptors } from "./setupInterceptors";
import { clearPasswordChangeFlag, isPasswordChangePromptOpen } from "./passwordChange";

type Handler = (value: unknown) => unknown;

const wire = () => {
  let responseError: Handler = (e) => Promise.reject(e);
  const api = vi.fn() as unknown as {
    interceptors: { request: { use: (fn: Handler) => void }; response: { use: (ok: Handler, err: Handler) => void } };
  };
  api.interceptors = {
    request: { use: () => undefined },
    response: { use: (_ok, err) => { responseError = err; } },
  };
  setupAuthInterceptors(api as never);
  return (error: unknown) => responseError(error);
};

const httpError = (status: number, data: unknown, url = "orders") => ({
  isAxiosError: true,
  message: `Request failed with status code ${status}`,
  config: { url, headers: {} },
  response: { status, data, headers: {} },
});

describe("setupAuthInterceptors — NDmZMzCP xavfsizlik kodlari", () => {
  beforeEach(() => {
    mocks.getAccessToken.mockReturnValue("tok");
    mocks.getSessionMetadata.mockReturnValue({ accessTokenExpiresAt: null, refreshTokenExpiresAt: null, refreshTokenWarnAt: null });
    mocks.logoutAndRedirect.mockResolvedValue(undefined);
    clearPasswordChangeFlag();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("503 SESSION_CHECK_UNAVAILABLE — chiqarilmaydi, token yangilanmaydi, bitta ogohlantirish (bir xil id)", async () => {
    const warning = vi.spyOn(notify, "warning");
    const run = wire();
    const error = httpError(503, { statusCode: 503, message: "Session check unavailable", code: "SESSION_CHECK_UNAVAILABLE" });

    await expect(run(error)).rejects.toBe(error);
    await expect(run(error)).rejects.toBe(error);

    expect(mocks.logoutAndRedirect).not.toHaveBeenCalled();
    expect(mocks.refreshAccessToken).not.toHaveBeenCalled();
    expect(warning).toHaveBeenCalledTimes(2);
    expect(warning.mock.calls.every(([, options]) => options?.id === SESSION_CHECK_TOAST_ID)).toBe(true);
    expect(warning.mock.calls[0][0]).toBe("Sessiyani tekshirib bo'lmadi");
  });

  it("oddiy 503 (kodsiz) — ogohlantirish yo'q, chiqish yo'q", async () => {
    const warning = vi.spyOn(notify, "warning");
    const run = wire();
    await expect(run(httpError(503, { message: "Service Unavailable" }))).rejects.toBeDefined();
    expect(warning).not.toHaveBeenCalled();
    expect(mocks.logoutAndRedirect).not.toHaveBeenCalled();
  });

  it("403 PASSWORD_CHANGE_REQUIRED — «Yangi parol o'rnating» oynasi ochiladi, chiqarilmaydi", async () => {
    const run = wire();
    expect(isPasswordChangePromptOpen()).toBe(false);
    await expect(
      run(httpError(403, { statusCode: 403, message: "Parolni almashtiring", code: "PASSWORD_CHANGE_REQUIRED" })),
    ).rejects.toBeDefined();
    expect(isPasswordChangePromptOpen()).toBe(true);
    expect(mocks.logoutAndRedirect).not.toHaveBeenCalled();
  });

  it("oddiy 403 — bayroq tegilmaydi", async () => {
    const run = wire();
    await expect(run(httpError(403, { message: "Forbidden" }))).rejects.toBeDefined();
    expect(isPasswordChangePromptOpen()).toBe(false);
  });
});
