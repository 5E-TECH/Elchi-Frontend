import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSelectableMarketOperators, normalizeSelectableMarketOperators } from "./marketOperatorApi";
import { marketOperatorKeys, useSelectableMarketOperators } from "./useMarketOperators";

/**
 * Buyurtma yaratishdagi «Operator» tanlovi — `GET /market-operators/selectable?market_id=` (kontrakt:
 * `{ statusCode, message, data: { items: [{ id, name }] } }`). Market roli `market_id` siz (server tokendan oladi),
 * qolgan rollar — tanlangan market bilan; market tanlanmaguncha so'rov ketmaydi.
 */

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("../../../shared/api/instance", () => ({ api: { get: mocks.get } }));

const ok = (data: unknown) => Promise.resolve({ data: { statusCode: 200, message: "ok", data } });

const createWrapper = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, Wrapper };
};

// Blok tanasi: `mockReset()` mock'ning o'zini qaytaradi — o'qli qisqa yozuvda Vitest uni test oxirida «tozalash»
// funksiyasi deb chaqirardi (xato testida rad etilgan so'rov testni yiqitardi).
beforeEach(() => {
  mocks.get.mockReset();
});

describe("normalizeSelectableMarketOperators", () => {
  it("`data.items` → { id, name }: id satrga, ism qirqiladi; id / ismsiz qator va takror id tashlanadi", () => {
    expect(
      normalizeSelectableMarketOperators({
        statusCode: 200,
        message: "ok",
        data: {
          items: [
            { id: 42, name: "  Dilnoza Karimova " },
            { id: "43", name: "Bekzod", phone_number: "+998901234567" },
            { id: null, name: "Id yo'q" },
            { id: "44", name: "   " },
            { id: "42", name: "Takror" },
            "satr",
          ],
        },
      }),
    ).toEqual([
      { id: "42", name: "Dilnoza Karimova" },
      { id: "43", name: "Bekzod" },
    ]);
  });

  it("`data` massiv bo'lsa ham, `{ items }` yoki xom massiv ham o'qiladi; boshqa shakl — bo'sh ro'yxat", () => {
    expect(normalizeSelectableMarketOperators({ data: [{ id: 1, name: "Ali" }] })).toEqual([{ id: "1", name: "Ali" }]);
    expect(normalizeSelectableMarketOperators({ items: [{ id: 2, name: "Vali" }] })).toEqual([{ id: "2", name: "Vali" }]);
    expect(normalizeSelectableMarketOperators([{ id: 3, name: "Sardor" }])).toEqual([{ id: "3", name: "Sardor" }]);
    expect(normalizeSelectableMarketOperators({ data: { items: null } })).toEqual([]);
    expect(normalizeSelectableMarketOperators(null)).toEqual([]);
    expect(normalizeSelectableMarketOperators("xato")).toEqual([]);
  });
});

describe("getSelectableMarketOperators", () => {
  it("xodim: `market_id` bilan; market roli: parametrsiz", async () => {
    mocks.get.mockImplementation(() => ok({ items: [{ id: 7, name: "Ali" }] }));

    await expect(getSelectableMarketOperators("3")).resolves.toEqual([{ id: "7", name: "Ali" }]);
    expect(mocks.get).toHaveBeenLastCalledWith("market-operators/selectable", { params: { market_id: "3" } });

    await getSelectableMarketOperators();
    expect(mocks.get).toHaveBeenLastCalledWith("market-operators/selectable", { params: undefined });
  });
});

describe("useSelectableMarketOperators", () => {
  it("xodim: market tanlanmaguncha so'rov ketmaydi; tanlangach — `market_id` bilan, kalit `market-operators` ostida", async () => {
    mocks.get.mockImplementation(() => ok({ items: [{ id: 5, name: "Bekzod" }] }));
    const { client, Wrapper } = createWrapper();
    const { result, rerender } = renderHook(({ marketId }) => useSelectableMarketOperators(marketId), {
      wrapper: Wrapper,
      initialProps: { marketId: null as string | null },
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mocks.get).not.toHaveBeenCalled();

    rerender({ marketId: "3" });
    await waitFor(() => expect(result.current.data).toEqual([{ id: "5", name: "Bekzod" }]));
    expect(mocks.get).toHaveBeenCalledWith("market-operators/selectable", { params: { market_id: "3" } });
    expect(client.getQueryData(marketOperatorKeys.selectable("3"))).toEqual([{ id: "5", name: "Bekzod" }]);
    expect(marketOperatorKeys.selectable("3").slice(0, 1)).toEqual(marketOperatorKeys.all);
  });

  it("market roli (`ownMarket`): `market_id` siz so'raladi, berilgan id e'tiborsiz", async () => {
    mocks.get.mockImplementation(() => ok({ items: [] }));
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useSelectableMarketOperators("99", { ownMarket: true }), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
    expect(mocks.get).toHaveBeenCalledTimes(1);
    expect(mocks.get).toHaveBeenCalledWith("market-operators/selectable", { params: undefined });
  });

  it("`enabled: false` — market tanlangan bo'lsa ham so'rov ketmaydi", () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useSelectableMarketOperators("3", { enabled: false }), { wrapper: Wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it("xato — `isError`, ma'lumot yo'q (forma erkin matnga qaytadi)", async () => {
    mocks.get.mockImplementation(() => Promise.reject(new Error("500")));
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useSelectableMarketOperators("4"), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});
