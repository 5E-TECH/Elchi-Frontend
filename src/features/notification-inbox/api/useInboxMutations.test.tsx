import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({ patch: vi.fn() }));
vi.mock("../../../shared/api/instance", () => ({ api: { patch: mocks.patch } }));

import { useMarkInboxRead } from "./useInboxMutations";
import { queryKeys } from "../../../shared/config/queryKeys";
import type { InboxListResult } from "../../../entities/notification-inbox";

const listKey = queryKeys.notificationsInbox.list({ page: 1, limit: 20 });
const countKey = queryKeys.notificationsInbox.unreadCount;

const seededList = (): InboxListResult => ({
  items: [
    {
      id: "1",
      type: "order.sold",
      category: "order",
      priority: "normal",
      title: "Sold",
      body: null,
      data: null,
      link: null,
      is_read: false,
      read_at: null,
      created_at: "2026-08-12T00:00:00Z",
    },
  ],
  unread: 3,
  page: 1,
  limit: 20,
  total: 1,
  totalPages: 1,
});

const makeClient = () => {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  qc.setQueryData(listKey, seededList());
  qc.setQueryData(countKey, 3);
  return qc;
};

const wrapperFor = (qc: QueryClient) => {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
};

describe("useMarkInboxRead — optimistic update + rollback", () => {
  beforeEach(() => {
    mocks.patch.mockReset();
  });

  it("optimistically marks the item read and decrements the unread counters", async () => {
    const qc = makeClient();
    let resolvePatch!: () => void;
    mocks.patch.mockReturnValue(new Promise<void>((resolve) => (resolvePatch = resolve)));

    const { result } = renderHook(() => useMarkInboxRead(), { wrapper: wrapperFor(qc) });
    act(() => {
      result.current.mutate({ id: "1", read: true });
    });

    await waitFor(() => {
      const list = qc.getQueryData<InboxListResult>(listKey);
      expect(list?.items[0].is_read).toBe(true);
      expect(list?.unread).toBe(2);
      expect(qc.getQueryData<number>(countKey)).toBe(2);
    });

    resolvePatch();
  });

  it("rolls back the cache when the request fails", async () => {
    const qc = makeClient();
    mocks.patch.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useMarkInboxRead(), { wrapper: wrapperFor(qc) });
    act(() => {
      result.current.mutate({ id: "1", read: true });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    const list = qc.getQueryData<InboxListResult>(listKey);
    expect(list?.items[0].is_read).toBe(false);
    expect(list?.unread).toBe(3);
    expect(qc.getQueryData<number>(countKey)).toBe(3);
  });
});
