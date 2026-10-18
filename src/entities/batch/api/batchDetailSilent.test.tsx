import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  AxiosError,
  AxiosHeaders,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { emitQueryError, QUERY_ERROR_EVENT } from "../../../shared/lib/queryErrorEvents";
import { useBatchDetail } from "./batchApi";

/**
 * `useBatchDetail(id, { silentError })` — skaner natijasidagi ixtiyoriy paket tafsiloti (`GET transfer-batches/:id`)
 * xatosi global xabar (`QUERY_ERROR_EVENT` → toast) bermaydi. Sukut bo'yicha (`/batches/:id`) xabar chiqadi.
 */

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../../../shared/api/api", () => ({
  api: { get: mocks.get, post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));

const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
const forbidden = new AxiosError("Request failed with status code 403", AxiosError.ERR_BAD_REQUEST, config, {}, {
  status: 403,
  statusText: "",
  headers: {},
  config,
  data: { message: "Forbidden resource" },
} as AxiosResponse);

// Ilovadagi `QueryClient` kabi (`app/lib/provider.tsx`): global xato hodisasi, qayta urinishsiz.
const wrapper = ({ children }: { children: ReactNode }) => {
  const client = new QueryClient({
    queryCache: new QueryCache({ onError: (error, query) => emitQueryError(error, query.meta) }),
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

const globalErrorsOf = async (options?: { silentError?: boolean }) => {
  mocks.get.mockRejectedValue(forbidden);
  const listener = vi.fn();
  window.addEventListener(QUERY_ERROR_EVENT, listener);
  try {
    const { result } = renderHook(() => useBatchDetail("42", options), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  } finally {
    window.removeEventListener(QUERY_ERROR_EVENT, listener);
  }
  expect(mocks.get).toHaveBeenCalledWith("transfer-batches/42");
  return listener.mock.calls.length;
};

afterEach(() => {
  mocks.get.mockReset();
});

describe("useBatchDetail silentError", () => {
  it("default: a failed request still raises the global error (unchanged behaviour)", async () => {
    expect(await globalErrorsOf()).toBe(1);
  });

  it("{ silentError: true }: no global error event", async () => {
    expect(await globalErrorsOf({ silentError: true })).toBe(0);
  });

  it("disabled without an id (no request)", () => {
    renderHook(() => useBatchDetail(undefined, { silentError: true }), { wrapper });
    expect(mocks.get).not.toHaveBeenCalled();
  });
});
