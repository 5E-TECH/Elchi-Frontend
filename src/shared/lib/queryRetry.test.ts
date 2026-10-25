import { QueryClient } from "@tanstack/react-query";
import { AxiosError, AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { describe, expect, it, vi } from "vitest";
import { QUERY_RETRY_LIMIT, shouldRetryQuery } from "./queryRetry";

/**
 * D-08 — ilovaning `QueryClient` sukuti (`app/lib/provider.tsx` → `retry: shouldRetryQuery`):
 * 4xx (408, 429 dan tashqari) va vaqt chegarasi qayta so'ralmaydi; tarmoq xatosi va 5xx — 1 marta.
 */

const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
const request = {};
const httpError = (status: number) =>
  new AxiosError(`Request failed with status code ${status}`, AxiosError.ERR_BAD_RESPONSE, config, request, {
    status,
    statusText: "",
    headers: {},
    config,
    data: {},
  } as AxiosResponse);

describe("shouldRetryQuery", () => {
  it.each([400, 401, 403, 404, 409, 422])("⭐ %i — qayta so'ralmaydi", (status) => {
    expect(shouldRetryQuery(0, httpError(status))).toBe(false);
  });

  it.each([408, 429, 500, 502, 503])("%i — 1 marta qayta so'raladi", (status) => {
    expect(shouldRetryQuery(0, httpError(status))).toBe(true);
    expect(shouldRetryQuery(QUERY_RETRY_LIMIT, httpError(status))).toBe(false);
  });

  it("tarmoq xatosi va holatsiz xato — avvalgidek 1 marta", () => {
    expect(shouldRetryQuery(0, new AxiosError("Network Error", AxiosError.ERR_NETWORK, config, request))).toBe(true);
    expect(shouldRetryQuery(0, new Error("boom"))).toBe(true);
    expect(shouldRetryQuery(1, new Error("boom"))).toBe(false);
  });

  it("vaqt chegarasi (ECONNABORTED / ETIMEDOUT) — qayta so'ralmaydi", () => {
    expect(shouldRetryQuery(0, new AxiosError("So'rov vaqti tugadi", AxiosError.ECONNABORTED, config, request))).toBe(false);
    expect(shouldRetryQuery(0, new AxiosError("timeout of 20000ms exceeded", AxiosError.ETIMEDOUT, config, request))).toBe(false);
  });

  it("G6F68ti6 (12-band): brauzer bekor qilgan so'rov («Request aborted») — vaqt emas, 1 marta qayta so'raladi", () => {
    expect(shouldRetryQuery(0, new AxiosError("Request aborted", AxiosError.ECONNABORTED, config, request))).toBe(true);
    expect(shouldRetryQuery(1, new AxiosError("Request aborted", AxiosError.ECONNABORTED, config, request))).toBe(false);
  });
});

describe("QueryClient + shouldRetryQuery", () => {
  const run = async (error: unknown) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: shouldRetryQuery, retryDelay: 0 } } });
    const queryFn = vi.fn().mockRejectedValue(error);
    await client.fetchQuery({ queryKey: ["retry", Math.random()], queryFn }).catch(() => undefined);
    client.clear();
    return queryFn.mock.calls.length;
  };

  it("⭐ 404 — so'rov bir marta ketadi (ilgari ikki marta)", async () => {
    expect(await run(httpError(404))).toBe(1);
  });

  it("500 — ikki marta (1 qayta urinish)", async () => {
    expect(await run(httpError(500))).toBe(2);
  });
});
