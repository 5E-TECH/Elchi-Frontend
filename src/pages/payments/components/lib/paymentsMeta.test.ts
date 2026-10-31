import { describe, expect, it } from "vitest";
import type { PaymentsMetaResponse } from "../../../../entities/payments";
import { normalizePaymentsMeta } from "./paymentsMeta";

const response = (data: unknown) => ({ statusCode: 200, message: "ok", data }) as PaymentsMetaResponse;

const market = { market_id: "101", cashbox_id: "55", name: " Baraka Shop ", amount: 4_800_000, share: 35.7 };
const others = { count: 3, amount: 3_200_000, share: 23.8 };

describe("normalizePaymentsMeta (uzWcMR1C)", () => {
  it("reads the gateway contract", () => {
    expect(
      normalizePaymentsMeta(
        response({
          receivable: {
            amount: 9_870_000,
            branches: { count: 5, amount: 8_770_000 },
            hq_couriers: { count: 2, amount: 1_100_000 },
          },
          payable: { markets_count: 6, amount: 13_458_000, top_markets: [market], others },
        }),
      ),
    ).toEqual({
      branches: { count: 5, amount: 8_770_000 },
      hqCouriers: { count: 2, amount: 1_100_000 },
      payable: {
        marketsCount: 6,
        topMarkets: [{ marketId: "101", name: "Baraka Shop", amount: 4_800_000, share: 35.7 }],
        others,
      },
    });
  });

  it.each([
    ["no response", undefined],
    ["empty list shape (unmocked GET)", response({ items: [], total: 0 })],
    ["null blocks", response({ receivable: { amount: 0, branches: null, hq_couriers: null }, payable: null })],
    ["non-numeric counts", response({ receivable: { branches: { count: "5", amount: null } }, payable: { markets_count: null } })],
  ])("%s → every block is null, never 0", (_label, input) => {
    expect(normalizePaymentsMeta(input)).toEqual({ branches: null, hqCouriers: null, payable: null });
  });

  it("keeps a real zero", () => {
    const meta = normalizePaymentsMeta(
      response({
        receivable: { branches: { count: 0, amount: 0 }, hq_couriers: { count: 0, amount: 0 } },
        payable: { markets_count: 0, amount: 0, top_markets: [], others: { count: 0, amount: 0, share: 0 } },
      }),
    );
    expect(meta.branches).toEqual({ count: 0, amount: 0 });
    expect(meta.hqCouriers).toEqual({ count: 0, amount: 0 });
    expect(meta.payable).toEqual({ marketsCount: 0, topMarkets: [], others: null });
  });

  it("an unnamed market keeps its id; a blank name is no name", () => {
    const meta = normalizePaymentsMeta(
      response({ payable: { markets_count: 2, top_markets: [{ ...market, name: null }, { ...market, market_id: "102", name: "  " }] } }),
    );
    expect(meta.payable?.topMarkets.map(({ marketId, name }) => [marketId, name])).toEqual([
      ["101", null],
      ["102", null],
    ]);
  });

  it("a broken top row drops the distribution but keeps the count", () => {
    const meta = normalizePaymentsMeta(
      response({ payable: { markets_count: 4, top_markets: [market, { market_id: "102", name: "X" }], others } }),
    );
    expect(meta.payable?.marketsCount).toBe(4);
    expect(meta.payable?.topMarkets).toEqual([]);
  });
});
