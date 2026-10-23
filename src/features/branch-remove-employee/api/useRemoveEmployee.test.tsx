import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "../../../shared/config/queryKeys";
import { useRemoveEmployee } from "./useRemoveEmployee";

/** cI5gqN90: xodim olib tashlangach filiallar ro'yxatidagi XODIMLAR soni ham eskiradi. Tarmoqqa chiqilmaydi. */

const api = vi.hoisted(() => ({ delete: vi.fn() }));
vi.mock("../../../shared/api/instance", () => ({ api }));

const LIST = queryKeys.branches.list({ page: 1, limit: 12 });
const OTHER = ["users", "list", {}] as const;

const setup = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  for (const key of [LIST, queryKeys.branches.detail("15"), queryKeys.branches.employees("15"), OTHER]) {
    queryClient.setQueryData(key, { seeded: true });
  }
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useRemoveEmployee("15"), { wrapper });
  const stale = (key: readonly unknown[]) => queryClient.getQueryState(key)?.isInvalidated;
  return { result, stale };
};

describe("useRemoveEmployee — kesh (cI5gqN90)", () => {
  beforeEach(() => {
    api.delete.mockReset().mockResolvedValue({ data: { statusCode: 200 } });
  });

  it("⭐ muvaffaqiyatda ro'yxat, tafsilot va xodimlar eskiradi; boshqa keshlar tegilmaydi", async () => {
    const { result, stale } = setup();
    await act(() => result.current.mutateAsync("210"));

    expect(api.delete).toHaveBeenCalledWith("branches/15/users/210");
    expect(stale(LIST)).toBe(true);
    expect(stale(queryKeys.branches.detail("15"))).toBe(true);
    expect(stale(queryKeys.branches.employees("15"))).toBe(true);
    expect(stale(OTHER)).toBe(false);
  });

  it("xatoda kesh tegilmaydi", async () => {
    api.delete.mockRejectedValueOnce({ isAxiosError: true, response: { status: 400 } });
    const { result, stale } = setup();
    await act(() => result.current.mutateAsync("210").catch(() => {}));

    expect(stale(LIST)).toBe(false);
  });
});
