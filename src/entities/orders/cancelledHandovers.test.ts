import { describe, expect, it } from "vitest";
import { API_ENDPOINTS } from "../../shared/api";
import { parseHandoverBatch, parseHandoverBatchDetail, parseHandoverBatchesPage } from "./cancelledHandovers";

/** «Topshirilgan» javoblarini o'qish: backend `GET orders/markets/cancelled/handovers[/:batchId]` (2026-11-10). */

const RAW = {
  id: "201_1762771320123456_520",
  market_id: "201",
  market: { id: "201", name: "Baraka Shop", phone_number: "+998901234567" },
  handed_at: "2026-11-10T11:42:00.123Z",
  day: "2026-11-10",
  handed_by: { id: "520", name: "Aziz Karimov" },
  method: "qr",
  manual_count: "1",
  orders_count: "6",
  total_price_sum: "1740000",
};

describe("parseHandoverBatch", () => {
  it("karta maydonlari, sonlar raqamga", () => {
    expect(parseHandoverBatch(RAW)).toEqual({
      ...RAW,
      manual_count: 1,
      orders_count: 6,
      total_price_sum: 1740000,
    });
  });

  it("noma'lum usul — null; market / xodim yo'q — null; market id `market` dan", () => {
    const batch = parseHandoverBatch({
      ...RAW,
      market_id: undefined,
      method: "telepathy",
      handed_by: null,
    });
    expect(batch?.method).toBeNull();
    expect(batch?.handed_by).toBeNull();
    expect(batch?.market_id).toBe("201");
    expect(parseHandoverBatch({ ...RAW, market: null })?.market).toBeNull();
  });

  it("id yoki vaqti yo'q / buzuq — tashlab yuboriladi", () => {
    expect(parseHandoverBatch({ ...RAW, id: undefined })).toBeNull();
    expect(parseHandoverBatch({ ...RAW, handed_at: "kecha" })).toBeNull();
    expect(parseHandoverBatch(null)).toBeNull();
    expect(parseHandoverBatch([RAW])).toBeNull();
  });
});

describe("parseHandoverBatchesPage", () => {
  it("data + total + totals", () => {
    const page = parseHandoverBatchesPage({
      data: [RAW, { bad: true }],
      total: 30,
      totals: { batches: "30", orders: 90, amount: "5574000" },
    });
    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(30);
    expect(page.totals).toEqual({ batches: 30, orders: 90, amount: 5574000 });
  });

  it("totals kelmasa — sahifadagi kartalardan; bo'sh / boshqa shakl — nol", () => {
    expect(parseHandoverBatchesPage({ data: [RAW] }).totals).toEqual({ batches: 1, orders: 6, amount: 1740000 });
    expect(parseHandoverBatchesPage({ data: [] })).toEqual({
      items: [],
      total: 0,
      totals: { batches: 0, orders: 0, amount: 0 },
    });
    expect(parseHandoverBatchesPage(undefined).items).toEqual([]);
  });
});

describe("parseHandoverBatchDetail", () => {
  it("batch + buyurtmalar", () => {
    const detail = parseHandoverBatchDetail({ batch: RAW, data: [{ id: "9" }], total: 1 });
    expect(detail.batch?.id).toBe(RAW.id);
    expect(detail.orders).toEqual([{ id: "9" }]);
    expect(parseHandoverBatchDetail({})).toEqual({ batch: null, orders: [] });
  });
});

describe("endpointlar", () => {
  it("partiya id URL'da kodlanadi", () => {
    expect(API_ENDPOINTS.ORDERS.MARKETS_CANCELLED_HANDOVERS).toBe("orders/markets/cancelled/handovers");
    expect(API_ENDPOINTS.ORDERS.MARKETS_CANCELLED_HANDOVER_BATCH("1_2_3")).toBe("orders/markets/cancelled/handovers/1_2_3");
    expect(API_ENDPOINTS.ORDERS.MARKETS_CANCELLED_HANDOVER_BATCH("a/b")).toBe("orders/markets/cancelled/handovers/a%2Fb");
  });
});
