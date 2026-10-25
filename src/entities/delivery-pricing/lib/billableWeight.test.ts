import { describe, expect, it } from "vitest";
import {
  computeExtraKg,
  computeMeasureWeights,
  computeTariffTotal,
  DEFAULT_WEIGHT_RULES,
  meetsVolumetricThreshold,
  toWeightRules,
} from "./billableWeight";

const item = (weight: number, l: number, w: number, h: number, volumetric = true) => ({
  weight_kg: weight,
  length_cm: l,
  width_cm: w,
  height_cm: h,
  volumetric_enabled: volumetric,
});

/**
 * Hisob vazni — backend `computeDeliveryQuote` va landing kalkulyatori bilan AYNI (6FLyjO6j «Tekshiruv»:
 * 30×22×15, 1,2 kg → 1,98 / 2,0 kg).
 */
describe("computeMeasureWeights", () => {
  it("landing vektori: 30 × 22 × 15, 1,2 kg → hajmli 1,98, hisob 2,0 kg (hajm bo'yicha)", () => {
    expect(computeMeasureWeights(item(1.2, 30, 22, 15))).toEqual({
      actualKg: 1.2,
      volumetricKg: 1.98,
      billableKg: 2,
      basis: "volume",
    });
  });

  it("maket: 50 × 35 × 20, 0,8 kg → 7,0 / 7,0 kg; og'irroq posilka — og'irlik bo'yicha, 0,1 kg qadam yuqoriga", () => {
    expect(computeMeasureWeights(item(0.8, 50, 35, 20))).toMatchObject({ volumetricKg: 7, billableKg: 7, basis: "volume" });
    expect(computeMeasureWeights(item(0.84, 15, 10, 6))).toMatchObject({ volumetricKg: 0.18, billableKg: 0.9, basis: "weight" });
  });

  it("kalit o'chiq — faqat og'irlik (hajmli vazn baribir hisoblanadi)", () => {
    expect(computeMeasureWeights(item(0.9, 40, 30, 15, false))).toEqual({
      actualKg: 0.9,
      volumetricKg: 3.6,
      billableKg: 0.9,
      basis: "weight",
    });
  });

  it("eng kichik hisob vazni 0,1 kg; suzuvchi nuqta chiqindisi yo'q (2,0000000004 emas)", () => {
    expect(computeMeasureWeights(item(0.01, 1, 1, 1)).billableKg).toBe(0.1);
    expect(computeMeasureWeights(item(2, 10, 10, 10)).billableKg).toBe(2);
    expect(computeMeasureWeights(item(0.3, 10, 10, 10)).billableKg).toBe(0.3);
  });
});

describe("computeExtraKg / computeTariffTotal (47WFHzlx qabul mezoni)", () => {
  it("qo'shimcha kg — chegaradan oshgan har boshlangan kg", () => {
    expect(computeExtraKg(3.4, 1)).toBe(3);
    expect(computeExtraKg(3.4, 2)).toBe(2);
    expect(computeExtraKg(7, 1)).toBe(6);
    expect(computeExtraKg(1, 1)).toBe(0);
    expect(computeExtraKg(0.9, 1)).toBe(0);
    expect(computeExtraKg(1.1, 1)).toBe(1);
  });

  it("3,4 kg «Markazgacha»: chegara 1,0 → 52 000; 2,0 → 48 000; kg narxi 4 500 → 53 500", () => {
    const center = { basePrice: 40000, extraPerKg: 4000, roundTo: 500 };
    expect(computeTariffTotal({ ...center, billableKg: 3.4, firstKgIncluded: 1 })).toBe(52000);
    expect(computeTariffTotal({ ...center, billableKg: 3.4, firstKgIncluded: 2 })).toBe(48000);
    expect(computeTariffTotal({ ...center, extraPerKg: 4500, billableKg: 3.4, firstKgIncluded: 1 })).toBe(53500);
    expect(computeTariffTotal({ ...center, extraPerKg: 4500, billableKg: 7, firstKgIncluded: 1 })).toBe(67000);
    expect(computeTariffTotal({ ...center, billableKg: 1, firstKgIncluded: 1 })).toBe(40000);
  });

  it("jami `round_to` ga yaxlitlanadi", () => {
    expect(computeTariffTotal({ basePrice: 35100, extraPerKg: 0, roundTo: 500, billableKg: 1, firstKgIncluded: 1 })).toBe(35000);
    expect(computeTariffTotal({ basePrice: 35300, extraPerKg: 0, roundTo: 500, billableKg: 1, firstKgIncluded: 1 })).toBe(35500);
  });
});

/**
 * «Hajm bo'yicha hisoblash chegarasi» (`volumetric_from_kg`, ega 2026-10-25): hajmli vazn < chegara — faqat og'irlik
 * (asos `weight`); ≥ chegara — avvalgidek kattasi; 0 — avvalgi xulq (yuqoridagi vektorlar o'zgarmaydi).
 */
describe("hajm chegarasi (volumetricFromKg)", () => {
  const rules = (volumetricFromKg: number) => ({ ...DEFAULT_WEIGHT_RULES, volumetricFromKg });

  it("chegara 0 (sukut) — avvalgi natija bilan aynan bir xil", () => {
    for (const sample of [item(1.2, 30, 22, 15), item(0.8, 50, 35, 20), item(0.84, 15, 10, 6), item(0.9, 40, 30, 15, false)]) {
      expect(computeMeasureWeights(sample, rules(0))).toEqual(computeMeasureWeights(sample));
    }
    expect(DEFAULT_WEIGHT_RULES.volumetricFromKg).toBe(0);
    expect(meetsVolumetricThreshold(item(0.5, 20, 20, 20), rules(0))).toBe(true);
  });

  it("chegara 3: 20 × 20 × 20, 0,5 kg → hajmli 1,6 < 3 → hisob 0,5 kg (og'irlik bo'yicha)", () => {
    expect(computeMeasureWeights(item(0.5, 20, 20, 20), rules(3))).toEqual({
      actualKg: 0.5,
      volumetricKg: 1.6,
      billableKg: 0.5,
      basis: "weight",
    });
    expect(meetsVolumetricThreshold(item(0.5, 20, 20, 20), rules(3))).toBe(false);
    // Chegarasiz — hajm bo'yicha 1,6 kg.
    expect(computeMeasureWeights(item(0.5, 20, 20, 20), rules(0))).toMatchObject({ billableKg: 1.6, basis: "volume" });
  });

  it("chegara 3: 50 × 35 × 20, 0,8 kg → hajmli 7,0 ≥ 3 → hisob 7,0 kg (hajm bo'yicha)", () => {
    expect(computeMeasureWeights(item(0.8, 50, 35, 20), rules(3))).toEqual({
      actualKg: 0.8,
      volumetricKg: 7,
      billableKg: 7,
      basis: "volume",
    });
    expect(meetsVolumetricThreshold(item(0.8, 50, 35, 20), rules(3))).toBe(true);
  });

  it("aynan chegarada (30 × 25 × 20 = 3,0 kg, chegara 3) — hajm qo'llanadi (≥); 1 g kam — qo'llanmaydi", () => {
    expect(computeMeasureWeights(item(0.4, 30, 25, 20), rules(3))).toMatchObject({ volumetricKg: 3, billableKg: 3, basis: "volume" });
    expect(meetsVolumetricThreshold(item(0.4, 30, 25, 20), rules(3))).toBe(true);
    expect(meetsVolumetricThreshold(item(0.4, 30, 25, 20), rules(3.001))).toBe(false);
    expect(computeMeasureWeights(item(0.4, 30, 25, 20), rules(3.001))).toMatchObject({ billableKg: 0.4, basis: "weight" });
  });

  it("backend vektori: grammgacha yaxlitlangan hajmli vazn solishtiriladi — 14 × 17 × 21 (999,6 g → 1,0 kg), chegara 1 — qo'llanadi", () => {
    // Backend: `Math.round(volumeG) >= volumetricFromG` (999,6 → 1000 ≥ 1000) — ekranda «1,0 kg», qaror ham shu son.
    expect(meetsVolumetricThreshold(item(0.3, 14, 17, 21), rules(1))).toBe(true);
    expect(computeMeasureWeights(item(0.3, 14, 17, 21), rules(1))).toEqual({
      actualKg: 0.3,
      volumetricKg: 1,
      billableKg: 1,
      basis: "volume",
    });
    // 5 × 27 × 37 = 4995 sm³ = 999 g («0,999 kg») — chegara 1 dan kichik, qo'llanmaydi.
    expect(meetsVolumetricThreshold(item(0.3, 5, 27, 37), rules(1))).toBe(false);
    expect(computeMeasureWeights(item(0.3, 5, 27, 37), rules(1))).toMatchObject({ volumetricKg: 0.999, billableKg: 0.3, basis: "weight" });
  });

  it("hajm yo'q (o'lcham 0) — chegara 0 bo'lsa ham hajm qo'llanmaydi (backend `volumeCm3 > 0`)", () => {
    expect(meetsVolumetricThreshold(item(0.3, 0, 10, 10), rules(0))).toBe(false);
    expect(computeMeasureWeights(item(0.3, 0, 10, 10), rules(0))).toMatchObject({ billableKg: 0.3, basis: "weight" });
  });

  it("chegaradan kichik, og'irlik baribir katta — og'irlik; kalit o'chiq — chegaradan qat'i nazar faqat og'irlik", () => {
    expect(computeMeasureWeights(item(2.34, 20, 20, 20), rules(3))).toMatchObject({ billableKg: 2.4, basis: "weight" });
    expect(computeMeasureWeights(item(0.8, 50, 35, 20, false), rules(3))).toMatchObject({ billableKg: 0.8, basis: "weight" });
    expect(meetsVolumetricThreshold(item(0.8, 50, 35, 20, false), rules(0))).toBe(false);
  });

  it("toWeightRules — sozlamadan (chegara ham)", () => {
    expect(
      toWeightRules({
        id: "1",
        volumetricDivisor: 5000,
        volumetricFromKg: 3,
        firstKgIncluded: 1,
        minBillableKg: 0.1,
        billableStepKg: 0.1,
        roundTo: 500,
        pickupFee: 20000,
        pickupFreeFromCount: 10,
        expressMultiplier: 1.4,
      }),
    ).toEqual({ volumetricDivisor: 5000, billableStepKg: 0.1, minBillableKg: 0.1, volumetricFromKg: 3 });
  });
});
