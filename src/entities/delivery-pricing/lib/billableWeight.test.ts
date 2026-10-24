import { describe, expect, it } from "vitest";
import { computeExtraKg, computeMeasureWeights, computeTariffTotal } from "./billableWeight";

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
