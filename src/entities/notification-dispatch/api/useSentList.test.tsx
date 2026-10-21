import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SENT_LIST_LIVE_INTERVAL_MS, useSentList } from "./useSentList";

/** `useSentList` faqat sahifada «Yuborilmoqda» qatori bo'lsa so'rovni takrorlaydi (har 10 s). */

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../../../shared/api/api", () => ({
  api: { get: mocks.get, post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));

const page = (status: string) => ({
  data: {
    data: {
      items: [{ dispatch_id: "d1", status, title: "T", channels: ["in_app"], created_at: "2026-10-21T09:00:00.000Z" }],
      meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
    },
  },
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

const flush = () => act(() => vi.advanceTimersByTimeAsync(0));
const tick = () => act(() => vi.advanceTimersByTimeAsync(SENT_LIST_LIVE_INTERVAL_MS + 50));

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  mocks.get.mockReset();
});

describe("useSentList polling", () => {
  it("polls while a row is running and stops once it has finished", async () => {
    mocks.get.mockResolvedValueOnce(page("running")).mockResolvedValueOnce(page("running")).mockResolvedValue(page("sent"));
    const { result } = renderHook(() => useSentList({ page: 1, limit: 10 }), { wrapper });
    await flush();
    expect(result.current.data?.items[0].status).toBe("running");
    expect(mocks.get).toHaveBeenCalledTimes(1);

    await tick();
    expect(mocks.get).toHaveBeenCalledTimes(2);
    await tick();
    expect(mocks.get).toHaveBeenCalledTimes(3);
    expect(result.current.data?.items[0].status).toBe("sent");

    await tick();
    await tick();
    expect(mocks.get).toHaveBeenCalledTimes(3);
  });

  it("does not poll when nothing is running", async () => {
    mocks.get.mockResolvedValue(page("partial"));
    renderHook(() => useSentList({ page: 1, limit: 10 }), { wrapper });
    await flush();
    await tick();
    await tick();
    expect(mocks.get).toHaveBeenCalledTimes(1);
  });
});
