import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useOrders } from "./index";
import { resetRollbackKeys } from "./rollbackIdempotency";

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

/**
 * y2RarzlT — ortga qaytarish: maqsad holat body'da; kassa / moliya / dashboard keshlari yangilanadi.
 * BE #738 — `Idempotency-Key` (buyurtma + maqsad uchun bitta, qayta urinishda o'sha; muvaffaqiyat / 422 dan keyin
 * yangi) va ≥ 60 s kutish; xatoda ham buyurtmalar keshi eskiradi (`rollback` maydoni yangilanadi).
 */
describe("useOrders — RollbackOrder", () => {
  const setup = () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useOrders(), { wrapper });
    const invalidatedKeys = () =>
      invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey[0]);
    return { result, invalidate, invalidatedKeys };
  };
  const keyOf = (call: unknown[]) => (call[2] as { headers: Record<string, string> }).headers["Idempotency-Key"];
  const httpError = (status: number, data: Record<string, unknown>) =>
    Object.assign(new Error(`HTTP ${status}`), { isAxiosError: true, response: { status, data } });

  beforeEach(() => {
    resetRollbackKeys();
    apiMock.post.mockReset();
  });

  it("POST orders/rollback/:id { target_status } + Idempotency-Key, 60 s dan uzun kutish; muvaffaqiyatda pul keshlari eskiradi", async () => {
    apiMock.post.mockResolvedValue({ data: { statusCode: 200 } });
    const { result, invalidatedKeys } = setup();

    await act(() => result.current.RollbackOrder.mutateAsync({ orderId: "95", targetStatus: "cancelled" }));

    const [url, body, config] = apiMock.post.mock.calls[0];
    expect([url, body]).toEqual(["orders/rollback/95", { target_status: "cancelled" }]);
    expect(keyOf(apiMock.post.mock.calls[0])).toEqual(expect.any(String));
    expect(keyOf(apiMock.post.mock.calls[0]).length).toBeGreaterThan(8);
    expect((config as { timeout: number }).timeout).toBeGreaterThanOrEqual(60_000);
    const keys = invalidatedKeys();
    expect(keys).toEqual(expect.arrayContaining(["orders", "finance-cov", "cashbox", "dashboard"]));
    expect(keys.length).toBeGreaterThanOrEqual(4);
  });

  it("⭐ qayta urinish (503, 409, STATE_CHANGED, javob kelmadi) — AYNI kalit; muvaffaqiyatdan keyin — yangi kalit", async () => {
    const { result } = setup();
    const errors = [
      httpError(503, { statusCode: 503, message: "Kassa ma'lumotini o'qib bo'lmadi" }),
      httpError(409, { statusCode: 409, code: "IDEMPOTENCY_IN_PROGRESS", message: "Takroriy so'rov hali bajarilmoqda" }),
      httpError(400, { statusCode: 400, code: "STATE_CHANGED", message: "Rollback holati o'zgargan — qayta urinib ko'ring" }),
      Object.assign(new Error("timeout of 120000ms exceeded"), { isAxiosError: true, code: "ECONNABORTED" }),
    ];
    for (const error of errors) {
      apiMock.post.mockRejectedValueOnce(error);
      await act(() =>
        result.current.RollbackOrder.mutateAsync({ orderId: "95", targetStatus: "waiting" }).catch(() => undefined),
      );
    }
    apiMock.post.mockResolvedValueOnce({ data: { statusCode: 200 } });
    await act(() => result.current.RollbackOrder.mutateAsync({ orderId: "95", targetStatus: "waiting" }));
    apiMock.post.mockResolvedValueOnce({ data: { statusCode: 200 } });
    await act(() => result.current.RollbackOrder.mutateAsync({ orderId: "95", targetStatus: "waiting" }));

    const sent = apiMock.post.mock.calls.map(keyOf);
    expect(sent).toHaveLength(6);
    expect(new Set(sent.slice(0, 5)).size).toBe(1);
    expect(sent[5]).not.toBe(sent[0]);
  });

  it("422 (kalit boshqa tanaga bog'langan) — kalit tashlanadi; maqsad holat boshqa — boshqa kalit", async () => {
    const { result } = setup();
    apiMock.post.mockRejectedValueOnce(httpError(422, { statusCode: 422, code: "IDEMPOTENCY_KEY_MISMATCH" }));
    await act(() =>
      result.current.RollbackOrder.mutateAsync({ orderId: "95", targetStatus: "waiting" }).catch(() => undefined),
    );
    apiMock.post.mockResolvedValue({ data: { statusCode: 200 } });
    await act(() => result.current.RollbackOrder.mutateAsync({ orderId: "95", targetStatus: "waiting" }));
    await act(() => result.current.RollbackOrder.mutateAsync({ orderId: "95", targetStatus: "cancelled" }));
    const [first, second, third] = apiMock.post.mock.calls.map(keyOf);
    expect(second).not.toBe(first);
    expect(third).not.toBe(second);
  });

  it("rad etilsa (SUPERADMIN_ONLY) ham buyurtmalar keshi eskiradi, pul keshlari tegilmaydi", async () => {
    const { result, invalidatedKeys } = setup();
    apiMock.post.mockRejectedValueOnce(
      httpError(400, { statusCode: 400, code: "SUPERADMIN_ONLY", message: "Faqat superadmin qaytara oladi" }),
    );
    await act(() =>
      result.current.RollbackOrder.mutateAsync({ orderId: "95", targetStatus: "waiting" }).catch(() => undefined),
    );
    expect(invalidatedKeys()).toEqual(["orders"]);
  });
});
