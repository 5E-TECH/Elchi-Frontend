import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * F7PWp6cK — `authFetch` (AI yordamchining SSE so'rovi) axios interceptor bilan bir xil ishlaydi: Bearer token,
 * `credentials: include`, 401 → bitta yangilash va bitta qayta yuborish, eski kirishning 401 i qayta yuborilmaydi,
 * 403 `PASSWORD_CHANGE_REQUIRED` → parol oynasi, tarmoq xatosi xabarsiz belgilanadi, javob — «Aloqa tiklandi».
 */

const mocks = vi.hoisted(() => ({
  token: { value: "tok-1" as string | null },
  metadata: { accessTokenExpiresAt: null as number | null, refreshTokenExpiresAt: null as number | null },
  refreshAccessToken: vi.fn<() => Promise<string>>(),
  logoutAndRedirect: vi.fn(async () => undefined),
  requirePasswordChange: vi.fn(),
  markNetworkDown: vi.fn(),
  emitNetworkRestored: vi.fn(),
  epoch: { value: 0 },
}));

vi.mock("./tokenStorage", () => ({
  default: {
    getAccessToken: () => mocks.token.value,
    getSessionMetadata: () => ({ ...mocks.metadata, refreshTokenWarnAt: null }),
  },
}));

vi.mock("./authService", () => ({
  refreshAccessToken: mocks.refreshAccessToken,
  logoutAndRedirect: mocks.logoutAndRedirect,
}));

vi.mock("./passwordChange", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./passwordChange")>()),
  requirePasswordChange: mocks.requirePasswordChange,
}));

vi.mock("./networkError", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./networkError")>()),
  markNetworkDown: mocks.markNetworkDown,
  emitNetworkRestored: mocks.emitNetworkRestored,
}));

vi.mock("./loginEpoch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./loginEpoch")>()),
  getLoginEpoch: () => mocks.epoch.value,
}));

import { apiUrl, authFetch } from "./authFetch";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const fetchMock = vi.fn<(input: string, init: RequestInit) => Promise<Response>>();

const authOf = (call: number) => new Headers(fetchMock.mock.calls[call][1].headers).get("Authorization");

describe("authFetch", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    mocks.token.value = "tok-1";
    mocks.metadata.accessTokenExpiresAt = null;
    mocks.metadata.refreshTokenExpiresAt = null;
    mocks.epoch.value = 0;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("Bearer token, `credentials: include`, so'rov sarlavhalari saqlanadi; javob — «Aloqa tiklandi» signali", async () => {
    fetchMock.mockResolvedValueOnce(json(200, { ok: true }));
    const response = await authFetch("ai/assistant/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(apiUrl("ai/assistant/messages"));
    expect(init.credentials).toBe("include");
    expect(init.method).toBe("POST");
    expect(authOf(0)).toBe("Bearer tok-1");
    expect(new Headers(init.headers).get("Content-Type")).toBe("application/json");
    expect(mocks.emitNetworkRestored).toHaveBeenCalled();
  });

  it("muddati o'tgan access token — avval yangilanadi (so'rov yangi token bilan ketadi)", async () => {
    mocks.metadata.accessTokenExpiresAt = Date.now() - 1000;
    mocks.refreshAccessToken.mockResolvedValueOnce("tok-fresh");
    fetchMock.mockResolvedValueOnce(json(200, {}));
    await authFetch("x");
    expect(mocks.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(authOf(0)).toBe("Bearer tok-fresh");
  });

  it("refresh token muddati o'tgan — so'rov ketmaydi, sessiya tugadi (chiqish)", async () => {
    mocks.metadata.refreshTokenExpiresAt = Date.now() - 1000;
    await expect(authFetch("x")).rejects.toThrow("Refresh token expired");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.logoutAndRedirect).toHaveBeenCalledWith({ reason: "sessionExpired" });
  });

  it("401 → bitta yangilash va bitta qayta yuborish (ikkinchi 401 qayta yangilanmaydi)", async () => {
    mocks.refreshAccessToken.mockResolvedValue("tok-2");
    fetchMock.mockResolvedValueOnce(json(401, { message: "Unauthorized" })).mockResolvedValueOnce(json(401, {}));
    const response = await authFetch("x", { method: "POST" });
    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(authOf(1)).toBe("Bearer tok-2");
    expect(mocks.refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  it("401 + «Session revoked», yangilash rad etildi — sababi bilan chiqish, qayta yuborilmaydi", async () => {
    mocks.refreshAccessToken.mockRejectedValueOnce(Object.assign(new Error("401"), { isAxiosError: true, response: { status: 401 } }));
    fetchMock.mockResolvedValueOnce(json(401, { message: "Session revoked" }));
    await expect(authFetch("x")).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mocks.logoutAndRedirect).toHaveBeenCalledWith({ reason: "sessionExpired", revoked: true });
  });

  it("yangilash paytida boshqa foydalanuvchi kirdi — eski savol yangi token bilan qayta yuborilmaydi", async () => {
    mocks.refreshAccessToken.mockImplementationOnce(async () => {
      mocks.epoch.value += 1;
      return "tok-other-user";
    });
    fetchMock.mockResolvedValueOnce(json(401, {}));
    const response = await authFetch("x");
    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("403 PASSWORD_CHANGE_REQUIRED — «Yangi parol o'rnating» oynasi", async () => {
    fetchMock.mockResolvedValueOnce(json(403, { statusCode: 403, code: "PASSWORD_CHANGE_REQUIRED" }));
    const response = await authFetch("x");
    expect(response.status).toBe(403);
    expect(mocks.requirePasswordChange).toHaveBeenCalledTimes(1);
  });

  it("oddiy 403 / 429 — parol oynasi yo'q, javob chaqiruvchiga", async () => {
    fetchMock.mockResolvedValueOnce(json(403, { statusCode: 403, message: "AI yordamchi faqat …" }));
    expect((await authFetch("x")).status).toBe(403);
    fetchMock.mockResolvedValueOnce(json(429, { statusCode: 429 }));
    expect((await authFetch("x")).status).toBe(429);
    expect(mocks.requirePasswordChange).not.toHaveBeenCalled();
  });

  it("tarmoq xatosi (`TypeError`) — xabarsiz «aloqa uzildi» belgisi, xato chaqiruvchiga", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(authFetch("x")).rejects.toBeInstanceOf(TypeError);
    expect(mocks.markNetworkDown).toHaveBeenCalledWith("offline");
  });

  it("bekor qilish (`AbortError`) — tarmoq xatosi emas", async () => {
    fetchMock.mockRejectedValueOnce(new DOMException("aborted", "AbortError"));
    await expect(authFetch("x")).rejects.toMatchObject({ name: "AbortError" });
    expect(mocks.markNetworkDown).not.toHaveBeenCalled();
  });
});
