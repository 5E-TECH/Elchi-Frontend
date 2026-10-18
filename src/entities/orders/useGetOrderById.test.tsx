import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError, AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { emitQueryError, QUERY_ERROR_EVENT } from "../../shared/lib/queryErrorEvents";
import { shouldRetryQuery } from "../../shared/lib/queryRetry";
import { useOrders } from "./index";

/**
 * D-13 — buyurtma tafsiloti so'rovi (`GET orders/:id`): xatoni sahifa o'zi ko'rsatadi («Buyurtma topilmadi» /
 * «Qayta urinish»), shuning uchun global xabar chiqmaydi (`meta.silentError`), 404 esa qayta so'ralmaydi
 * (ilova sukuti `shouldRetryQuery`, D-08).
 */

const apiMock = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../../shared/api/api", () => ({ api: apiMock, LONG_REQUEST_TIMEOUT_MS: 120_000 }));

const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
const notFound = new AxiosError("Request failed with status code 404", AxiosError.ERR_BAD_REQUEST, config, {}, {
  status: 404,
  statusText: "",
  headers: {},
  config,
  data: { message: "Order #99999999 topilmadi" },
} as AxiosResponse);

// Ilovadagi `QueryClient` bilan bir xil: global xato hodisasi + qayta urinish qoidasi.
const createWrapper = () => {
  const client = new QueryClient({
    queryCache: new QueryCache({ onError: (error, query) => emitQueryError(error, query.meta) }),
    defaultOptions: { queries: { retry: shouldRetryQuery, retryDelay: 0 } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return Wrapper;
};

afterEach(() => {
  apiMock.get.mockReset();
});

describe("useGetOrderById — D-13", () => {
  it("⭐ 404: so'rov bir marta, global xato xabari yo'q (sahifa o'zi «Buyurtma topilmadi» deydi)", async () => {
    apiMock.get.mockRejectedValue(notFound);
    const listener = vi.fn();
    window.addEventListener(QUERY_ERROR_EVENT, listener);

    const { result } = renderHook(() => useOrders().useGetOrderById("99999999"), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    window.removeEventListener(QUERY_ERROR_EVENT, listener);

    expect(apiMock.get).toHaveBeenCalledTimes(1);
    expect(apiMock.get).toHaveBeenCalledWith("orders/99999999");
    expect(listener).not.toHaveBeenCalled();
  });
});
