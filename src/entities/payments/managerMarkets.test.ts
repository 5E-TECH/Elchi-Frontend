import { beforeEach, describe, expect, it, vi } from "vitest";

const apiGet = vi.hoisted(() => vi.fn());
vi.mock("../../shared/api/api", () => ({ api: { get: apiGet } }));

import {
  MANAGER_MARKETS_MAX_PAGES,
  MANAGER_MARKETS_PAGE_LIMIT,
  fetchManagerMarkets,
  normalizeManagerMarketsPage,
} from "./managerMarkets";

/** `GET /finance/cashbox/manager/markets` javobi (BE PR-C shartnomasi). */
const page = (
  items: Array<Record<string, unknown>>,
  pagination: { total: number; page: number; limit?: number; totalPages: number },
  totals: { total_share?: unknown; total_payable?: unknown } = {},
) => ({
  statusCode: 200,
  message: "ok",
  data: {
    branch_id: "16",
    items,
    total_share: totals.total_share ?? 0,
    total_payable: totals.total_payable ?? 0,
    pagination: { limit: MANAGER_MARKETS_PAGE_LIMIT, ...pagination },
  },
});

const row = (market_id: string | number, payable: unknown, branch_share: unknown = payable, extra = {}) => ({
  market_id,
  name: `Market ${market_id}`,
  status: "active",
  branch_share,
  payable,
  ...extra,
});

describe("normalizeManagerMarketsPage (63HO6cBU, BE PR-C)", () => {
  it("qator: market_id, nom, holat, ulush va «To'lash mumkin» (payable); jamlar va sahifalash", () => {
    const parsed = normalizeManagerMarketsPage(
      page([row(2, "1200000.50", 4_820_000, { status: "blocked" })], { total: 1, page: 1, totalPages: 1 }, {
        total_share: "4820000",
        total_payable: 1_200_000.5,
      }),
    );
    expect(parsed).toEqual({
      branchId: "16",
      items: [{ marketId: "2", name: "Market 2", status: "blocked", branchShare: 4_820_000, payable: 1_200_000.5 }],
      totalShare: 4_820_000,
      totalPayable: 1_200_000.5,
      total: 1,
      totalPages: 1,
    });
  });

  it("buzuq payable — 0 (to'lab bo'lmaydi, ulush o'rniga ishlatilmaydi); market_id siz qator tashlanadi", () => {
    const parsed = normalizeManagerMarketsPage(
      page([row("3", "abc", 900_000), row("4", null, 500), { name: "ID yo'q", payable: 10 }], {
        total: 3,
        page: 1,
        totalPages: 1,
      }),
    );
    expect(parsed.items.map((item) => [item.marketId, item.payable, item.branchShare])).toEqual([
      ["3", 0, 900_000],
      ["4", 0, 500],
    ]);
  });

  it("javobsiz jamlar — null (yolg'on nol emas)", () => {
    const parsed = normalizeManagerMarketsPage({ data: { items: [], pagination: { total: 0, page: 1, totalPages: 0 } } });
    expect(parsed.totalPayable).toBeNull();
    expect(parsed.totalShare).toBeNull();
    expect(parsed.branchId).toBeNull();
  });
});

/** `api.get(url, { params: { page } })` dagi sahifa raqami. */
const pageOf = (options: unknown) => (options as { params?: { page?: number } } | undefined)?.params?.page ?? 0;

describe("fetchManagerMarkets — butun ro'yxat (limit ≤ 100)", () => {
  beforeEach(() => apiGet.mockReset());

  it("bitta sahifa — bitta so'rov (page 1, limit 100)", async () => {
    apiGet.mockResolvedValueOnce({ data: page([row(2, 10)], { total: 1, page: 1, totalPages: 1 }, { total_payable: 10 }) });
    const result = await fetchManagerMarkets();
    expect(apiGet).toHaveBeenCalledTimes(1);
    expect(apiGet).toHaveBeenCalledWith("finance/cashbox/manager/markets", { params: { page: 1, limit: 100 } });
    expect(result.items.map((item) => item.marketId)).toEqual(["2"]);
    expect(result.totalPayable).toBe(10);
  });

  it("ko'p sahifa — qolganlari ham olinadi, tartib saqlanadi, takror market bir marta", async () => {
    apiGet.mockImplementation((...args: unknown[]) => {
      const requested = pageOf(args[1]);
      return Promise.resolve({
        data:
          requested === 1
            ? page([row(1, 30), row(2, 20)], { total: 5, page: 1, totalPages: 3 }, { total_payable: 60 })
            : requested === 2
              ? page([row(2, 20), row(3, 5)], { total: 5, page: 2, totalPages: 3 })
              : page([row(4, 0), row(5, 0)], { total: 5, page: 3, totalPages: 3 }),
      });
    });
    const result = await fetchManagerMarkets();
    expect(apiGet.mock.calls.map(([, options]) => pageOf(options))).toEqual([1, 2, 3]);
    expect(result.items.map((item) => item.marketId)).toEqual(["1", "2", "3", "4", "5"]);
    expect(result.total).toBe(5);
    expect(result.totalPayable).toBe(60);
  });

  it(`ko'pi bilan ${MANAGER_MARKETS_MAX_PAGES} sahifa`, async () => {
    apiGet.mockImplementation((...args: unknown[]) => {
      const requested = pageOf(args[1]);
      return Promise.resolve({
        data: page([row(requested, 1)], { total: 99_999, page: requested, totalPages: 1000 }),
      });
    });
    const result = await fetchManagerMarkets();
    expect(apiGet).toHaveBeenCalledTimes(MANAGER_MARKETS_MAX_PAGES);
    expect(result.items).toHaveLength(MANAGER_MARKETS_MAX_PAGES);
  });

  it("503 — xato yuqoriga chiqadi (bo'sh ro'yxat emas)", async () => {
    const error = Object.assign(new Error("Service Unavailable"), { response: { status: 503 } });
    apiGet.mockRejectedValueOnce(error);
    await expect(fetchManagerMarkets()).rejects.toBe(error);
  });
});
