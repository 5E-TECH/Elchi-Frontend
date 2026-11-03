import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "react-redux";
import { vi } from "vitest";
import { createTestStore } from "../../test/test-utils";
import {
  toRequestOrderReturnResult,
  toReturnRequestsMailResponse,
  useMailDetail,
  useMails,
  useRequestOrderReturn,
} from "./index";

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

const createWrapper = (role = "manager") => {
  const store = createTestStore({
    role: { id: "198", role, region: null, name: "Manager" },
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

describe("useMails — eski pochtalar (server filtrlari, YfrqN70i)", () => {
  const body = { statusCode: 200, data: { data: [], total: 0, page: 1, totalPages: 1, limit: 16 } };
  const params = {
    page: 2,
    limit: 16,
    has_orders: true,
    region_id: "2",
    courier_id: "119",
    status: "received",
    startDate: "2026-10-01",
    endDate: "2026-10-08",
  };
  const sent = {
    page: 2,
    limit: 16,
    region_id: "2",
    courier_id: "119",
    status: "received",
    startDate: "2026-10-01",
    endDate: "2026-10-08",
    has_orders: "true",
  };

  beforeEach(() => {
    apiMock.get.mockReset();
    apiMock.get.mockResolvedValue({ data: body });
  });

  it("admin: GET /post with every filter and has_orders=true", async () => {
    const { result } = renderHook(() => useMails().useGetOldMails(false, params), {
      wrapper: createWrapper("admin"),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiMock.get).toHaveBeenCalledWith("post", { params: sent });
  });

  it("courier: GET post/courier/old-posts with has_orders=true", async () => {
    const { result } = renderHook(
      () => useMails().useGetOldMails(true, { page: 1, limit: 8, has_orders: true, region_id: "2" }),
      { wrapper: createWrapper("courier") },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiMock.get).toHaveBeenCalledWith("post/courier/old-posts", {
      params: { page: 1, limit: 8, region_id: "2", has_orders: "true" },
    });
  });

  it("manager: own branch (branch_id) plus the filters and has_orders=true", async () => {
    const store = createTestStore({
      role: { id: "198", role: "manager", region: null, name: "Manager" },
      user: {
        user: { id: "198", branch: { id: "15" } },
        isAuthenticated: true,
        accessToken: null,
        loading: false,
        isAppInitializing: false,
        error: null,
      } as never,
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <Provider store={store}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </Provider>
    );
    const { result } = renderHook(() => useMails().useGetOldMails(false, params), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [url, config] = apiMock.get.mock.calls.at(-1)!;
    expect(url).toBe("post");
    expect(config.params).toEqual({ ...sent, branch_id: "15" });
  });

  it("returns fetchOldMails (no hook) hitting the same endpoints — used by the Excel export", async () => {
    const { result } = renderHook(() => useMails(), { wrapper: createWrapper("superadmin") });

    await expect(result.current.fetchOldMails(false, { page: 3, limit: 100, has_orders: true })).resolves.toEqual(body);
    expect(apiMock.get).toHaveBeenLastCalledWith("post", { params: { page: 3, limit: 100, has_orders: "true" } });

    await result.current.fetchOldMails(true, { page: 1, limit: 100, status: "canceled" });
    expect(apiMock.get).toHaveBeenLastCalledWith("post/courier/old-posts", {
      params: { page: 1, limit: 100, status: "canceled" },
    });
  });

  it("keepPreviousData keeps the last page visible while the next one loads", async () => {
    let resolveSecond: (value: unknown) => void = () => undefined;
    apiMock.get
      .mockResolvedValueOnce({ data: body })
      .mockReturnValueOnce(new Promise((resolve) => (resolveSecond = resolve)));
    const { result, rerender } = renderHook(
      ({ page }) => useMails().useGetOldMails(false, { page, limit: 8 }, { keepPreviousData: true }),
      { wrapper: createWrapper("admin"), initialProps: { page: 1 } },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    rerender({ page: 2 });
    expect(result.current.isPlaceholderData).toBe(true);
    expect(result.current.data).toEqual(body);
    resolveSecond({ data: { ...body, data: { ...body.data, page: 2 } } });
    await waitFor(() => expect(result.current.isPlaceholderData).toBe(false));
  });
});

describe("useMails — «Bugungi» (menejer: barcha ochiq pochtalar)", () => {
  beforeEach(() => {
    apiMock.get.mockReset();
    apiMock.get.mockResolvedValue({ data: { statusCode: 200, data: { data: [], total: 0 } } });
  });

  it("manager: GET post?status=sent for the own branch with limit 100 (not the default 8), key unchanged", async () => {
    const store = createTestStore({
      role: { id: "198", role: "manager", region: null, name: "Manager" },
      user: {
        user: { id: "198", branch: { id: "15", type: "REGIONAL" } },
        isAuthenticated: true,
        accessToken: null,
        loading: false,
        isAppInitializing: false,
        error: null,
      } as never,
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <Provider store={store}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </Provider>
    );
    const { result } = renderHook(() => useMails().useGetNewMails(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiMock.get).toHaveBeenCalledTimes(1);
    expect(apiMock.get).toHaveBeenCalledWith("post", {
      params: { page: 1, limit: 100, status: "sent", branch_id: "15" },
    });
    expect(client.getQueryCache().getAll().map((query) => query.queryKey)).toEqual([["mails", "new", "manager", "15"]]);
  });

  it("other roles keep GET post/new", async () => {
    const { result } = renderHook(() => useMails().useGetNewMails(), { wrapper: createWrapper("admin") });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiMock.get).toHaveBeenCalledWith("post/new");
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

  it("flattens a courier group into one row per order and copies the courier onto each (YEI06cPN)", () => {
    const rows = toReturnRequestsMailResponse({
      data: {
        total: 2,
        groups: [
          { courier: { id: "9", name: "Baxodir" }, courier_id: "9", orders: [{ id: "1" }, { id: "2" }] },
        ],
      },
    }).data.data;

    expect(rows).toHaveLength(2);
    rows.forEach((row) => expect(row.courier?.name).toBe("Baxodir"));
  });

  it("maps an empty backend answer { total: 0, groups: [] } to an empty list, not an error", () => {
    expect(toReturnRequestsMailResponse({ data: { total: 0, groups: [] } }).data).toMatchObject({
      data: [],
      total: 0,
    });
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

describe("useMailDetail — ko'rinish (backend #618)", () => {
  const DETAIL_URL = "post/orders/78";
  const renderDetail = (view?: "current" | "all") => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const hook = renderHook(() => useMailDetail("78", view ? { view } : undefined), { wrapper: Wrapper });
    return { client, ...hook };
  };

  beforeEach(() => {
    apiMock.get.mockReset();
    apiMock.get.mockResolvedValue({ data: { statusCode: 200, message: "ok", data: { allOrdersByPostId: [] } } });
  });

  it("view berilmasa — parametrsiz (server sukuti), kesh kaliti [mails, detail, id]", async () => {
    const { client, result } = renderDetail();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiMock.get).toHaveBeenCalledTimes(1);
    expect(apiMock.get).toHaveBeenCalledWith(DETAIL_URL);
    expect(client.getQueryCache().getAll().map((query) => query.queryKey)).toEqual([["mails", "detail", "78"]]);
  });

  it("view=current — so'rovda va kesh kalitining oxirida", async () => {
    const { client, result } = renderDetail("current");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiMock.get).toHaveBeenCalledWith(DETAIL_URL, { params: { view: "current" } });
    expect(client.getQueryCache().getAll().map((query) => query.queryKey)).toEqual([
      ["mails", "detail", "78", "current"],
    ]);
  });

  it("qabul / jo'natishdan keyingi invalidatsiya (prefiks [mails, detail, id]) view'li kalitni ham yangilaydi", async () => {
    const { client, result } = renderDetail("current");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    await act(() => client.invalidateQueries({ queryKey: ["mails", "detail", "78"] }));
    await waitFor(() => expect(apiMock.get).toHaveBeenCalledTimes(2));
  });
});

/**
 * Kuryer: «Bu buyurtma kelmagan» — `POST post/:postId/orders/:orderId/return-request` (tanasiz). Javob `data`:
 * `{ order_id, post_id, return_requested, already_requested, remaining_receivable }`.
 */
describe("useRequestOrderReturn — kuryer qaytarish so'rovi", () => {
  const renderRequest = () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const hook = renderHook(() => useRequestOrderReturn(), { wrapper: Wrapper });
    return { invalidate, ...hook };
  };
  const invalidatedKeys = (invalidate: ReturnType<typeof renderRequest>["invalidate"]) =>
    invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);

  beforeEach(() => {
    apiMock.post.mockReset();
  });

  it("tanasiz POST shu pochta va buyurtma yo'liga; javob bir shaklga keladi; pochta, «Bugungi», «Qaytarish», buyurtmalar yangilanadi", async () => {
    apiMock.post.mockResolvedValue({
      data: {
        statusCode: 200,
        message: "Qaytarish so'rovi yuborildi",
        data: { order_id: 101, post_id: "7", return_requested: true, already_requested: false, remaining_receivable: 2 },
      },
    });
    const { result, invalidate } = renderRequest();

    let outcome: Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined;
    await act(async () => {
      outcome = await result.current.mutateAsync({ postId: "7", orderId: "101" });
    });

    expect(apiMock.post).toHaveBeenCalledTimes(1);
    expect(apiMock.post.mock.calls[0]).toEqual(["post/7/orders/101/return-request"]);
    expect(outcome).toEqual({
      orderId: "101",
      postId: "7",
      returnRequested: true,
      alreadyRequested: false,
      remainingReceivable: 2,
    });
    expect(invalidatedKeys(invalidate)).toEqual([["mails", "detail", "7"], ["mails", "new"], ["mails", "return"], ["orders"]]);
  });

  it("xato (409) bo'lsa ham pochta qatorlari yangilanadi", async () => {
    apiMock.post.mockRejectedValue({ response: { status: 409, data: { message: "Buyurtma holati o'zgardi" } } });
    const { result, invalidate } = renderRequest();

    await act(async () => {
      await result.current.mutateAsync({ postId: "7", orderId: "101" }).catch(() => undefined);
    });

    expect(invalidatedKeys(invalidate)).toContainEqual(["mails", "detail", "7"]);
  });

  it("toRequestOrderReturnResult: `already_requested`, son yo'q — `null`, id'lar so'rovdan", () => {
    expect(
      toRequestOrderReturnResult({ data: { return_requested: true, already_requested: true } }, { postId: "7", orderId: "101" }),
    ).toEqual({ orderId: "101", postId: "7", returnRequested: true, alreadyRequested: true, remainingReceivable: null });
    expect(
      toRequestOrderReturnResult({ order_id: "102", post_id: "8", remaining_receivable: "0" }, { postId: "7", orderId: "101" }),
    ).toMatchObject({ orderId: "102", postId: "8", remainingReceivable: 0 });
  });
});
