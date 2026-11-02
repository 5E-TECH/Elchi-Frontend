import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";
import { useCashBox } from "./index";

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
}));

vi.mock("../../shared/api/api", () => ({ api: apiMock }));

const HQ_COURIERS_URL = "finance/cashbox/hq-couriers";
const PAYMENT_COURIER_URL = "finance/cashbox/payment/courier";
const PAYMENTS_META_URL = "finance/cashbox/payments-meta";

const createWrapper = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return Wrapper;
};

const hqCourierGets = () =>
  apiMock.get.mock.calls.filter(([url]) => url === HQ_COURIERS_URL).length;

describe("useCashBox — courier payment and HQ couriers", () => {
  beforeEach(() => {
    apiMock.get.mockResolvedValue({
      data: { statusCode: 200, data: { items: [], total: 0, hq_branch_id: "1" } },
    });
    apiMock.post.mockResolvedValue({ data: { statusCode: 201, data: {} } });
  });

  it("sends the Idempotency-Key header with the courier payment", async () => {
    const { result } = renderHook(() => useCashBox(), { wrapper: createWrapper() });
    const data = { courier_id: "263", amount: 250000, payment_method: "cash" };

    await act(() =>
      result.current.createPaymentCourier.mutateAsync({ data, idempotencyKey: "key-263-1" }),
    );

    expect(apiMock.post).toHaveBeenCalledWith(PAYMENT_COURIER_URL, data, {
      headers: { "Idempotency-Key": "key-263-1" },
    });
  });

  it("resolves with the backend body so a duplicate (idempotent) payment is visible to the caller", async () => {
    // finance-service: shu Idempotency-Key bilan pul avval o'tgan (takroriy so'rov).
    const duplicateBody = {
      statusCode: 200,
      message: "To'lov allaqachon qabul qilingan (takroriy so'rov)",
      data: { idempotent: true },
    };
    apiMock.post.mockResolvedValueOnce({ data: duplicateBody });
    const { result } = renderHook(() => useCashBox(), { wrapper: createWrapper() });

    let response: Awaited<ReturnType<typeof result.current.createPaymentCourier.mutateAsync>> | undefined;
    await act(async () => {
      response = await result.current.createPaymentCourier.mutateAsync({
        data: { courier_id: "263", amount: 1000, payment_method: "cash" },
        idempotencyKey: "key-263-3",
      });
    });

    expect(response?.data).toEqual(duplicateBody);
    expect(response?.data.data?.idempotent).toBe(true);
  });

  it("loads GET finance/cashbox/hq-couriers only when enabled", async () => {
    renderHook(() => useCashBox().useGetHqCourierReceivables(false), { wrapper: createWrapper() });
    expect(hqCourierGets()).toBe(0);

    const { result } = renderHook(() => useCashBox().useGetHqCourierReceivables(true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiMock.get).toHaveBeenCalledWith(HQ_COURIERS_URL);
  });

  it("useGetPaymentsMeta: top 3, disabled → no request, refetched after a payment, silent on error", async () => {
    const paymentsMetaGets = () => apiMock.get.mock.calls.filter(([url]) => url === PAYMENTS_META_URL);
    const disabled = renderHook(() => useCashBox().useGetPaymentsMeta(false), { wrapper: createWrapper() });
    expect(disabled.result.current.fetchStatus).toBe("idle");
    expect(paymentsMetaGets()).toEqual([]);

    const { result } = renderHook(
      () => {
        const cashBox = useCashBox();
        return { meta: cashBox.useGetPaymentsMeta(true), pay: cashBox.createPaymentCourier };
      },
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.meta.isSuccess).toBe(true));
    expect(paymentsMetaGets()).toEqual([[PAYMENTS_META_URL, { params: { top: 3 } }]]);

    await act(() =>
      result.current.pay.mutateAsync({ data: { courier_id: "263", amount: 1000 }, idempotencyKey: "key-263-3" }),
    );
    await waitFor(() => expect(paymentsMetaGets()).toHaveLength(2));

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    apiMock.get.mockRejectedValueOnce(new Error("403"));
    const failing = renderHook(() => useCashBox().useGetPaymentsMeta(true), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
    await waitFor(() => expect(failing.result.current.isError).toBe(true));
    expect(client.getQueryCache().getAll()[0]?.meta).toEqual({ silentError: true });
  });

  it("refetches the HQ courier list after a courier payment (query key under the cashbox prefix)", async () => {
    const { result } = renderHook(
      () => {
        const cashBox = useCashBox();
        return {
          list: cashBox.useGetHqCourierReceivables(true),
          pay: cashBox.createPaymentCourier,
        };
      },
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    expect(hqCourierGets()).toBe(1);

    await act(() =>
      result.current.pay.mutateAsync({
        data: { courier_id: "263", amount: 1000 },
        idempotencyKey: "key-263-2",
      }),
    );

    await waitFor(() => expect(hqCourierGets()).toBe(2));
  });
});
