import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "../../../shared/config/queryKeys";
import { useDispatchNotification } from "./useDispatchNotification";

/**
 * Yuborishdan keyin (muvaffaqiyat ham, 504 ham) «Yuborilganlar» ro'yxati keshi eskiradi — aks holda 30 s ichida
 * `/notifications/sent` ga qaytilsa yangi xabar ko'rinmaydi.
 */

const mocks = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("../../../shared/api/api", () => ({
  api: { get: vi.fn(), post: mocks.post, patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));

const setup = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } });
  const listKey = queryKeys.notificationsSent.list({ page: 1, limit: 10 });
  const inboxKey = queryKeys.notificationsInbox.list({ page: 1 });
  client.setQueryData(listKey, { items: [], total: 0 });
  client.setQueryData(inboxKey, { items: [] });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useDispatchNotification(), { wrapper });
  return {
    result,
    isListStale: () => client.getQueryState(listKey)?.isInvalidated,
    isInboxStale: () => client.getQueryState(inboxKey)?.isInvalidated,
  };
};

const payload = { title: "T", body: "B", channels: ["in_app"], client_request_id: "r1" } as never;

afterEach(() => mocks.post.mockReset());

describe("useDispatchNotification cache invalidation", () => {
  it("invalidates the sent list and the inbox after a successful dispatch", async () => {
    mocks.post.mockResolvedValue({ data: { data: { dispatched: 3 } } });
    const { result, isListStale, isInboxStale } = setup();
    expect(isListStale()).toBe(false);
    await act(() => result.current.mutateAsync(payload));
    expect(isListStale()).toBe(true);
    expect(isInboxStale()).toBe(true);
  });

  it("invalidates the sent list even when the request fails (504 may still write the history row)", async () => {
    mocks.post.mockRejectedValue(Object.assign(new Error("Gateway Timeout"), { response: { status: 504 } }));
    const { result, isListStale } = setup();
    await act(async () => {
      await result.current.mutateAsync(payload).catch(() => undefined);
    });
    expect(isListStale()).toBe(true);
  });
});
