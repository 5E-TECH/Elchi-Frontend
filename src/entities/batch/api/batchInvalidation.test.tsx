import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useBatchDetail, useBatchRemainingDetail, useReceiveTransferBatchOrders } from "./batchApi";

/**
 * Paketdan buyurtmalarni qabul qilish (skaner oqimi) — keyin paket tafsiloti va «qolganlar» BIR martadan qayta
 * so'raladi. Ilgari `[BATCH_KEY]` dan keyin `[BATCH_KEY, id]` va `[BATCH_KEY, "remaining", id]` ham alohida
 * yangilanardi: TanStack ketayotgan so'rovni bekor qilib qayta yuboradi (HTTP so'rov esa baribir ketgan) — bitta
 * amal = tafsilot ×2, «qolganlar» ×3.
 */
const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("../../../shared/api/api", () => ({
  api: { get: mocks.get, post: mocks.post, patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));

afterEach(() => {
  mocks.get.mockReset();
  mocks.post.mockReset();
});

describe("paket amallaridan keyingi yangilash", () => {
  it("⭐ «qabul qilish» dan keyin tafsilot va «qolganlar» — har biri bitta GET", async () => {
    mocks.get.mockImplementation(
      () =>
        new Promise((resolve) => setTimeout(() => resolve({ data: { data: { id: "42" } } }), 20)),
    );
    mocks.post.mockResolvedValue({ data: {} });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () => ({
        detail: useBatchDetail("42"),
        remaining: useBatchRemainingDetail("42"),
        receive: useReceiveTransferBatchOrders(),
      }),
      { wrapper },
    );
    await waitFor(() =>
      expect(result.current.detail.isSuccess && result.current.remaining.isSuccess).toBe(true),
    );
    mocks.get.mockClear();

    await act(async () => {
      await result.current.receive.mutateAsync({ batchId: "42", orderIds: ["1", "2"] });
    });
    await waitFor(() =>
      expect(result.current.detail.isFetching || result.current.remaining.isFetching).toBe(false),
    );

    const calls = (url: string) => mocks.get.mock.calls.filter(([called]) => called === url).length;
    expect(calls("transfer-batches/42")).toBe(1);
    expect(calls("transfer-batches/42/remaining")).toBe(1);
  });
});
