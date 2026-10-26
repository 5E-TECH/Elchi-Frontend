import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ORDER_STATUS_COUNTS_REFRESH_MS,
  orderStatusCountsQueryKey,
  useNewIncomingOrdersCount,
  useOrderStatusCounts,
} from "./orderStatusCounts";

const http = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../../../shared/api/api", () => ({ api: http }));

/**
 * Review: filtrsiz `/orders` tablari va yon menyu badge'i bitta `["orders", "status-counts", {}]` so'rovini ulashadi —
 * 60 s lik taymer faqat BITTA kuzatuvchida (egasi ketsa yoki to'xtasa, ikkinchisi oladi).
 */
describe("status counts — one refetch timer for the shared query", () => {
  let client: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const COUNTS = { all: 1, new: 1, received: 0, on_the_road: 0, waiting: 0, sold: 0, paid: 0, cancelled: 0, new_incoming: 3 };

  /** So'rov kuzatuvchilaridan nechtasida davriy taymer bor (`refetchInterval` > 0). */
  const pollers = () =>
    (client.getQueryCache().find({ queryKey: orderStatusCountsQueryKey({}) })?.observers ?? []).filter((observer) => {
      const interval = observer.options.refetchInterval;
      return typeof interval === "number" && interval > 0;
    }).length;

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    http.get.mockReset();
    http.get.mockResolvedValue({ data: { data: COUNTS } });
  });
  afterEach(() => client.clear());

  it("page tabs + sidebar badge on the same key → exactly one observer polls; the other takes over when it leaves", async () => {
    const badge = renderHook(() => useNewIncomingOrdersCount(true), { wrapper });
    const page = renderHook(
      ({ paused }: { paused: boolean }) =>
        useOrderStatusCounts({}, { refetchInterval: paused ? false : ORDER_STATUS_COUNTS_REFRESH_MS }),
      { wrapper, initialProps: { paused: false } },
    );
    await waitFor(() => expect(badge.result.current).toBe(3));
    await waitFor(() => expect(pollers()).toBe(1));

    // Sahifa to'xtatildi (oyna ochiq) — badge baribir yangilanadi, taymer yana bitta.
    page.rerender({ paused: true });
    await waitFor(() => expect(pollers()).toBe(1));
    page.rerender({ paused: false });
    await waitFor(() => expect(pollers()).toBe(1));

    // Sahifadan chiqildi — badge egalikni oladi.
    page.unmount();
    await waitFor(() => expect(pollers()).toBe(1));
    badge.unmount();
    await waitFor(() => expect(pollers()).toBe(0));
  });

  it("filtered tabs use another key — both keep their own timer", async () => {
    renderHook(() => useNewIncomingOrdersCount(true), { wrapper });
    renderHook(() => useOrderStatusCounts({ search: "Ali" }, { refetchInterval: ORDER_STATUS_COUNTS_REFRESH_MS }), { wrapper });
    await waitFor(() => expect(pollers()).toBe(1));
    const filtered = client.getQueryCache().find({ queryKey: orderStatusCountsQueryKey({ search: "Ali" }) });
    await waitFor(() => expect(filtered?.observers[0]?.options.refetchInterval).toBe(ORDER_STATUS_COUNTS_REFRESH_MS));
  });
});
