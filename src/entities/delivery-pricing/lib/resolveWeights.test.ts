import { describe, expect, it } from "vitest";
import type { DeliveryQuote } from "../model/types";
import { DEFAULT_WEIGHT_RULES } from "./billableWeight";
import { firstDeliveryQuote, resolveMeasureWeights } from "./resolveWeights";

const SMALL = { weight_kg: 0.5, length_cm: 20, width_cm: 20, height_cm: 20, volumetric_enabled: true };

const quote = (extra: Partial<DeliveryQuote> = {}): DeliveryQuote => ({
  tariffId: "city",
  base: 35000,
  perExtraKg: 4000,
  actualKg: 0.5,
  volumetricKg: 1.6,
  billableKg: 0.5,
  extraKg: 0,
  extra: 0,
  total: 35000,
  basis: "weight",
  volumetricFromKg: 3,
  volumetricApplied: false,
  daysMin: 1,
  daysMax: 1,
  ...extra,
});

describe("resolveMeasureWeights — server natijasi ustun, chegara javobdan", () => {
  it("sozlamasiz rol (qoidalar yo'q): yangi javob — hisob vazni, asos va «hajm qo'llanmadi» serverdan", () => {
    expect(resolveMeasureWeights(SMALL, undefined, { quote: quote(), fresh: true })).toEqual({
      actualKg: 0.5,
      volumetricKg: 1.6,
      billableKg: 0.5,
      basis: "weight",
      volumetricFromKg: 3,
      volumetricApplied: false,
      source: "server",
    });
  });

  it("javob eskirgan (o'lchov o'zgardi, kutilmoqda) — chegara javobdan, hisob klientda shu chegara bilan", () => {
    const result = resolveMeasureWeights(SMALL, undefined, { quote: quote({ billableKg: 7 }), fresh: false });
    expect(result).toMatchObject({ billableKg: 0.5, basis: "weight", volumetricFromKg: 3, volumetricApplied: false, source: "local" });
  });

  it("javob yo'q — sozlamadagi chegara (superadmin/admin), u ham yo'q — 0 (avvalgi xulq)", () => {
    expect(resolveMeasureWeights(SMALL, { ...DEFAULT_WEIGHT_RULES, volumetricFromKg: 3 })).toMatchObject({
      billableKg: 0.5,
      volumetricApplied: false,
      volumetricFromKg: 3,
      source: "local",
    });
    expect(resolveMeasureWeights(SMALL, undefined)).toMatchObject({
      billableKg: 1.6,
      basis: "volume",
      volumetricApplied: true,
      volumetricFromKg: 0,
    });
  });

  it("eski backend (`volumetricApplied` yo'q) — klient hisobi; javobda chegara bo'lmasa sozlamaniki", () => {
    const old = quote({ volumetricApplied: null, volumetricFromKg: null, billableKg: 1.6, basis: "volume" });
    expect(resolveMeasureWeights(SMALL, undefined, { quote: old, fresh: true })).toMatchObject({
      billableKg: 1.6,
      volumetricFromKg: 0,
      source: "local",
    });
    expect(resolveMeasureWeights(SMALL, { ...DEFAULT_WEIGHT_RULES, volumetricFromKg: 3 }, { quote: old, fresh: true })).toMatchObject({
      billableKg: 0.5,
      volumetricFromKg: 3,
    });
  });

  it("firstDeliveryQuote — birinchi mavjud tarif natijasi", () => {
    const center = quote({ tariffId: "center" });
    expect(firstDeliveryQuote({ city: null, center, address: null })).toBe(center);
    expect(firstDeliveryQuote(undefined)).toBeNull();
  });
});
