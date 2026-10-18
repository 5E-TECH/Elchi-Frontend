import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProducts } from "./index";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../../shared/api/api", () => ({ api: { get: mocks.get }, LONG_REQUEST_TIMEOUT_MS: 120_000 }));

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe("useProducts — market mahsulotlari: search/page/limit (3qDsJpfW)", () => {
  beforeEach(() => {
    mocks.get.mockReset().mockResolvedValue({ data: { data: [], total: 0, page: 1, limit: 10 } });
  });

  it("`useGetMyProducts(enabled, params)` — parametrlar so'rovga ketadi", async () => {
    renderHook(() => useProducts().useGetMyProducts(true, { page: 2, limit: 10, search: "olma" }), { wrapper });

    await waitFor(() =>
      expect(mocks.get).toHaveBeenCalledWith("product/my-products", { params: { page: 2, limit: 10, search: "olma" } }),
    );
  });

  it("params berilmasa — avvalgidek parametrsiz (buyurtma yaratish sahifasi o'zgarmaydi)", async () => {
    renderHook(() => useProducts().useGetMyProducts(true), { wrapper });

    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(1));
    expect(mocks.get.mock.calls[0]).toEqual(["product/my-products"]);
  });

  it("`useGetByMarketId(id, enabled, params)` — `limit` market mahsulotlari so'roviga ketadi", async () => {
    renderHook(() => useProducts().useGetByMarketId("3", true, { limit: 500 }), { wrapper });

    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith("product/market/3", { params: { limit: 500 } }));
  });
});
