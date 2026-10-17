import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useOrders } from "./index";

/**
 * j9KFyqlS — sotish/bekor qilish so'roviga qo'shimcha sarlavha (ommaviy yopish
 * `X-Request-Source: courier-bulk`, backend audit). Sarlavhasiz chaqiruv avvalgidek
 * `api.post(url, body)` — boshqa chaqiruvchilar o'zgarmaydi.
 */

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock("../../shared/api/api", () => ({ api: apiMock, LONG_REQUEST_TIMEOUT_MS: 120000 }));

const createWrapper = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return Wrapper;
};

const BULK_HEADERS = { "X-Request-Source": "courier-bulk" };

describe("useOrders — sotish/bekor qilish sarlavhalari (j9KFyqlS)", () => {
  beforeEach(() => {
    apiMock.post.mockReset();
    apiMock.post.mockImplementation(async (url: string) =>
      url === "files/upload" ? { data: { data: { key: "proof/abc.jpg" } } } : { data: { statusCode: 200 } },
    );
  });

  it("SellOrder: sarlavha berilsa — so'rovda; isbot avval yuklanadi (sarlavhasiz), so'ng proofFileKeys", async () => {
    const { result } = renderHook(() => useOrders(), { wrapper: createWrapper() });
    const proof = new File(["x"], "isbot.jpg", { type: "image/jpeg" });

    await act(() =>
      result.current.SellOrder.mutateAsync({
        orderId: "10",
        data: { comment: "izoh", extraCost: 0, proof },
        headers: BULK_HEADERS,
      }),
    );

    expect(apiMock.post).toHaveBeenCalledTimes(2);
    const [uploadUrl, , uploadConfig] = apiMock.post.mock.calls[0];
    expect(uploadUrl).toBe("files/upload");
    expect(uploadConfig).not.toHaveProperty("headers");
    expect(apiMock.post.mock.calls[1]).toEqual([
      "orders/sell/10",
      { comment: "izoh", extraCost: 0, proofFileKeys: ["proof/abc.jpg"] },
      { headers: BULK_HEADERS },
    ]);
  });

  it("CancelOrder: sarlavha so'rovda", async () => {
    const { result } = renderHook(() => useOrders(), { wrapper: createWrapper() });

    await act(() =>
      result.current.CancelOrder.mutateAsync({
        orderId: "11",
        data: { comment: "izoh", extraCost: 0 },
        headers: BULK_HEADERS,
      }),
    );

    expect(apiMock.post.mock.calls[0]).toEqual([
      "orders/cancel/11",
      { comment: "izoh", extraCost: 0 },
      { headers: BULK_HEADERS },
    ]);
  });

  it("sarlavhasiz chaqiruv o'zgarmagan: api.post(url, body)", async () => {
    const { result } = renderHook(() => useOrders(), { wrapper: createWrapper() });

    await act(() => result.current.SellOrder.mutateAsync({ orderId: "12", data: { comment: "", extraCost: 0 } }));
    await act(() =>
      result.current.CancelOrder.mutateAsync({ orderId: "13", data: { reason: "OTHER", comment: "x", extraCost: 0 } }),
    );

    expect(apiMock.post.mock.calls[0]).toEqual(["orders/sell/12", { comment: "", extraCost: 0 }]);
    expect(apiMock.post.mock.calls[1]).toEqual(["orders/cancel/13", { reason: "OTHER", comment: "x", extraCost: 0 }]);
  });
});
