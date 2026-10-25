import type { DeliveryMeasureItem, DeliveryPricingSettings } from "../model/types";

/**
 * HISOB VAZNI — backend `libs/common/src/pricing/delivery-pricing.ts` (`computeDeliveryQuote`) bilan AYNI formula,
 * butun sonlar arifmetikasida (gramm, sm³, tiyin) — suzuvchi nuqta chiqindisi yo'q:
 *   hajmli vazn = U × K × B / bo'luvchi (5000);
 *   hisob vazni = max( yuqoriga(max(og'irlik, hajmli), qadam 0,1 kg), minimal 0,1 kg );
 *   «Hajmga qarab hisoblash» o'chiq — faqat og'irlik (hajm baribir ko'rsatiladi, chizilgan holda);
 *   hajmli vazn «Hajm bo'yicha hisoblash chegarasi» (`volumetric_from_kg`) dan kichik — ham faqat og'irlik
 *   (chegara 3 kg: 20×20×20, 0,5 kg → 1,6 < 3 → 0,5 kg; aynan 3,0 — hajm qo'llanadi); chegara 0 — avvalgi xulq.
 * Forma jonli ko'rsatkichi va ro'yxatdagi «Hisob vazni» shu yerdan; NARX esa serverdan (`total`).
 */

/** Ega qarori: doimiy, sozlamada faqat ko'rsatiladi (`volumetric_divisor`). */
export const VOLUMETRIC_DIVISOR = 5000;

export type WeightRules = {
  volumetricDivisor: number;
  billableStepKg: number;
  minBillableKg: number;
  /** «Hajm bo'yicha hisoblash chegarasi», kg: hajmli vazn shundan kichik — hajm hisobga olinmaydi; 0 (sukut) — har doim. */
  volumetricFromKg?: number;
};

/** Backend boshlang'ich sozlamalari (`delivery_pricing_settings`). */
export const DEFAULT_WEIGHT_RULES: WeightRules = Object.freeze({
  volumetricDivisor: VOLUMETRIC_DIVISOR,
  billableStepKg: 0.1,
  minBillableKg: 0.1,
  volumetricFromKg: 0,
});

/** Sozlamadan hisob vazni qoidalari (kalkulyator, mahsulot formasi — superadmin/admin). */
export const toWeightRules = (settings: DeliveryPricingSettings): WeightRules => ({
  volumetricDivisor: settings.volumetricDivisor,
  billableStepKg: settings.billableStepKg,
  minBillableKg: settings.minBillableKg,
  volumetricFromKg: settings.volumetricFromKg,
});

export type MeasureWeights = {
  actualKg: number;
  /** Hajmli vazn (gramm aniqligida: 30×22×15 → 1,98 kg) — kalit o'chiq bo'lsa ham hisoblanadi. */
  volumetricKg: number;
  /** Hisob vazni (qadam bilan yuqoriga: 1,98 → 2,0 kg). */
  billableKg: number;
  /** Narx qaysi vazndan: hajm qo'llangan (kalit yoqiq, chegaradan kichik emas) va og'irlikdan katta — `volume`. */
  basis: "weight" | "volume";
};

const toGrams = (kg: number): number => Math.round(kg * 1000);
const toTiyin = (som: number): number => Math.round(som * 100);

const divisorOf = (rules: WeightRules) => (rules.volumetricDivisor > 0 ? rules.volumetricDivisor : VOLUMETRIC_DIVISOR);

/**
 * Hajm hisobga olinadimi: kalit yoqiq VA hajmli vazn ≥ chegara (`volumetricFromKg`; 0 — har doim). Taqqoslash butun
 * sonlarda: U × K × B × 1000 ≥ chegara (g) × bo'luvchi — aynan chegarada (30×25×20 = 3,0 kg, chegara 3) qo'llanadi.
 */
export const meetsVolumetricThreshold = (
  item: DeliveryMeasureItem,
  rules: WeightRules = DEFAULT_WEIGHT_RULES,
): boolean => {
  if (!item.volumetric_enabled) return false;
  const thresholdG = Math.max(0, toGrams(rules.volumetricFromKg ?? 0));
  return item.length_cm * item.width_cm * item.height_cm * 1000 >= thresholdG * divisorOf(rules);
};

export const computeMeasureWeights = (
  item: DeliveryMeasureItem,
  rules: WeightRules = DEFAULT_WEIGHT_RULES,
): MeasureWeights => {
  const stepG = Math.max(1, toGrams(rules.billableStepKg));
  const divisor = divisorOf(rules);
  const actualG = toGrams(item.weight_kg);
  const volumeCm3 = item.length_cm * item.width_cm * item.height_cm;
  const volumeG = (volumeCm3 * 1000) / divisor;
  const applied = meetsVolumetricThreshold(item, rules);
  const actualSteps = Math.ceil(actualG / stepG);
  const volumeSteps = applied ? Math.ceil((volumeCm3 * 1000) / (divisor * stepG)) : 0;
  const billableG = Math.max(Math.max(actualSteps, volumeSteps) * stepG, toGrams(rules.minBillableKg));
  return {
    actualKg: actualG / 1000,
    volumetricKg: Math.round(volumeG) / 1000,
    billableKg: billableG / 1000,
    basis: applied && volumeG > actualG ? "volume" : "weight",
  };
};

/** Backend landing bilan moslik uchun saqlagan EPS (butun sonlarda natijaga ta'sir qilmaydi). */
const EPS = 1e-9;

/**
 * Asosiy narxdan ortiq to'liq kg: `yuqoriga(hisob vazni − chegara)`. Chegara 1,0 kg: 3,4 kg → 3; 2,0 kg: 3,4 kg → 2.
 */
export const computeExtraKg = (billableKg: number, firstKgIncluded: number): number =>
  Math.max(0, Math.ceil((toGrams(billableKg) - toGrams(firstKgIncluded)) / 1000 - EPS));

/**
 * Tarif narxi (namunaviy posilkalar «hozir → yangi», kalkulyator taxmini): asosiy narx + qo'shimcha kg × kg narxi,
 * `round_to` ga yaxlitlangan. Haqiqiy narx — server (`total`); bu faqat oldindan ko'rsatish uchun.
 */
export const computeTariffTotal = ({
  billableKg,
  basePrice,
  extraPerKg,
  firstKgIncluded,
  roundTo,
}: {
  billableKg: number;
  basePrice: number;
  extraPerKg: number;
  firstKgIncluded: number;
  roundTo: number;
}): number => {
  const subtotalT = toTiyin(basePrice) + computeExtraKg(billableKg, firstKgIncluded) * toTiyin(extraPerKg);
  const roundT = Math.max(1, toTiyin(roundTo));
  return (Math.round(subtotalT / roundT) * roundT) / 100;
};
