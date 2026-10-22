import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFinanceCoverage } from "./financeCoverage";
import { cashbox, useCashBox } from "./index";

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("../../shared/api/api", () => ({ api: { get: mocks.get, post: mocks.post } }));

const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe("useGetFinancialBalanceTopImpacts — server sahifalashi (vmLTsAok)", () => {
  beforeEach(() => {
    mocks.get.mockReset();
  });

  it("keyingi sahifa yuklanguncha oldingisi (jami bilan) ko'rinadi; davr o'zgarsa — eski davr ko'rsatilmaydi", async () => {
    let resolveNext: (value: unknown) => void = () => {};
    mocks.get
      .mockResolvedValueOnce({ data: { data: { items: [{ id: "1" }], pagination: { total: 186, page: 1, totalPages: 19 } } } })
      .mockImplementationOnce(() => new Promise((resolve) => (resolveNext = resolve)))
      .mockImplementation(() => new Promise(() => {}));
    const queryClient = client();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result, rerender } = renderHook(
      ({ params }) => useFinanceCoverage().useGetFinancialBalanceTopImpacts(true, params),
      { wrapper, initialProps: { params: { fromDate: "2026-10-01", toDate: "2026-10-17", page: 1, limit: 10 } } },
    );
    await waitFor(() => expect(result.current.data?.data.pagination.total).toBe(186));

    // Sahifa 2 — javob hali kelmagan: oldingi ma'lumot (186 ta jami) qoladi.
    rerender({ params: { fromDate: "2026-10-01", toDate: "2026-10-17", page: 2, limit: 10 } });
    expect(result.current.isPlaceholderData).toBe(true);
    expect(result.current.data?.data.pagination.total).toBe(186);
    resolveNext({ data: { data: { items: [{ id: "11" }], pagination: { total: 186, page: 2, totalPages: 19 } } } });
    await waitFor(() => expect(result.current.data?.data.pagination.page).toBe(2));

    // Davr o'zgardi — eski davr qatorlari ko'rsatilmaydi.
    rerender({ params: { fromDate: "2026-09-01", toDate: "2026-09-30", page: 1, limit: 10 } });
    expect(result.current.isPlaceholderData).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

/**
 * XAtqsRNH: pul harakati qiladigan coverage mutatsiyalari kassa keshini ham eskirtiradi — umumiy
 * `refreshCashboxQueries` orqali (`[cashbox]`, `finance-cov`, tarix, bosh sahifa …). HAQIQIY `QueryClient`.
 */
describe("financeCoverage pul mutatsiyalari → [cashbox] (aac031, 26eb9d)", () => {
  const seeded = () => {
    const queryClient = client();
    queryClient.setQueryData([cashbox, "financial-balance"], { data: { main: { balance: 1 } } });
    queryClient.setQueryData([cashbox, "main"], { data: { balance: 1 } });
    queryClient.setQueryData(["finance-cov", "operator-balance", "77"], { data: { remaining: 1 } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    return { queryClient, wrapper };
  };

  beforeEach(() => {
    mocks.get.mockReset().mockResolvedValue({ data: { data: {} } });
    mocks.post.mockReset().mockResolvedValue({ data: { statusCode: 201, data: { id: "9" } } });
  });

  it("createOperatorPayment: POST finance/operator-payments + Idempotency-Key, keyin [cashbox] va finance-cov eskiradi", async () => {
    const { queryClient, wrapper } = seeded();
    const { result } = renderHook(() => useFinanceCoverage(), { wrapper });
    await act(async () => {
      await result.current.createOperatorPayment.mutateAsync({
        payload: { operator_id: "77", amount: 50000, note: "Oktabr" },
        idempotencyKey: "key-1",
      });
    });
    expect(mocks.post).toHaveBeenCalledWith(
      "finance/operator-payments",
      { operator_id: "77", amount: 50000, note: "Oktabr" },
      { headers: { "Idempotency-Key": "key-1" } },
    );
    expect(queryClient.getQueryState([cashbox, "financial-balance"])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState([cashbox, "main"])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(["finance-cov", "operator-balance", "77"])?.isInvalidated).toBe(true);
  });

  it("createFinancialBalanceEntry: [cashbox] (balans kartalari) va finance-cov eskiradi", async () => {
    const { queryClient, wrapper } = seeded();
    const { result } = renderHook(() => useFinanceCoverage(), { wrapper });
    await act(async () => {
      await result.current.createFinancialBalanceEntry.mutateAsync({
        data: { amount: -1000, source_type: "manual_expense" },
        idempotencyKey: "key-2",
      });
    });
    expect(queryClient.getQueryState([cashbox, "financial-balance"])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState([cashbox, "main"])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(["finance-cov", "operator-balance", "77"])?.isInvalidated).toBe(true);
  });

  it("/financial-balance: yozuv saqlangach ochiq balans kartalari so'rovi (GET finance/cashbox/financial-balanse) darhol qayta yuboriladi", async () => {
    const queryClient = client();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    mocks.get.mockResolvedValue({ data: { data: { main: { balance: 1545000 } } } });
    const { result } = renderHook(
      () => ({ balance: useCashBox().useGetFinancialBalance(), coverage: useFinanceCoverage() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.balance.data).toEqual({ data: { main: { balance: 1545000 } } }));
    const balanceGets = () => mocks.get.mock.calls.filter(([url]) => url === "finance/cashbox/financial-balanse").length;
    expect(balanceGets()).toBe(1);

    mocks.get.mockResolvedValue({ data: { data: { main: { balance: 1544000 } } } });
    await act(async () => {
      await result.current.coverage.createFinancialBalanceEntry.mutateAsync({
        data: { amount: -1000, source_type: "manual_expense" },
        idempotencyKey: "key-3",
      });
    });

    expect(balanceGets()).toBe(2);
    await waitFor(() => expect(result.current.balance.data).toEqual({ data: { main: { balance: 1544000 } } }));
  });
});
