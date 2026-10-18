import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFinanceCoverage } from "./financeCoverage";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../../shared/api/api", () => ({ api: { get: mocks.get } }));

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
