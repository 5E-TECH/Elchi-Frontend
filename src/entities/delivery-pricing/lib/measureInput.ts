import type { DeliveryMeasureItem } from "../model/types";

/**
 * O'LCHOV MAYDONLARI (mahsulot formasi, narx kalkulyatori) — matn maydoni (harf / manfiy son yozilsa xato
 * ko'rsatiladi, jim tozalanmaydi). Chegaralar backend bilan bir xil (catalog `POST /product`, 9fHyFp3y):
 * og'irlik ko'pi bilan 3 kasr va 1000 kg gacha; o'lcham butun son 1…1000 sm. Eng kichik og'irlik 0,1 kg —
 * maket (`*-products-create-errors`: «kamida 0,1 kg»; undan yengil posilka baribir 0,1 kg hisoblanadi).
 */
export const WEIGHT_MIN_KG = 0.1;
export const WEIGHT_MAX_KG = 1000;
export const WEIGHT_MAX_DECIMALS = 3;
export const DIMENSION_MIN_CM = 1;
export const DIMENSION_MAX_CM = 1000;

/** Maydon matnidagi son: bo'sh joylar olib tashlanadi, vergul — nuqta («0,8» = «0.8»). */
const NUMBER_PATTERN = /^-?\d+(?:\.\d+)?$/;

const normalize = (raw: string): string => raw.replace(/\s/g, "").replace(",", ".");

export type WeightIssue = "empty" | "notNumber" | "min" | "max" | "precision";
export type DimensionIssue = "empty" | "notNumber" | "notPositiveInteger" | "max";

/** Og'irlik maydoni xatosi (`null` — to'g'ri). */
export const checkWeightInput = (raw: string): WeightIssue | null => {
  const value = normalize(raw);
  if (!value) return "empty";
  if (!NUMBER_PATTERN.test(value)) return "notNumber";
  const number = Number(value);
  if (number < WEIGHT_MIN_KG) return "min";
  if (number > WEIGHT_MAX_KG) return "max";
  if ((value.split(".")[1]?.replace(/0+$/, "").length ?? 0) > WEIGHT_MAX_DECIMALS) return "precision";
  return null;
};

/** O'lcham maydoni xatosi (`null` — to'g'ri). */
export const checkDimensionInput = (raw: string): DimensionIssue | null => {
  const value = normalize(raw);
  if (!value) return "empty";
  if (!NUMBER_PATTERN.test(value)) return "notNumber";
  const number = Number(value);
  if (!Number.isInteger(number) || number < DIMENSION_MIN_CM) return "notPositiveInteger";
  if (number > DIMENSION_MAX_CM) return "max";
  return null;
};

/** To'g'ri og'irlik soni yoki `null`. */
export const parseWeightInput = (raw: string): number | null =>
  checkWeightInput(raw) === null ? Number(normalize(raw)) : null;

/** To'g'ri o'lcham (butun sm) yoki `null`. */
export const parseDimensionInput = (raw: string): number | null =>
  checkDimensionInput(raw) === null ? Number(normalize(raw)) : null;

/** Maydonlar qiymati (matn) — forma va kalkulyator bir xil shaklda saqlaydi. */
export type MeasureInputValues = {
  weight: string;
  length: string;
  width: string;
  height: string;
  volumetric: boolean;
};

export const EMPTY_MEASURE_INPUT: MeasureInputValues = Object.freeze({
  weight: "",
  length: "",
  width: "",
  height: "",
  volumetric: true,
});

/** To'rttala maydon to'g'ri bo'lsa — narx so'rovi elementi, aks holda `null` (so'rov ketmaydi, «Hisoblab bo'lmadi»). */
export const toMeasureItem = (values: MeasureInputValues): DeliveryMeasureItem | null => {
  const weight = parseWeightInput(values.weight);
  const length = parseDimensionInput(values.length);
  const width = parseDimensionInput(values.width);
  const height = parseDimensionInput(values.height);
  if (weight === null || length === null || width === null || height === null) return null;
  return {
    weight_kg: weight,
    length_cm: length,
    width_cm: width,
    height_cm: height,
    volumetric_enabled: values.volumetric,
  };
};

/**
 * Saqlangan og'irlik (son yoki `"0.800"`) → maydon matni: ortiqcha nolsiz, uz/ru da vergul («0,8»), en da nuqta.
 * Yaroqsiz yoki yo'q — bo'sh satr.
 */
export const toWeightInput = (value: unknown, language?: string | null): string => {
  if (value === null || value === undefined || value === "") return "";
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "";
  const text = String(Number(number.toFixed(WEIGHT_MAX_DECIMALS)));
  return (language ?? "uz").toLowerCase().startsWith("en") ? text : text.replace(".", ",");
};

/** Saqlangan o'lcham → maydon matni (butun musbat son), aks holda bo'sh. */
export const toDimensionInput = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "";
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? String(number) : "";
};

/** API'ga yuboriladigan og'irlik satri (nuqta bilan, ortiqcha nolsiz) — to'g'ri qiymat uchun. */
export const toWeightPayload = (raw: string): string => {
  const weight = parseWeightInput(raw);
  return weight === null ? normalize(raw) : String(weight);
};

/** API'ga yuboriladigan o'lcham satri (butun son). */
export const toDimensionPayload = (raw: string): string => {
  const dimension = parseDimensionInput(raw);
  return dimension === null ? normalize(raw) : String(dimension);
};
