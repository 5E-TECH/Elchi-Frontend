import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "react-redux";
import { vi } from "vitest";
import { createTestStore } from "../../test/test-utils";
import { toReturnRequestsMailResponse, useMails } from "./index";

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
}));

vi.mock("../../shared/api/api", () => ({ api: apiMock }));

const LIST_URL = "post/return-requests/list";
const APPROVE_URL = "post/return-requests/approve";
const REJECT_URL = "post/return-requests/reject";

// Item 8 — backend javobi: kuryer bo'yicha guruhlar, gateway boyitgan qatorlar.
const branchScopeBody = {
  statusCode: 200,
  message: "Qaytarish so'rovlari",
  data: {
    total: 1,
    scope: { type: "BRANCH", branch_id: "15" },
    groups: [
      {
        courier: { id: "209", name: "Ali", phone_number: "+998903009003" },
        courier_id: "209",
        orders: [
          {
            id: "101",
            post_id: "55",
            total_price: 120000,
            status: "on the road",
            customer: { id: "5", name: "Vali", phone_number: "+998901112233" },
            district: { id: "3", name: "Chilonzor", region: { id: "1", name: "Toshkent" } },
          },
        ],
      },
    ],
  },
};

const createWrapper = () => {
  const store = createTestStore({
    role: { id: "198", role: "manager", region: null, name: "Manager" },
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </Provider>
  );
  return Wrapper;
};

const listGets = () => apiMock.get.mock.calls.filter(([url]) => url === LIST_URL).length;

describe("useMails — Pochta → Qaytarish", () => {
  beforeEach(() => {
    apiMock.get.mockResolvedValue({ data: branchScopeBody });
    apiMock.post.mockResolvedValue({ data: { statusCode: 200, data: { approved: 1 } } });
  });

  it("maps courier groups into one row per order", async () => {
    const { result } = renderHook(() => useMails().useGetReturnMails(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const rows = result.current.data?.data.data ?? [];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "101",
      order_id: "101",
      request_id: "101",
      post_id: "55",
      post_total_price: 120000,
      order_quantity: 1,
      action: "branch",
      status: "on the road",
      courier_id: "209",
    });
    expect(rows[0].courier?.name).toBe("Ali");
    expect(rows[0].customer?.name).toBe("Vali");
    expect(rows[0].customer?.phone_number).toBe("+998901112233");
    expect(rows[0].district?.name).toBe("Chilonzor");
    expect(rows[0].region.name).toBe("Toshkent");
    expect(result.current.data?.data.total).toBe(1);
  });

  it("requests the list without page/limit params", async () => {
    const { result } = renderHook(() => useMails().useGetReturnMails(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiMock.get).toHaveBeenCalledWith(LIST_URL);
    expect(apiMock.get.mock.calls.find(([url]) => url === LIST_URL)).toHaveLength(1);
  });

  it("posts exactly { order_ids } to approve and reject", async () => {
    const { result } = renderHook(() => useMails(), { wrapper: createWrapper() });

    await act(() => result.current.approveReturnRequests.mutateAsync({ order_ids: ["101"] }));
    await act(() => result.current.rejectReturnRequests.mutateAsync({ order_ids: ["102", "103"] }));

    expect(apiMock.post).toHaveBeenCalledWith(APPROVE_URL, { order_ids: ["101"] });
    expect(apiMock.post).toHaveBeenCalledWith(REJECT_URL, { order_ids: ["102", "103"] });
    apiMock.post.mock.calls.forEach(([, body]) => {
      expect(Object.keys(body as object)).toEqual(["order_ids"]);
    });
  });

  it("refreshes the list even when approve fails (backend writes orders one by one)", async () => {
    const { result } = renderHook(
      () => {
        const mails = useMails();
        return { list: mails.useGetReturnMails(), approve: mails.approveReturnRequests };
      },
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    expect(listGets()).toBe(1);

    apiMock.post.mockRejectedValueOnce({
      response: { status: 502, data: { statusCode: 502, message: "Order #102 update failed" } },
    });
    await act(async () => {
      await result.current.approve.mutateAsync({ order_ids: ["101", "102"] }).catch(() => undefined);
    });

    await waitFor(() => expect(listGets()).toBe(2));
  });
});

describe("toReturnRequestsMailResponse", () => {
  it("shows HQ scope (or the old backend without scope) as 'center'", () => {
    const oldShape = {
      statusCode: 200,
      data: {
        total: 1,
        groups: [{ courier: null, courier_id: null, orders: [{ id: "7", total_price: 5000, status: "waiting" }] }],
      },
    };
    const hqShape = {
      ...oldShape,
      data: { ...oldShape.data, scope: { type: "HQ", branch_id: "1" } },
    };

    expect(toReturnRequestsMailResponse(oldShape).data.data[0]).toMatchObject({
      id: "7",
      action: "center",
      courier: null,
      post_total_price: 5000,
    });
    expect(toReturnRequestsMailResponse(hqShape).data.data[0].action).toBe("center");
  });

  it("returns an empty list for an unexpected payload", () => {
    expect(toReturnRequestsMailResponse(null).data).toEqual({
      data: [],
      total: 0,
      page: 1,
      totalPages: 1,
      limit: 0,
    });
    expect(toReturnRequestsMailResponse({ data: { data: [{ id: "1" }] } }).data.data).toEqual([]);
  });
});
