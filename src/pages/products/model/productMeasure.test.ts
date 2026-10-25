import { describe, expect, it } from "vitest";
import { DEFAULT_WEIGHT_RULES } from "../../../entities/delivery-pricing";
import { getProductMeasureView } from "./productMeasure";
import type { Product } from "./productView";

const product = (weight: number | string | null, l: number | null, w: number | null, h: number | null, volumetric = true) =>
  ({ id: 1, name: "Quti", weight_kg: weight, length_cm: l, width_cm: w, height_cm: h, volumetric_enabled: volumetric }) as Product;

const rules = (volumetricFromKg: number) => ({ ...DEFAULT_WEIGHT_RULES, volumetricFromKg });

/** Ro'yxatdagi «Hisob vazni» — «Hajm bo'yicha hisoblash chegarasi» bilan (AQ9lkgVB), forma va server bilan bir xil. */
describe("getProductMeasureView — hajm chegarasi", () => {
  it("chegara 3: 20 × 20 × 20, 0,5 kg → 0,5 kg og'irlik bo'yicha; 50 × 35 × 20, 0,8 kg → 7,0 kg hajm bo'yicha", () => {
    expect(getProductMeasureView(product("0.500", 20, 20, 20), rules(3))).toMatchObject({
      complete: true,
      billableKg: 0.5,
      basis: "weight",
      thresholdPending: false,
    });
    expect(getProductMeasureView(product("0.800", 50, 35, 20), rules(3))).toMatchObject({ billableKg: 7, basis: "volume" });
    // Aynan chegarada (30 × 25 × 20 = 3,0 kg) — hajm qo'llanadi.
    expect(getProductMeasureView(product(0.4, 30, 25, 20), rules(3))).toMatchObject({ billableKg: 3, basis: "volume" });
  });

  it("chegara 0 — avvalgi xulq (1,6 kg hajm bo'yicha)", () => {
    expect(getProductMeasureView(product("0.500", 20, 20, 20), rules(0))).toMatchObject({ billableKg: 1.6, basis: "volume" });
  });

  it("chegara noma'lum: natija chegaraga bog'liq bo'lsa — son yo'q (`thresholdPending`), bog'liq bo'lmasa — hisoblanadi", () => {
    expect(getProductMeasureView(product("0.500", 20, 20, 20))).toMatchObject({
      complete: true,
      billableKg: null,
      basis: null,
      thresholdPending: true,
    });
    // Hajm og'irlikdan kichik — chegara ahamiyatsiz.
    expect(getProductMeasureView(product(0.84, 15, 10, 6))).toMatchObject({ billableKg: 0.9, basis: "weight", thresholdPending: false });
    // Kalit o'chiq — faqat og'irlik.
    expect(getProductMeasureView(product(0.9, 40, 30, 15, false))).toMatchObject({
      billableKg: 0.9,
      basis: "volumeOff",
      thresholdPending: false,
    });
    // O'lchovsiz — «Kiritilmagan».
    expect(getProductMeasureView(product(null, null, null, null))).toMatchObject({ complete: false, thresholdPending: false });
  });
});
