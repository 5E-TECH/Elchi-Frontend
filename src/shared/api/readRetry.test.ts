import { QueryClient } from "@tanstack/react-query";
import axios, { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { READ_TIMEOUT_MS, READ_TIMEOUT_RETRY_DELAYS_MS, withReadTimeoutRetry } from "./readRetry";
import { shouldRetryQuery } from "../lib/queryRetry";

const DEFAULT = 20_000;

const timeoutError = (config: InternalAxiosRequestConfig) =>
  new AxiosError("So'rov vaqti tugadi", AxiosError.ECONNABORTED, config, {});
const ok = (config: InternalAxiosRequestConfig) => ({ data: "ok", status: 200, statusText: "OK", headers: {}, config });

/** Haqiqiy axios instansiyasi, pastki adapter — soxta (har chaqiriqda `results` dan navbatdagisi). */
const setup = (results: Array<"timeout" | "ok" | "network" | "500">, epoch?: { value: number }) => {
  const seen: InternalAxiosRequestConfig[] = [];
  const base: AxiosAdapter = vi.fn(async (config) => {
    seen.push({ ...config });
    const next = results.shift() ?? "ok";
    if (next === "timeout") throw timeoutError(config);
    if (next === "network") throw new AxiosError("Network Error", AxiosError.ERR_NETWORK, config, {});
    if (next === "500") throw new AxiosError("fail", AxiosError.ERR_BAD_RESPONSE, config, {}, { ...ok(config), status: 500, data: {} });
    return ok(config);
  });
  const api = axios.create({ baseURL: "http://api.test/", timeout: DEFAULT, timeoutErrorMessage: "So'rov vaqti tugadi" });
  api.defaults.adapter = withReadTimeoutRetry(base, {
    defaultTimeout: DEFAULT,
    getLoginEpoch: epoch ? () => epoch.value : undefined,
  });
  if (epoch) {
    api.interceptors.request.use((config) => {
      (config as InternalAxiosRequestConfig & { _loginEpoch?: number })._loginEpoch = epoch.value;
      return config;
    });
  }
  return { api, base, seen };
};

describe("withReadTimeoutRetry", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("GET — 60 s, vaqt tugasa 2 s dan keyin bir marta jim qayta so'raladi", async () => {
    const { api, base, seen } = setup(["timeout", "ok"]);
    const promise = api.get("orders");
    await vi.advanceTimersByTimeAsync(0);
    expect(base).toHaveBeenCalledTimes(1);
    expect(seen[0].timeout).toBe(READ_TIMEOUT_MS);
    await vi.advanceTimersByTimeAsync(READ_TIMEOUT_RETRY_DELAYS_MS[0] - 1);
    expect(base).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(promise).resolves.toMatchObject({ data: "ok" });
    expect(base).toHaveBeenCalledTimes(2);
  });

  it("ikki marta vaqt tugasa — asl vaqt xatosi bilan rad etiladi (2 urinish)", async () => {
    const { api, base } = setup(["timeout", "timeout", "ok"]);
    const promise = api.get("orders").catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(10_000);
    const error = (await promise) as AxiosError;
    expect(error.code).toBe("ECONNABORTED");
    expect(base).toHaveBeenCalledTimes(2);
  });

  it.each(["post", "patch", "put", "delete"] as const)("%s — 20 s, qayta urinilmaydi", async (method) => {
    const { api, base, seen } = setup(["timeout", "ok"]);
    const promise = api.request({ url: "orders", method }).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(((await promise) as AxiosError).code).toBe("ECONNABORTED");
    expect(base).toHaveBeenCalledTimes(1);
    expect(seen[0].timeout).toBe(DEFAULT);
  });

  it("o'z vaqti bor GET (eksport 120 s) va `failFast` (skaner) — o'zgarmaydi, qayta urinilmaydi", async () => {
    const { api, base, seen } = setup(["timeout", "timeout", "ok", "ok"]);
    const exportCall = api.get("export", { timeout: 120_000 }).catch((e: unknown) => e);
    const scanCall = api.get("orders/qr-code/x", { failFast: true }).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(10_000);
    await exportCall;
    await scanCall;
    expect(base).toHaveBeenCalledTimes(2);
    expect(seen.map((c) => c.timeout)).toEqual([120_000, DEFAULT]);
  });

  it("tarmoq xatosi va 5xx — adapter qayta urinmaydi (ularni React Query bir marta urinadi)", async () => {
    const { api, base } = setup(["network", "500"]);
    await expect(api.get("a")).rejects.toMatchObject({ code: "ERR_NETWORK" });
    await expect(api.get("b")).rejects.toMatchObject({ response: { status: 500 } });
    expect(base).toHaveBeenCalledTimes(2);
  });

  it("kutish paytida bekor qilinsa — qayta yuborilmaydi (CanceledError)", async () => {
    const { api, base } = setup(["timeout", "ok"]);
    const controller = new AbortController();
    const promise = api.get("orders", { signal: controller.signal }).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(500);
    controller.abort();
    const error = await promise;
    expect(axios.isCancel(error)).toBe(true);
    expect(base).toHaveBeenCalledTimes(1);
  });

  it("vaqt tugaguncha qayta kirildi (loginEpoch) — eski sessiya so'rovi qayta yuborilmaydi", async () => {
    const epoch = { value: 1 };
    const { api, base } = setup(["timeout", "ok"], epoch);
    const promise = api.get("orders").catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(0); // birinchi urinish vaqti tugadi, 2 s kutilmoqda
    epoch.value = 2;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(((await promise) as AxiosError).code).toBe("ECONNABORTED");
    expect(base).toHaveBeenCalledTimes(1);
  });

  it("ayni GET qayta yuborilgan (invalidate tashlab ketgan) — eskisi qayta urinilmaydi, yangisi urinadi", async () => {
    const results: Array<"timeout" | "ok"> = [];
    const { api, base } = setup(results);
    let rejectOld: (e: unknown) => void = () => undefined;
    let rejectNew: (e: unknown) => void = () => undefined;
    (base as ReturnType<typeof vi.fn>)
      .mockImplementationOnce((config: InternalAxiosRequestConfig) => new Promise((_, reject) => { rejectOld = () => reject(timeoutError(config)); }))
      .mockImplementationOnce((config: InternalAxiosRequestConfig) => new Promise((_, reject) => { rejectNew = () => reject(timeoutError(config)); }));
    const older = api.get("orders", { params: { page: 1 } }).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(0);
    const newer = api.get("orders", { params: { page: 1 } });
    await vi.advanceTimersByTimeAsync(0);
    rejectOld(null);
    expect(((await older) as AxiosError).code).toBe("ECONNABORTED");
    rejectNew(null);
    await vi.advanceTimersByTimeAsync(READ_TIMEOUT_RETRY_DELAYS_MS[0]);
    await expect(newer).resolves.toMatchObject({ data: "ok" });
    expect(base).toHaveBeenCalledTimes(3);
  });
});

describe("adapter + React Query — bitta qavat qayta urinish", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const run = async (results: Array<"timeout" | "ok" | "network" | "500">) => {
    const { api, base } = setup(results);
    const client = new QueryClient({ defaultOptions: { queries: { retry: shouldRetryQuery, retryDelay: 0 } } });
    const promise = client.fetchQuery({ queryKey: ["r", Math.random()], queryFn: () => api.get("x") }).catch(() => undefined);
    await vi.advanceTimersByTimeAsync(10_000);
    await promise;
    client.clear();
    return (base as ReturnType<typeof vi.fn>).mock.calls.length;
  };

  it("doim vaqt tugasa — 2 so'rov (adapter 1 qayta, React Query 0)", async () => {
    expect(await run(["timeout", "timeout", "timeout", "timeout"])).toBe(2);
  });

  it("tarmoq xatosi — 2 so'rov (React Query 1 qayta, adapter 0)", async () => {
    expect(await run(["network", "network", "network"])).toBe(2);
  });
});
