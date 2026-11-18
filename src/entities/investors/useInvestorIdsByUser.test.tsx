import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("../../shared/api/api", () => ({
  api: { get: mocks.get, post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { useInvestorIdsByUser } from "./index";

/**
 * LIuf0DcD: «Foydalanuvchilar → Investorlar» dagi «Kabinetni ko'rish» — login id → investor yozuvi id
 * (`GET /investors`, sahifasi 100 tadan). Login'siz yozuv (`user_id` bo'sh / `0`) xaritaga kirmaydi.
 */
const page = (items: Array<{ id: string; user_id: string | null }>, totalPages: number) => ({
  data: { statusCode: 200, data: { items, meta: { totalPages } } },
});

const wrapper = (client: QueryClient) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };

const newClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe("useInvestorIdsByUser (LIuf0DcD)", () => {
  beforeEach(() => {
    mocks.get.mockReset();
  });

  it("barcha sahifalarni o'qiydi; login'siz yozuvlar kirmaydi", async () => {
    const first = Array.from({ length: 100 }, (_, index) => ({ id: `i${index}`, user_id: index === 0 ? "0" : `u${index}` }));
    mocks.get
      .mockResolvedValueOnce(page(first, 2))
      .mockResolvedValueOnce(page([{ id: "i200", user_id: "u200" }, { id: "i201", user_id: null }], 2));

    const { result } = renderHook(() => useInvestorIdsByUser(true), { wrapper: wrapper(newClient()) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.get).toHaveBeenCalledTimes(2);
    expect(mocks.get).toHaveBeenNthCalledWith(1, "investors", { params: { page: 1, limit: 100 } });
    expect(mocks.get).toHaveBeenNthCalledWith(2, "investors", { params: { page: 2, limit: 100 } });
    const map = result.current.data!;
    expect(map.get("u1")).toBe("i1");
    expect(map.get("u200")).toBe("i200");
    expect(map.has("0")).toBe(false);
    expect(map.size).toBe(100);
  });

  it("`enabled: false` — so'rov ketmaydi", () => {
    renderHook(() => useInvestorIdsByUser(false), { wrapper: wrapper(newClient()) });
    expect(mocks.get).not.toHaveBeenCalled();
  });
});
