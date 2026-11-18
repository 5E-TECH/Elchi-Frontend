import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useOrders } from "./index";

/**
 * Bekorlarni marketga topshirish — SKAN = TOPSHIRISH (2026-11-15): har skan alohida POST. Ro'yxatlar har skandan
 * keyin qayta so'ralmaydi (backend global per-IP limiti 60/daqiqa, HQ bitta IP): darhol faqat «eskirgan» belgisi,
 * ochiq so'rovlar esa ko'pi bilan 5 soniyada bir marta va oxirgi skandan keyin albatta yangilanadi.
 */

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock("../../shared/api/api", () => ({ api: apiMock, LONG_REQUEST_TIMEOUT_MS: 120000 }));

const setup = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const refetch = vi.spyOn(client, "refetchQueries");
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useOrders(), { wrapper: Wrapper });
  const handOver = (id: string) =>
    act(() =>
      result.current.handoverCancelledOrders.mutateAsync({
        marketId: "201",
        orderIds: [id],
        authorizationToken: "auth-1",
      }),
    );
  return { invalidate, refetch, handOver };
};

describe("bekorlarni topshirish — ro'yxatni yangilash chegarasi", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    apiMock.post.mockReset();
    apiMock.post.mockResolvedValue({ data: { statusCode: 200 } });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("har skan — darhol faqat «eskirgan» belgisi (tarmoqsiz); ochiq ro'yxatlar 5 s da bir marta yangilanadi", async () => {
    const { invalidate, refetch, handOver } = setup();

    await handOver("501");
    await handOver("502");
    await handOver("503");

    expect(apiMock.post).toHaveBeenCalledTimes(3);
    expect(apiMock.post).toHaveBeenLastCalledWith("orders/markets/201/cancelled/handover", {
      order_ids: ["503"],
      authorization_token: "auth-1",
    });
    expect(invalidate).toHaveBeenCalledTimes(3);
    for (const call of invalidate.mock.calls) {
      expect(call[0]).toEqual({ queryKey: ["orders"], refetchType: "none" });
    }
    expect(refetch).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(4999);
    });
    expect(refetch).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(refetch).toHaveBeenLastCalledWith({ queryKey: ["orders"], type: "active" });

    // Keyingi skan — yangi oyna: oxirgi skandan keyin ham albatta bitta yangilash.
    await handOver("504");
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(refetch).toHaveBeenCalledTimes(2);
  });

  it("xato javob — yangilash ham, «eskirgan» belgisi ham yo'q", async () => {
    const { invalidate, refetch, handOver } = setup();
    apiMock.post.mockRejectedValueOnce({ response: { status: 403 } });

    await expect(handOver("501")).rejects.toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(invalidate).not.toHaveBeenCalled();
    expect(refetch).not.toHaveBeenCalled();
  });
});
