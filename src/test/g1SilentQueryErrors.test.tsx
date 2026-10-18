import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "react-redux";
import {
  AxiosError,
  AxiosHeaders,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { emitQueryError, QUERY_ERROR_EVENT } from "../shared/lib/queryErrorEvents";
import { useBranchDetail, useBranchEmployees, useBranches } from "../entities/branch";
import { useDashboard } from "../entities/dashboard";
import { useCashBox } from "../entities/payments";
import { useProducts } from "../entities/product";
import { useMyRegionDistrictStats, useRegionDetailStats, useRegionStats } from "../entities/region";
import { useUser } from "../entities/user/api/userApi";
import { createTestStore } from "./test-utils";

/**
 * G1 — xatosi sahifaning o'zida chiziladigan so'rovlar (`ErrorState` / «Topilmadi»): global xabar
 * (`QUERY_ERROR_EVENT` → toast) takrorlanmaydi (`meta.silentError`, `useGetOrderById` naqshi). Masalan
 * `/branches/:id` 404 da backendning inglizcha «Branch not found» xabari toast bo'lib chiqmasin.
 * Umumiy hook'larda bu ixtiyoriy (`{ silentError: true }`) — boshqa iste'molchilar uchun xulq o'zgarmagan.
 */

const apiMock = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../shared/api/api", () => ({
  api: apiMock,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
  API_TIMEOUT_MS: 20_000,
}));

const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
const notFound = new AxiosError(
  "Request failed with status code 404",
  AxiosError.ERR_BAD_REQUEST,
  config,
  {},
  {
    status: 404,
    statusText: "",
    headers: {},
    config,
    data: { message: "Branch not found" },
  } as AxiosResponse,
);

// Ilovadagi `QueryClient` kabi: global xato hodisasi (`app/lib/provider.tsx`), qayta urinishsiz.
const createWrapper = () => {
  const client = new QueryClient({
    queryCache: new QueryCache({ onError: (error, query) => emitQueryError(error, query.meta) }),
    defaultOptions: { queries: { retry: false } },
  });
  const store = createTestStore();
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </Provider>
  );
  return Wrapper;
};

/** Hook xato bilan tugaguncha kutadi va global xato hodisasi necha marta chiqqanini qaytaradi. */
const globalErrorsOf = async (hook: () => { isError: boolean }) => {
  apiMock.get.mockRejectedValue(notFound);
  const listener = vi.fn();
  window.addEventListener(QUERY_ERROR_EVENT, listener);
  try {
    const { result } = renderHook(hook, { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
  } finally {
    window.removeEventListener(QUERY_ERROR_EVENT, listener);
  }
  return listener.mock.calls.length;
};

afterEach(() => {
  apiMock.get.mockReset();
});

describe("G1 so'rovlari — sahifadagi xato bilan global xabar takrorlanmaydi", () => {
  it.each<[string, () => { isError: boolean }]>([
    ["filiallar ro'yxati", () => useBranches({ page: 1, limit: 12 }, true, { silentError: true })],
    ["filial tafsiloti (404)", () => useBranchDetail("999", { silentError: true })],
    ["filial xodimlari", () => useBranchEmployees("999", true, { silentError: true })],
    [
      "foydalanuvchilar ro'yxati",
      () => useUser().useGetUser({ page: 1, limit: 10 }, true, { silentError: true }),
    ],
    [
      "foydalanuvchi tafsiloti",
      () => useUser().useGetUserById("5", undefined, { silentError: true }),
    ],
    [
      "hududlar statistikasi",
      () => useRegionStats({ startDate: "2026-10-08", endDate: "2026-10-08" }),
    ],
    [
      "viloyat tafsiloti",
      () => useRegionDetailStats("6", { startDate: "2026-10-08", endDate: "2026-10-08" }),
    ],
    [
      "o'z viloyati tumanlari",
      () => useMyRegionDistrictStats({ startDate: "2026-10-08", endDate: "2026-10-08" }),
    ],
    [
      "dashboard",
      () => useDashboard().getDashboard({ start_day: "2026-10-08", end_day: "2026-10-08" }),
    ],
    [
      "dashboard KPI",
      () => useDashboard().getKpi({ start_day: "2026-10-08", end_day: "2026-10-08" }),
    ],
    ["moliyaviy tahlil", () => useDashboard().getRevenue({ period: "daily" } as never)],
    [
      "mahsulotlar (xodim)",
      () => useProducts().useGetProducts({ page: 1, limit: 10 }, true, { silentError: true }),
    ],
    [
      "o'z mahsulotlari (market)",
      () => useProducts().useGetMyProducts(true, { limit: 10 }, { silentError: true }),
    ],
    [
      "market mahsulotlari",
      () => useProducts().useGetByMarketId("1", true, { limit: 500 }, { silentError: true }),
    ],
    [
      "kuryer kassasi",
      () => useCashBox().useGetCashboxMyCashbox({ fromDate: "2026-10-08" }, { silentError: true }),
    ],
  ])("%s — global xabar yo'q", async (_name, hook) => {
    expect(await globalErrorsOf(hook)).toBe(0);
  });

  it.each<[string, () => { isError: boolean }]>([
    ["filial tafsiloti", () => useBranchDetail("999")],
    ["filiallar ro'yxati", () => useBranches({ page: 1, limit: 12 })],
    ["foydalanuvchi tafsiloti", () => useUser().useGetUserById("5")],
    ["o'z mahsulotlari", () => useProducts().useGetMyProducts(true, { limit: 10 })],
  ])("%s — bayroqsiz boshqa iste'molchilar uchun global xabar avvalgidek", async (_name, hook) => {
    expect(await globalErrorsOf(hook)).toBe(1);
  });
});
