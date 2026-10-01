import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { vi } from "vitest";
import { useCashBox } from "./index";

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
}));

vi.mock("../../shared/api/api", () => ({ api: apiMock }));

const PAYMENT_MARKET_URL = "finance/cashbox/payment/market";
const PAYMENT_BRANCH_TO_MAIN_URL = "finance/cashbox/payment/branch-to-main";

const createWrapper = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return Wrapper;
};

describe("useCashBox — market payout and branch → HQ (C1 / FE-PAY-03)", () => {
  beforeEach(() => {
    apiMock.get.mockReset();
    apiMock.post.mockReset();
    apiMock.post.mockResolvedValue({ data: { statusCode: 200, data: {} } });
  });

  it("sends the Idempotency-Key header with the market payout", async () => {
    const { result } = renderHook(() => useCashBox(), { wrapper: createWrapper() });
    const data = { market_id: "201", amount: 5_000_000, payment_method: "cash" };

    await act(() => result.current.createPaymentMarket.mutateAsync({ data, idempotencyKey: "market-key-1" }));

    expect(apiMock.post).toHaveBeenCalledWith(PAYMENT_MARKET_URL, data, {
      headers: { "Idempotency-Key": "market-key-1" },
    });
  });

  it("sends the Idempotency-Key header with the branch → HQ remittance", async () => {
    const { result } = renderHook(() => useCashBox(), { wrapper: createWrapper() });
    const data = { branch_id: "16", amount: 300_000, payment_method: "cash" };

    await act(() =>
      result.current.createPaymentBranchToMain.mutateAsync({ data, idempotencyKey: "branch-key-1" }),
    );

    expect(apiMock.post).toHaveBeenCalledWith(PAYMENT_BRANCH_TO_MAIN_URL, data, {
      headers: { "Idempotency-Key": "branch-key-1" },
    });
  });

  it("resolves with the duplicate body so the caller can tell a replay from a new payment", async () => {
    const duplicateBody = {
      statusCode: 200,
      message: "To'lov allaqachon bajarilgan (takroriy so'rov)",
      data: { idempotent: true },
    };
    apiMock.post.mockResolvedValueOnce({ data: duplicateBody });
    const { result } = renderHook(() => useCashBox(), { wrapper: createWrapper() });

    let response: Awaited<ReturnType<typeof result.current.createPaymentMarket.mutateAsync>> | undefined;
    await act(async () => {
      response = await result.current.createPaymentMarket.mutateAsync({
        data: { market_id: "201", amount: 1000, payment_method: "cash" },
        idempotencyKey: "market-key-2",
      });
    });

    expect(response?.data.data?.idempotent).toBe(true);
  });
});

describe("useCashBox — refresh after a payment (FE-PAY-15)", () => {
  it("refetches the GET /managers list (popup branch amounts) after a branch → HQ receipt", async () => {
    let managerFetches = 0;
    apiMock.post.mockResolvedValue({ data: { statusCode: 200, data: {} } });
    const { result } = renderHook(
      () => ({
        managers: useQuery({
          queryKey: ["managers", { limit: 10000 }],
          queryFn: async () => {
            managerFetches += 1;
            return { data: { items: [] } };
          },
        }),
        cashBox: useCashBox(),
      }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.managers.isSuccess).toBe(true));
    expect(managerFetches).toBe(1);

    await act(() =>
      result.current.cashBox.createPaymentBranchToMain.mutateAsync({
        data: { branch_id: "15", amount: 1000, payment_method: "cash" },
        idempotencyKey: "branch-key-2",
      }),
    );

    await waitFor(() => expect(managerFetches).toBe(2));
  });
});
