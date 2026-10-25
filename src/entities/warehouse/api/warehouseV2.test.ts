import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeOrderSource, resolveOrderSource } from "./warehouseApi";
import { hasWarehousesInPayload } from "./ownWarehouse";
import { getApiErrorCode, isWarehousePausedError, isWarehouseStockForbidden } from "../lib/errorCode";

/**
 * Ombor v2 kontrakti (XtcEyQjb, 6kHnNH9j): manba oldindan ko'rinishi (`POST /warehouses/resolve-source`), xato kodlari
 * (`WAREHOUSE_PAUSED`, `WAREHOUSE_STOCK_FORBIDDEN`) va filial xodimining o'z ombori (`GET /warehouses?limit=1`).
 */

const mocks = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock("../../../shared/api/api", () => ({
  api: { get: vi.fn(), post: mocks.post, patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));

beforeEach(() => mocks.post.mockReset());

const httpError = (status: number, data: unknown) => Object.assign(new Error("x"), { isAxiosError: true, response: { status, data } });

describe("resolve-source", () => {
  it("POST tanasi o'zgarmaydi; javob normallashadi (son satrlari, nomlar)", async () => {
    mocks.post.mockResolvedValue({
      data: {
        source: "WAREHOUSE",
        reason: "OK",
        region_id: 12,
        warehouse: { id: 3, name: "Samarqand filiali ombori", status: "ACTIVE", branch_id: 11, branch_name: "Samarqand filiali", region_id: "12", region_name: null },
        items: [{ product_id: 501, name: "Telefon ushlagich", required: "2", available: "30", enough: true }],
        shortages: [],
      },
    });
    const body = { district_id: "201", market_id: "3", items: [{ product_id: "501", quantity: 2 }] };
    const preview = await resolveOrderSource(body);
    expect(mocks.post).toHaveBeenCalledWith("warehouses/resolve-source", body);
    expect(preview).toEqual({
      source: "WAREHOUSE",
      reason: "OK",
      regionId: "12",
      warehouse: {
        id: "3",
        name: "Samarqand filiali ombori",
        status: "ACTIVE",
        branchId: "11",
        branchName: "Samarqand filiali",
        regionId: "12",
        regionName: null,
      },
      items: [{ productId: "501", name: "Telefon ushlagich", required: 2, available: 30, enough: true }],
      shortages: [],
    });
  });

  it("noma'lum manba — HQ (xavfsiz tomoni), yetmaganlar `enough: false`; gateway o'rami ham o'qiladi", () => {
    expect(normalizeOrderSource({ source: "SKLAD" })).toMatchObject({ source: "HQ", reason: "NO_WAREHOUSE", warehouse: null, items: [] });
    expect(
      normalizeOrderSource({
        statusCode: 200,
        data: { source: "HQ", reason: "INSUFFICIENT_STOCK", shortages: [{ product_id: "9", required: 2, available: 1 }] },
      }),
    ).toMatchObject({ reason: "INSUFFICIENT_STOCK", shortages: [{ productId: "9", required: 2, available: 1, enough: false }] });
    expect(normalizeOrderSource({ source: "warehouse", reason: "weird" })).toMatchObject({ source: "WAREHOUSE", reason: "OK" });
  });
});

describe("xato kodlari", () => {
  it("`{ code }`, `{ error: { code } }`, gateway o'rami va kodning o'zi `message` da", () => {
    expect(getApiErrorCode(httpError(409, { statusCode: 409, code: "WAREHOUSE_PAUSED", message: "Ombor to'xtatilgan" }))).toBe("WAREHOUSE_PAUSED");
    expect(getApiErrorCode(httpError(409, { error: { code: "WAREHOUSE_PAUSED" } }))).toBe("WAREHOUSE_PAUSED");
    expect(getApiErrorCode(httpError(409, { data: { code: "WAREHOUSE_PAUSED" } }))).toBe("WAREHOUSE_PAUSED");
    expect(getApiErrorCode(httpError(409, { statusCode: 409, message: "WAREHOUSE_PAUSED" }))).toBe("WAREHOUSE_PAUSED");
    // Oddiy matn kod emas.
    expect(getApiErrorCode(httpError(409, { message: "Ombor to'xtatilgan" }))).toBeNull();
    expect(getApiErrorCode(new Error("network"))).toBeNull();
  });

  it("WAREHOUSE_PAUSED — faqat 409 + kod; boshqa 409 (tarkib to'qnashuvi) — yo'q", () => {
    expect(isWarehousePausedError(httpError(409, { code: "WAREHOUSE_PAUSED" }))).toBe(true);
    expect(isWarehousePausedError(httpError(409, { message: "Idempotency-Key boshqa tarkib bilan" }))).toBe(false);
    expect(isWarehousePausedError(httpError(400, { code: "WAREHOUSE_PAUSED" }))).toBe(false);
  });

  it("WAREHOUSE_STOCK_FORBIDDEN — 403 (kodli yoki kodsiz)", () => {
    expect(isWarehouseStockForbidden(httpError(403, { code: "WAREHOUSE_STOCK_FORBIDDEN" }))).toBe(true);
    expect(isWarehouseStockForbidden(httpError(403, { message: "Forbidden resource" }))).toBe(true);
    expect(isWarehouseStockForbidden(httpError(500, {}))).toBe(false);
  });
});

describe("o'z ombori (menyu bandi)", () => {
  it("ro'yxat yoki `total` bo'yicha", () => {
    expect(hasWarehousesInPayload({ data: [{ id: 3 }], total: 1 })).toBe(true);
    expect(hasWarehousesInPayload({ data: [], total: 0 })).toBe(false);
    expect(hasWarehousesInPayload({ statusCode: 200, data: { data: [], total: 2 } })).toBe(true);
    expect(hasWarehousesInPayload({ statusCode: 200, data: [] })).toBe(false);
    expect(hasWarehousesInPayload(null)).toBe(false);
  });
});
