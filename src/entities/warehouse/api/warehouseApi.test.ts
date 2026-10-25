import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  exportWarehouseStock,
  getMarketWarehouseStock,
  getWarehouse,
  getWarehouseMovements,
  getWarehouses,
  getWarehouseStock,
  inventoryWarehouse,
  lookupWarehouseCode,
  normalizeMarketStock,
  normalizeWarehouse,
  normalizeWarehouseList,
  normalizeWarehouseLookup,
  normalizeWarehouseMovements,
  normalizeWarehouseStock,
  pauseWarehouse,
  resumeWarehouse,
  setMarketWarehouseOrder,
  setStockThreshold,
  stockInWarehouse,
} from "./warehouseApi";
import { rawProduct, rawWarehouse } from "../../../test/warehouseFixtures";
import { hqFirst } from "../lib/hqFirst";

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), saveBlob: vi.fn() }));

vi.mock("../../../shared/api/api", () => ({
  api: { get: mocks.get, post: mocks.post, patch: mocks.patch, put: vi.fn(), delete: vi.fn() },
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));

vi.mock("../../../shared/lib/exportFile", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../shared/lib/exportFile")>()),
  saveBlob: mocks.saveBlob,
}));

beforeEach(() => {
  mocks.get.mockReset();
  mocks.post.mockReset();
  mocks.patch.mockReset();
  mocks.saveBlob.mockReset();
});

describe("normalizeWarehouse / normalizeWarehouseList", () => {
  it("o'ramsiz ro'yxat: qatorlar camelCase, son satrlari son, counts va summary", () => {
    const data = normalizeWarehouseList({
      data: [rawWarehouse(), rawWarehouse({ id: "4", status: "PAUSED", paused_at: "2026-10-20T12:30:00Z" }), { name: "id yo'q" }],
      total: 2,
      page: 1,
      limit: 50,
      counts: { all: 2, active: 1, paused: 1 },
      summary: { warehouses: 2, active: 1, paused: 1, positions: 17, on_hand: 582, reserved: 38, available: 544, reserved_orders: 14, low_count: 2, out_count: 1 },
    });
    expect(data.items).toHaveLength(2);
    expect(data.items[0]).toMatchObject({
      id: "3",
      status: "ACTIVE",
      branchId: "11",
      branch: { name: "Samarqand filiali", type: "REGIONAL" },
      region: { id: "7", name: "Samarqand viloyati" },
      manager: { id: "31", name: "Dilshod Usmonov", phone: "+998915071244" },
      summary: { onHand: 486, reservedOrders: 14, lowCount: 2, outCount: 1 },
      lastMovement: { type: "IN", qty: 40, refType: "stock_in" },
      movementsCount: null,
    });
    expect(data.items[1]).toMatchObject({ id: "4", status: "PAUSED", pausedAt: "2026-10-20T12:30:00Z" });
    expect(data.counts).toEqual({ all: 2, active: 1, paused: 1 });
    expect(data.summary).toMatchObject({ warehouses: 2, onHand: 582, reservedOrders: 14 });
  });

  it("gateway o'rami (`{ statusCode, data: {…} }`) ham o'qiladi; noma'lum holat — ACTIVE, harakatsiz — null", () => {
    const list = normalizeWarehouseList({ statusCode: 200, data: { data: [rawWarehouse({ last_movement: null })], total: 1 } });
    expect(list.items[0].lastMovement).toBeNull();
    expect(list.total).toBe(1);
    expect(normalizeWarehouse({ ...rawWarehouse(), status: "weird", movements_count: "86" })).toMatchObject({
      status: "ACTIVE",
      movementsCount: 86,
    });
    expect(normalizeWarehouse({})).toBeNull();
    expect(normalizeWarehouseList(null).items).toEqual([]);
  });
});

describe("Markaziy ombor — `kind` / `isHq` (Pa1KaXmj)", () => {
  const HQ_RAW = rawWarehouse({
    id: "12",
    name: "Markaziy ombor",
    kind: "HQ",
    branch_id: "1",
    branch: { id: "1", name: "Toshkent HQ", type: "HQ", status: "active", address: null },
    region: null,
    manager_user_id: null,
    manager: null,
  });

  it("`kind: HQ` — Markaziy ombor, mas'ulsiz", () => {
    expect(normalizeWarehouse(HQ_RAW)).toMatchObject({ kind: "HQ", isHq: true, manager: null, managerUserId: null, region: null });
  });

  it("`kind` siz, lekin filial turi HQ — `isHq` (tur `REGIONAL` qoladi)", () => {
    expect(normalizeWarehouse({ ...HQ_RAW, kind: undefined })).toMatchObject({ kind: "REGIONAL", isHq: true });
  });

  it("viloyat ombori: `kind: REGIONAL`, `kind` siz yoki noma'lum — REGIONAL, isHq yo'q", () => {
    expect(normalizeWarehouse(rawWarehouse({ kind: "REGIONAL" }))).toMatchObject({ kind: "REGIONAL", isHq: false });
    expect(normalizeWarehouse(rawWarehouse())).toMatchObject({ kind: "REGIONAL", isHq: false });
    expect(normalizeWarehouse(rawWarehouse({ kind: "SKLAD" }))).toMatchObject({ kind: "REGIONAL", isHq: false });
    expect(normalizeWarehouse(rawWarehouse({ kind: "hq" }))).toMatchObject({ kind: "HQ", isHq: true });
  });

  it("ro'yxat va market qoldig'i ustunlarida ham", () => {
    expect(normalizeWarehouseList({ data: [rawWarehouse(), HQ_RAW] }).items.map((item) => item.isHq)).toEqual([false, true]);
    const stock = normalizeMarketStock({
      warehouses: [
        { id: "3", name: "Samarqand filiali ombori", status: "ACTIVE", kind: "REGIONAL", branch: { id: "11", name: "Samarqand filiali" } },
        { id: "12", name: "Markaziy ombor", status: "ACTIVE", kind: "HQ", branch: { id: "1", name: "Toshkent HQ" } },
        { id: "13", name: "Eski javob", status: "ACTIVE", branch: { id: "1", name: "Toshkent HQ", type: "HQ" } },
      ],
      data: [],
    });
    expect(stock.warehouses.map(({ kind, isHq }) => ({ kind, isHq }))).toEqual([
      { kind: "REGIONAL", isHq: false },
      { kind: "HQ", isHq: true },
      { kind: "REGIONAL", isHq: true },
    ]);
  });

  it("hqFirst — Markaziy ombor oldinga, qolganlarining tartibi saqlanadi", () => {
    const items = [
      { id: "a", isHq: false },
      { id: "hq", isHq: true },
      { id: "b", isHq: false },
    ];
    expect(hqFirst(items).map((item) => item.id)).toEqual(["hq", "a", "b"]);
    expect(hqFirst([{ id: "a", isHq: false }]).map((item) => item.id)).toEqual(["a"]);
  });
});

describe("normalizeWarehouseStock", () => {
  it("qator: mahsulot (kod, hisob vazni), market, qoldiq/band/mavjud, chegara, holat + facets", () => {
    const data = normalizeWarehouseStock({
      warehouse: { id: "3", name: "Samarqand filiali ombori", status: "ACTIVE" },
      data: [
        {
          stock_id: "55",
          product: rawProduct({ barcode: "8806095501239", code: { value: "8806095501239", kind: "barcode", format: "EAN-13" }, chargeable_basis: "volumetric", chargeable_weight_kg: "38.4" }),
          market: { id: "121", name: "Nur Elektronika" },
          on_hand: 4,
          reserved: 1,
          available: 3,
          low_stock_threshold: null,
          threshold: 2,
          level: "ok",
          last_movement_at: null,
        },
        { stock_id: "56", product: {} },
      ],
      total: 12,
      page: 1,
      limit: 8,
      facets: { levels: { all: 12, ok: 9, low: 2, out: 1 }, markets: [{ id: "121", name: "Baraka Shop", positions: 4 }] },
    });
    expect(data.items).toHaveLength(1);
    expect(data.items[0]).toMatchObject({
      stockId: "55",
      onHand: 4,
      reserved: 1,
      available: 3,
      lowStockThreshold: null,
      threshold: 2,
      level: "ok",
      market: { id: "121", name: "Nur Elektronika" },
      product: {
        id: "142",
        code: { value: "8806095501239", kind: "barcode", format: "EAN-13" },
        chargeableWeightKg: 38.4,
        chargeableBasis: "volumetric",
        weightKg: 0.2,
        measureMissing: false,
      },
    });
    expect(data.facets.levels).toEqual({ all: 12, ok: 9, low: 2, out: 1 });
    expect(data.facets.markets).toEqual([{ id: "121", name: "Baraka Shop", positions: 4 }]);
    expect(data.warehouse).toEqual({ id: "3", name: "Samarqand filiali ombori", status: "ACTIVE" });
  });

  it("kod yo'q bo'lsa: zavod kodi ustun, so'ng ELC-P; og'irliksiz — «O'lchov yo'q»", () => {
    const data = normalizeWarehouseStock({
      data: [{ stock_id: 1, product: rawProduct({ code: undefined, barcode: "4780123450017", weight_kg: null, measure_missing: undefined }), level: "LOW" }],
    });
    expect(data.items[0].product.code).toEqual({ value: "4780123450017", kind: "barcode", format: "EAN-13" });
    expect(data.items[0].product.measureMissing).toBe(true);
    expect(data.items[0].level).toBe("low");
  });
});

describe("normalizeWarehouseMovements", () => {
  it("ishorali son, buyurtma raqami, muallif; noma'lum tur tashlanadi", () => {
    const data = normalizeWarehouseMovements({
      data: [
        {
          id: "901",
          type: "OUT",
          qty: -1,
          on_hand_after: 63,
          reserved_after: 7,
          ref_type: "order",
          ref_id: "10238",
          order_id: null,
          note: null,
          created_at: "2026-10-24T07:30:00Z",
          product: { id: "123", name: "Bolalar kurtkasi, 110 sm", sku_code: "ELC-P-000123", barcode: null },
          market: { id: "121", name: "Baraka Shop" },
          actor: { id: "9", name: "Bekzod Rasulov", role: "courier" },
        },
        { id: "902", type: "TELEPORT", created_at: "2026-10-24T07:30:00Z" },
      ],
      total: 86,
    });
    expect(data.items).toHaveLength(1);
    expect(data.items[0]).toMatchObject({
      type: "OUT",
      qty: -1,
      orderId: "10238",
      actor: { name: "Bekzod Rasulov", role: "courier" },
      product: { name: "Bolalar kurtkasi, 110 sm", skuCode: "ELC-P-000123" },
    });
    expect(data.total).toBe(86);
  });
});

describe("normalizeWarehouseLookup", () => {
  it("topildi — mahsulot, market va qoldiq; omborda yo'q — `stock: null`", () => {
    const data = normalizeWarehouseLookup({
      warehouse: { id: "3", name: "Samarqand", status: "PAUSED" },
      code: "ELC-P-000142",
      matched_by: "sku_code",
      data: [
        { product: rawProduct(), market: { id: "121", name: "Baraka Shop" }, stock: { on_hand: 0, reserved: 0, available: 0, threshold: 10, level: "out" } },
        { product: rawProduct({ id: "143" }), market: { id: "122", name: "Nur" }, stock: null },
      ],
    });
    expect(data.matchedBy).toBe("sku_code");
    expect(data.warehouse?.status).toBe("PAUSED");
    expect(data.items[0].stock).toEqual({ onHand: 0, reserved: 0, available: 0, threshold: 10, level: "out" });
    expect(data.items[1].stock).toBeNull();
  });

  it("topilmadi — `items: []`, kod so'rovdagidek", () => {
    expect(normalizeWarehouseLookup({ matched_by: null, data: [] }, "4780012345677")).toEqual({
      warehouse: null,
      code: "4780012345677",
      matchedBy: null,
      items: [],
    });
  });
});

describe("normalizeMarketStock", () => {
  it("ustunlar (to'xtatilgani bilan), katakchalar, «Jami» va summary", () => {
    const data = normalizeMarketStock({
      market_id: "121",
      warehouses: [
        { id: "3", name: "Samarqand filiali ombori", status: "ACTIVE", branch: { id: "11", name: "Samarqand filiali" }, region: { id: "7", name: "Samarqand viloyati" } },
        { id: "4", name: "Urgut filiali ombori", status: "PAUSED", branch: { id: "12", name: "Urgut filiali" }, region: null },
      ],
      data: [
        {
          product: rawProduct(),
          cells: [
            { warehouse_id: "3", warehouse_status: "ACTIVE", on_hand: 0, reserved: 0, available: 0, threshold: 10, level: "out" },
            { warehouse_id: "4", warehouse_status: "PAUSED", on_hand: 6, reserved: 0, available: 6, threshold: 5, level: "ok" },
          ],
          total_available: 30,
          total_on_hand: 36,
          has_low: true,
        },
      ],
      total: 8,
      page: 1,
      limit: 50,
      summary: { products_total: 12, products_in_warehouses: 8, total_available: 446, warehouses_total: 4, warehouses_active: 3, warehouses_paused: 1, active_warehouses_with_stock: 3, low_positions: 3, out_positions: 1 },
    });
    expect(data.warehouses[1]).toMatchObject({ status: "PAUSED", branch: { name: "Urgut filiali" }, region: null });
    expect(data.items[0]).toMatchObject({ totalAvailable: 30, hasLow: true });
    expect(data.items[0].cells[1]).toMatchObject({ warehouseId: "4", warehouseStatus: "PAUSED", available: 6 });
    expect(data.summary).toMatchObject({ productsTotal: 12, productsInWarehouses: 8, totalAvailable: 446, outPositions: 1 });
  });
});

describe("so'rovlar", () => {
  it("GET warehouses — bo'sh parametrlar yuborilmaydi", async () => {
    mocks.get.mockResolvedValue({ data: { data: [], total: 0 } });
    await getWarehouses({ status: "PAUSED", region_id: "", search: "Urgut", page: 1, limit: 50 });
    expect(mocks.get).toHaveBeenCalledWith("warehouses", { params: { status: "PAUSED", search: "Urgut", page: 1, limit: 50 } });
  });

  it("GET warehouses/:id, stock, movements", async () => {
    mocks.get.mockResolvedValueOnce({ data: rawWarehouse({ movements_count: 86 }) });
    await expect(getWarehouse("3")).resolves.toMatchObject({ id: "3", movementsCount: 86 });
    expect(mocks.get).toHaveBeenLastCalledWith("warehouses/3");

    mocks.get.mockResolvedValueOnce({ data: { data: [] } });
    await getWarehouseStock("3", { level: "low,out", market_id: "121", page: 2, limit: 20, search: undefined });
    expect(mocks.get).toHaveBeenLastCalledWith("warehouses/3/stock", { params: { level: "low,out", market_id: "121", page: 2, limit: 20 } });

    mocks.get.mockResolvedValueOnce({ data: { data: [] } });
    await getWarehouseMovements("3", { type: "IN,ADJUST", page: 1, limit: 20 });
    expect(mocks.get).toHaveBeenLastCalledWith("warehouses/3/movements", { params: { type: "IN,ADJUST", page: 1, limit: 20 } });
  });

  it("lookup — kod query parametrida (QR matnidagi `/` ham), market ixtiyoriy", async () => {
    mocks.get.mockResolvedValue({ data: { data: [] } });
    await lookupWarehouseCode("3", "ELC-P-000142");
    expect(mocks.get).toHaveBeenLastCalledWith("warehouses/3/lookup", { params: { code: "ELC-P-000142" } });
    await lookupWarehouseCode("3", "4780123450017", "121");
    expect(mocks.get).toHaveBeenLastCalledWith("warehouses/3/lookup", { params: { code: "4780123450017", market_id: "121" } });
  });

  it("kirim va inventarizatsiya — `Idempotency-Key` sarlavhasi bilan", async () => {
    mocks.post.mockResolvedValueOnce({
      data: { warehouse_id: "3", warehouse_name: "Samarqand", replayed: true, positions: 1, total_qty: 40, lines: [{ product_id: "142", product_name: "Q", market_id: "121", qty: 40, on_hand: 49 }] },
    });
    const body = { lines: [{ product_id: "142", qty: 40 }], note: "3 quti" };
    await expect(stockInWarehouse("3", body, "key-12345678")).resolves.toMatchObject({ replayed: true, totalQty: 40, lines: [{ onHand: 49 }] });
    expect(mocks.post).toHaveBeenLastCalledWith("warehouses/3/stock-in", body, { headers: { "Idempotency-Key": "key-12345678" } });

    mocks.post.mockResolvedValueOnce({ data: { replayed: false, reason: "Oylik", changed: 1, unchanged: 0, lines: [{ product_id: "131", counted: 6, before: 8, after: 6, delta: -2 }] } });
    const inventory = { lines: [{ product_id: "131", counted: 6 }], reason: "Oylik" };
    await expect(inventoryWarehouse("3", inventory, "key-abcdefgh")).resolves.toMatchObject({ changed: 1, lines: [{ delta: -2 }] });
    expect(mocks.post).toHaveBeenLastCalledWith("warehouses/3/inventory", inventory, { headers: { "Idempotency-Key": "key-abcdefgh" } });
  });

  it("to'xtatish / qayta yoqish (izoh ixtiyoriy), chegara, market kaliti", async () => {
    mocks.post.mockResolvedValue({ data: rawWarehouse({ status: "PAUSED" }) });
    await expect(pauseWarehouse("3")).resolves.toMatchObject({ status: "PAUSED" });
    expect(mocks.post).toHaveBeenLastCalledWith("warehouses/3/pause", {});
    await resumeWarehouse("3", "Mavsum");
    expect(mocks.post).toHaveBeenLastCalledWith("warehouses/3/resume", { note: "Mavsum" });

    mocks.patch.mockResolvedValueOnce({ data: { warehouse_id: "3", product_id: "142", low_stock_threshold: null, effective_threshold: 5 } });
    await expect(setStockThreshold("3", "142", null)).resolves.toEqual({ productId: "142", lowStockThreshold: null, effectiveThreshold: 5 });
    expect(mocks.patch).toHaveBeenLastCalledWith("warehouses/3/stock/142", { low_stock_threshold: null });

    mocks.patch.mockResolvedValueOnce({ data: { statusCode: 200, data: { id: "121", can_order_from_warehouse: true } } });
    await expect(setMarketWarehouseOrder("121", true)).resolves.toBe(true);
    expect(mocks.patch).toHaveBeenLastCalledWith("markets/121/warehouse-order", { can_order_from_warehouse: true });
  });

  it("market qoldig'i — `low_only` faqat yoqilganda", async () => {
    mocks.get.mockResolvedValue({ data: { data: [] } });
    await getMarketWarehouseStock({ search: "quloq", low_only: false, page: 1, limit: 50 });
    expect(mocks.get).toHaveBeenLastCalledWith("market/warehouse-stock", { params: { search: "quloq", page: 1, limit: 50 } });
    await getMarketWarehouseStock({ low_only: true });
    expect(mocks.get).toHaveBeenLastCalledWith("market/warehouse-stock", { params: { low_only: true } });
  });

  it("Excel — blob, fayl nomi `Content-Disposition` dan", async () => {
    const blob = new Blob(["x"]);
    mocks.get.mockResolvedValue({ data: blob, headers: { "content-disposition": 'attachment; filename="ombor-3.xlsx"' } });
    await exportWarehouseStock("3", { level: "low", search: "" }, "fallback.xlsx");
    expect(mocks.get).toHaveBeenCalledWith("warehouses/3/export", { params: { level: "low" }, responseType: "blob", timeout: 120_000 });
    expect(mocks.saveBlob).toHaveBeenCalledWith(blob, "ombor-3.xlsx");
  });
});
