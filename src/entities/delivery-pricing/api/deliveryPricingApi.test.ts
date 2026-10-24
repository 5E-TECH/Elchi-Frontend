import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPricingSettings,
  getQuotesByTariff,
  hasAnyQuote,
  normalizePricingSettings,
  normalizeQuotesByTariff,
} from "./deliveryPricingApi";

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock("../../../shared/api/api", () => ({
  api: { get: mocks.get, post: mocks.post, patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));

const quote = (tariffId: string, total: number | string, extra: Record<string, unknown> = {}) => ({
  tariffId,
  base: 40000,
  perExtraKg: 4000,
  daysMin: 1,
  daysMax: 2,
  actualKg: 1.2,
  volumetricKg: 1.98,
  billableKg: 2,
  extraKg: 1,
  extra: 4000,
  subtotal: 44000,
  total,
  basis: "volume",
  tariff: { id: "2", tariff_id: tariffId, base_price: 40000, extra_per_kg: 4000 },
  ...extra,
});

beforeEach(() => {
  mocks.get.mockReset();
  mocks.post.mockReset();
});

describe("normalizeQuotesByTariff", () => {
  it("`{ statusCode, data: { quotes } }` → uchala tarif; faol versiyasi yo'q — `null`", () => {
    const result = normalizeQuotesByTariff({
      statusCode: 200,
      data: { quotes: { city: quote("city", 39000), center: quote("center", "44000.00"), address: null } },
    });
    expect(result.city).toMatchObject({ tariffId: "city", total: 39000, billableKg: 2, extraKg: 1, basis: "volume" });
    expect(result.center?.total).toBe(44000);
    expect(result.address).toBeNull();
    expect(hasAnyQuote(result)).toBe(true);
  });

  it("bo'sh yoki buzuq javob — hammasi `null`, xato tashlanmaydi", () => {
    expect(normalizeQuotesByTariff({})).toEqual({ city: null, center: null, address: null });
    expect(normalizeQuotesByTariff(null)).toEqual({ city: null, center: null, address: null });
    expect(hasAnyQuote(normalizeQuotesByTariff({ data: { quotes: { city: { tariffId: "city" } } } }))).toBe(false);
  });
});

describe("normalizePricingSettings", () => {
  it("son satrlari ham o'qiladi; `pickup_free_from_count: null` — tekin emas", () => {
    expect(
      normalizePricingSettings({
        data: {
          id: 3,
          volumetric_divisor: 5000,
          first_kg_included: "2.000",
          min_billable_kg: "0.1",
          billable_step_kg: 0.1,
          round_to: 500,
          pickup_fee: "20000",
          pickup_free_from_count: null,
          express_multiplier: "1.4",
        },
      }),
    ).toEqual({
      id: "3",
      volumetricDivisor: 5000,
      firstKgIncluded: 2,
      minBillableKg: 0.1,
      billableStepKg: 0.1,
      roundTo: 500,
      pickupFee: 20000,
      pickupFreeFromCount: null,
      expressMultiplier: 1.4,
    });
  });

  it("majburiy maydon yo'q — `null`", () => {
    expect(normalizePricingSettings({ data: {} })).toBeNull();
  });
});

describe("so'rovlar", () => {
  it("POST delivery/quote/by-tariff — `items` bilan, javob normallashtiriladi", async () => {
    mocks.post.mockResolvedValue({ data: { data: { quotes: { city: quote("city", 39000) } } } });
    const body = {
      items: [{ weight_kg: 1.2, length_cm: 30, width_cm: 22, height_cm: 15, volumetric_enabled: true }],
    };
    const result = await getQuotesByTariff(body);
    expect(mocks.post).toHaveBeenCalledWith("delivery/quote/by-tariff", body);
    expect(result.city?.total).toBe(39000);
    expect(result.center).toBeNull();
  });

  it("GET delivery/pricing-settings", async () => {
    mocks.get.mockResolvedValue({ data: { data: { id: "1", first_kg_included: 1, round_to: 500 } } });
    await expect(getPricingSettings()).resolves.toMatchObject({ firstKgIncluded: 1, roundTo: 500 });
    expect(mocks.get).toHaveBeenCalledWith("delivery/pricing-settings");
  });
});
