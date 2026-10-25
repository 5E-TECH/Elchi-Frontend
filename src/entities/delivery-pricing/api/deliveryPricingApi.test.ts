import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDeliveryTariff,
  getDeliveryTariffs,
  getPricingSettings,
  getPricingSettingsHistory,
  getQuotesByTariff,
  hasAnyQuote,
  normalizePricingSettings,
  normalizeQuotesByTariff,
  normalizeTariffsData,
  updatePricingSettings,
} from "./deliveryPricingApi";

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));

vi.mock("../../../shared/api/api", () => ({
  api: { get: mocks.get, post: mocks.post, patch: mocks.patch, put: vi.fn(), delete: vi.fn() },
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

  it("hajm chegarasi: `volumetricFromKg` va `volumetricApplied`; eski javobda — `null`", () => {
    const result = normalizeQuotesByTariff({
      data: {
        quotes: {
          city: quote("city", 35000, { volumetricKg: 1.6, billableKg: 0.5, basis: "weight", volumetricFromKg: "3", volumetricApplied: false }),
          center: quote("center", 44000),
        },
      },
    });
    expect(result.city).toMatchObject({ volumetricKg: 1.6, billableKg: 0.5, basis: "weight", volumetricFromKg: 3, volumetricApplied: false });
    expect(result.center).toMatchObject({ volumetricFromKg: null, volumetricApplied: null });
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
      // Eski javobda `volumetric_from_kg` yo'q — 0 (har doim hajm bo'yicha).
      volumetricFromKg: 0,
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

  it("`volumetric_from_kg` (hajm chegarasi) — son satri ham", () => {
    expect(
      normalizePricingSettings({ data: { id: 4, first_kg_included: 1, round_to: 500, volumetric_from_kg: "3.000" } }),
    ).toMatchObject({ volumetricFromKg: 3 });
    expect(normalizePricingSettings({ first_kg_included: 1, round_to: 500, volumetric_from_kg: 0 })).toMatchObject({
      volumetricFromKg: 0,
    });
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

describe("tariflar (47WFHzlx)", () => {
  const row = (id: string, tariff_id: string, extra: Record<string, unknown> = {}) => ({
    id,
    tariff_id,
    base_price: "40000.00",
    extra_per_kg: 4000,
    days_min: 1,
    days_max: 2,
    valid_from: "2026-10-08T00:00:00.000Z",
    is_active: true,
    created_by: "7",
    createdAt: "2026-10-08T04:00:00.000Z",
    ...extra,
  });

  it("normalizeTariffsData: joriy versiyalar (yo'q — null) + tarix bayroqlari", () => {
    const data = normalizeTariffsData({
      statusCode: 200,
      data: {
        current: { city: row("1", "city"), center: row("2", "center"), address: null },
        versions: [row("9", "center", { extra_per_kg: "4500", is_scheduled: true }), row("2", "center", { is_current: true }), { tariff_id: "nope" }],
      },
    });
    expect(data.current.city).toMatchObject({ id: "1", tariffId: "city", basePrice: 40000, extraPerKg: 4000, createdBy: "7", createdByName: null });
    expect(data.current.address).toBeNull();
    expect(data.versions).toHaveLength(2);
    expect(data.versions[0]).toMatchObject({ id: "9", extraPerKg: 4500, isScheduled: true, isCurrent: false });
    expect(data.versions[1]).toMatchObject({ isCurrent: true, createdAt: "2026-10-08T04:00:00.000Z" });
  });

  it("GET / POST delivery/tariffs, PATCH delivery/pricing-settings", async () => {
    mocks.get.mockResolvedValue({ data: { data: { current: {}, versions: [] } } });
    await expect(getDeliveryTariffs()).resolves.toEqual({ current: { city: null, center: null, address: null }, versions: [] });
    expect(mocks.get).toHaveBeenCalledWith("delivery/tariffs");

    mocks.post.mockResolvedValue({ data: { statusCode: 201 } });
    const body = { tariff_id: "center" as const, base_price: 40000, extra_per_kg: 4500, days_min: 1, days_max: 2 };
    await createDeliveryTariff(body);
    expect(mocks.post).toHaveBeenCalledWith("delivery/tariffs", body);

    mocks.patch.mockResolvedValue({ data: { data: { id: "2", first_kg_included: 2, round_to: 500 } } });
    await expect(updatePricingSettings({ first_kg_included: 2 })).resolves.toMatchObject({ firstKgIncluded: 2 });
    expect(mocks.patch).toHaveBeenCalledWith("delivery/pricing-settings", { first_kg_included: 2 });
  });
});

describe("hisob qoidalari tarixi va muallif ismi (47WFHzlx)", () => {
  it("GET delivery/pricing-settings/history → versiyalar, buzuq qator tashlanadi", async () => {
    mocks.get.mockResolvedValueOnce({
      data: {
        statusCode: 200,
        data: {
          versions: [
            {
              id: "2",
              first_kg_included: "2.000",
              round_to: 500,
              is_active: true,
              created_by: "1",
              created_by_name: "Shodiyor Ergashev",
              createdAt: "2026-10-20T10:00:00.000Z",
            },
            { id: "1", first_kg_included: 1, round_to: 500, is_active: false, created_by: null },
            { id: "0" },
          ],
        },
      },
    });
    const versions = await getPricingSettingsHistory();
    expect(mocks.get).toHaveBeenCalledWith("delivery/pricing-settings/history");
    expect(versions).toHaveLength(2);
    expect(versions[0]).toMatchObject({
      id: "2",
      firstKgIncluded: 2,
      isActive: true,
      createdBy: "1",
      createdByName: "Shodiyor Ergashev",
      createdAt: "2026-10-20T10:00:00.000Z",
    });
    expect(versions[1]).toMatchObject({ id: "1", isActive: false, createdBy: null, createdByName: null });
  });

  it("normalizeTariffsData: created_by_name → createdByName", () => {
    const data = normalizeTariffsData({
      data: {
        current: {},
        versions: [
          { id: "3", tariff_id: "city", base_price: 35000, extra_per_kg: 4000, valid_from: "2026-10-08T00:00:00Z", created_by: "1", created_by_name: "Shodiyor Ergashev" },
        ],
      },
    });
    expect(data.versions[0]).toMatchObject({ createdBy: "1", createdByName: "Shodiyor Ergashev" });
  });
});
