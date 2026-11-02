import { beforeEach, describe, expect, it, vi } from "vitest";
import { extractIncomingBatches, fetchAllIncomingOrders } from "./index";

const apiGetMock = vi.fn();
vi.mock("../../shared/api/api", () => ({ api: { get: (...args: unknown[]) => apiGetMock(...args) } }));

/** Qop hisobi: `GET orders/external` → `meta.batches` (backend Sm3LZ6EN, frontend qismi DamKku7C). */
const batch = {
  external_batch_token: "3733ff7b",
  external_batch_ref: "BP-24817",
  external_batch_size: 3,
  received_count: 1,
  pending_count: 1,
};
const parsed = { token: "3733ff7b", ref: "BP-24817", size: 3, received: 1, pending: 1 };

describe("extractIncomingBatches", () => {
  it("qobiq ikki xil: `meta.batches` va `data.meta.batches`", () => {
    expect(extractIncomingBatches({ meta: { batches: [batch] } })).toEqual([parsed]);
    expect(extractIncomingBatches({ data: { items: [], meta: { batches: [batch] } } })).toEqual([parsed]);
  });

  it("eski backend (`meta.batches` yo'q) — bo'sh ro'yxat", () => {
    expect(extractIncomingBatches({ data: [], total: 0 })).toEqual([]);
    expect(extractIncomingBatches(undefined)).toEqual([]);
  });

  it("hamkor hajmni aytmagan — `size: null`; `ref` yo'q — `null`", () => {
    expect(
      extractIncomingBatches({
        meta: { batches: [{ ...batch, external_batch_size: null, external_batch_ref: null }] },
      }),
    ).toEqual([{ ...parsed, size: null, ref: null }]);
    expect(extractIncomingBatches({ meta: { batches: [{ ...batch, external_batch_size: 0 }] } })[0].size).toBeNull();
  });

  it("soni yoki tokeni yo'q yozuv tashlanadi: 0 deb olinsa soxta «chala qop» chiqardi", () => {
    const noReceived = { ...batch, received_count: undefined };
    const noPending = { ...batch, pending_count: null };
    expect(
      extractIncomingBatches({ meta: { batches: [noReceived, noPending, { ...batch, external_batch_token: "" }, 7] } }),
    ).toEqual([]);
  });
});

describe("fetchAllIncomingOrders — qoplar sahifalar bo'yicha jamlanadi", () => {
  beforeEach(() => apiGetMock.mockReset());

  it("ikki sahifadagi qop bir marta, sonlar backenddan", async () => {
    const order = (id: number) => ({ id: String(id) });
    apiGetMock
      .mockResolvedValueOnce({
        data: { data: Array.from({ length: 100 }, (_, i) => order(i)), total: 101, meta: { batches: [batch] } },
      })
      .mockResolvedValueOnce({
        data: {
          data: [order(100)],
          total: 101,
          meta: { batches: [batch, { ...batch, external_batch_token: "bbbb", external_batch_ref: null }] },
        },
      });

    const result = await fetchAllIncomingOrders({ status: "new" });

    expect(result.items).toHaveLength(101);
    expect(result.batches).toEqual([parsed, { ...parsed, token: "bbbb", ref: null }]);
  });
});
