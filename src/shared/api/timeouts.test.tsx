import { afterEach, describe, expect, it, vi } from "vitest";
import { api, API_TIMEOUT_MS, LONG_REQUEST_TIMEOUT_MS } from "./api";
import { READ_TIMEOUT_MS, READ_TIMEOUT_RETRY_DELAYS_MS } from "./readRetry";
import { authClient, AUTH_TIMEOUT_MS } from "../../auth/authService";

/**
 * Soxta XMLHttpRequest — liniya «qotgan»: javob hech qachon kelmaydi, test `ontimeout` ni o'zi chaqiradi (brauzer
 * `timeout` tugaganda shunday qiladi). Haqiqiy `api` (interceptor'lar, o'ralgan adapter, axios xhr adapteri) shu
 * orqali tekshiriladi — `readRetry.test.ts` alohida instansiyada, bu yerda esa `api.ts` dagi ulanish.
 */
class StalledXhr {
  static sent: StalledXhr[] = [];
  method = "";
  url = "";
  timeout = 0;
  withCredentials = false;
  responseType = "";
  readyState = 0;
  status = 0;
  onloadend: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader() {}
  addEventListener() {}
  getAllResponseHeaders() {
    return "";
  }
  abort() {}
  send() {
    StalledXhr.sent.push(this);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  StalledXhr.sent = [];
});

describe("axios timeouts (qJjLP109)", () => {
  it("the shared api instance gives up after 20 s", () => {
    expect(API_TIMEOUT_MS).toBe(20000);
    expect(api.defaults.timeout).toBe(20000);
  });

  it("read policy constants: 60 s, one silent retry after 2 s", () => {
    expect(READ_TIMEOUT_MS).toBe(60_000);
    expect(READ_TIMEOUT_RETRY_DELAYS_MS).toEqual([2_000]);
  });

  it("api GET (real wiring): 60 s, on timeout exactly one re-send 2 s later, then the timeout error", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("XMLHttpRequest", StalledXhr);

    const result = api.get("orders").catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(0);
    expect(StalledXhr.sent.map((xhr) => [xhr.method, xhr.timeout])).toEqual([["GET", READ_TIMEOUT_MS]]);

    StalledXhr.sent[0].ontimeout?.();
    await vi.advanceTimersByTimeAsync(READ_TIMEOUT_RETRY_DELAYS_MS[0] - 1);
    expect(StalledXhr.sent).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(StalledXhr.sent.map((xhr) => [xhr.method, xhr.timeout])).toEqual([
      ["GET", READ_TIMEOUT_MS],
      ["GET", READ_TIMEOUT_MS],
    ]);

    StalledXhr.sent[1].ontimeout?.();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await result).toMatchObject({ code: "ECONNABORTED" });
    expect(StalledXhr.sent).toHaveLength(2);
  });

  it("api POST (real wiring): 20 s and no re-send on timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("XMLHttpRequest", StalledXhr);

    const result = api.post("orders", { a: 1 }).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(0);
    expect(StalledXhr.sent.map((xhr) => [xhr.method, xhr.timeout])).toEqual([["POST", API_TIMEOUT_MS]]);
    StalledXhr.sent[0].ontimeout?.();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await result).toMatchObject({ code: "ECONNABORTED" });
    expect(StalledXhr.sent).toHaveLength(1);
  });

  it("api GET with failFast (scanner lookup): 20 s and no re-send", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("XMLHttpRequest", StalledXhr);

    const result = api.get("scan/BTB-1", { failFast: true }).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(0);
    expect(StalledXhr.sent.map((xhr) => xhr.timeout)).toEqual([API_TIMEOUT_MS]);
    StalledXhr.sent[0].ontimeout?.();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await result).toMatchObject({ code: "ECONNABORTED" });
    expect(StalledXhr.sent).toHaveLength(1);
  });

  it("the bootstrap/auth client gives up after 15 s", () => {
    expect(AUTH_TIMEOUT_MS).toBe(15000);
    expect(authClient.defaults.timeout).toBe(15000);
  });

  it("long requests (uploads, exports) get a separate, longer limit", () => {
    expect(LONG_REQUEST_TIMEOUT_MS).toBe(120000);
  });
});
