import {
  checkDimensionInput,
  checkWeightInput,
  computeMeasureWeights,
  EMPTY_MEASURE_INPUT,
  parseDimensionInput,
  toDimensionInput,
  toDimensionPayload,
  toWeightInput,
  toWeightPayload,
  type DimensionIssue,
  type MeasureInputValues,
  type WeightIssue,
} from "../../../entities/delivery-pricing";
import type { Product } from "./productView";

/**
 * MAHSULOT O'LCHOVI (6FLyjO6j; backend MH-3, 9fHyFp3y) — yaratish sahifasi va tahrirlash oynasi bir xil:
 * og'irlik (kg) + U × K × B (sm, butun) MAJBURIY, «Hajmga qarab hisoblash» (sukut yoqiq). Tekshiruv forma darajasida —
 * backend 400 ga tushmaydi. Xato matni i18n KALITI sifatida saqlanadi va chizishda tarjima qilinadi: til
 * almashtirilsa xabar ham yangi tilda (modul yuklanishida muzlatilmaydi).
 */

/** Ikkala forma (yaratish sahifasi, tahrirlash oynasi) qiymatlari. */
export type ProductFormValues = { name: string; price: string } & MeasureInputValues;

export const EMPTY_PRODUCT_FORM: ProductFormValues = { name: "", price: "", ...EMPTY_MEASURE_INPUT };

export type MeasureField = keyof MeasureInputValues;
export type DimensionField = "length" | "width" | "height";
export const DIMENSION_FIELDS: readonly DimensionField[] = ["length", "width", "height"];

/** Mahsulot → o'lchov maydonlari (o'lchovsiz eski mahsulot — bo'sh maydonlar, kalit yoqiq). */
export const toProductMeasureForm = (product: Product | null | undefined, language?: string | null): MeasureInputValues => ({
  weight: toWeightInput(product?.weight_kg, language),
  length: toDimensionInput(product?.length_cm),
  width: toDimensionInput(product?.width_cm),
  height: toDimensionInput(product?.height_cm),
  volumetric: product?.volumetric_enabled !== false,
});

const WEIGHT_ERROR_KEY: Record<WeightIssue, string> = {
  empty: "v2.measure.errors.weightRequired",
  notNumber: "v2.measure.errors.notNumber",
  min: "v2.measure.errors.weightMin",
  max: "v2.measure.errors.weightMax",
  precision: "v2.measure.errors.weightPrecision",
};

const DIMENSION_ERROR_KEY: Record<Exclude<DimensionIssue, "empty">, string> = {
  notNumber: "v2.measure.errors.notNumber",
  notPositiveInteger: "v2.measure.errors.dimensionInteger",
  max: "v2.measure.errors.dimensionMax",
};

const DIMENSION_REQUIRED_KEY: Record<DimensionField, string> = {
  length: "v2.measure.errors.lengthRequired",
  width: "v2.measure.errors.widthRequired",
  height: "v2.measure.errors.heightRequired",
};

/** react-hook-form `validate`: `true` yoki xato kaliti (`products` nomlar fazosida). */
export const validateWeight = (value: string): true | string => {
  const issue = checkWeightInput(value);
  return issue ? WEIGHT_ERROR_KEY[issue] : true;
};

/** Ixtiyoriy rejim (o'lchovsiz eski mahsulot tahriri, ega qarori 2026-10-24): bo'sh og'irlik — xato emas. */
export const validateOptionalWeight = (value: string): true | string =>
  value.trim() === "" ? true : validateWeight(value);

const isBlank = (value: string | undefined) => (value ?? "").trim() === "";

/**
 * `optional` — o'lchovsiz eski mahsulot tahriri: uchala o'lcham bo'sh bo'lsa xato yo'q; bittasi kiritilsa qolganlari
 * majburiy (backend U / K / B ni faqat birga qabul qiladi).
 */
export const validateDimension =
  (field: DimensionField, options?: { optional?: boolean }) =>
  (value: string, values?: Partial<MeasureInputValues>): true | string => {
    if (options?.optional && isBlank(value) && DIMENSION_FIELDS.every((name) => isBlank(values?.[name]))) return true;
    const issue = checkDimensionInput(value);
    if (!issue) return true;
    return issue === "empty" ? DIMENSION_REQUIRED_KEY[field] : DIMENSION_ERROR_KEY[issue];
  };

/**
 * FormData'ga o'lchov. Yangi mahsulot (`dirty` yo'q) — to'rttala o'lchov + kalit. Tahrir — faqat o'zgarganlari
 * (backend: bo'sh yoki `null` — 400; o'zgarmagan maydon yuborilmaydi), U / K / B — uchalasi birga (bittasi o'zgarsa
 * ham; o'lchovsiz eski mahsulotga bittasini yuborish — 400).
 */
export const appendProductMeasure = (
  formData: FormData,
  values: MeasureInputValues,
  dirty?: Partial<Record<MeasureField, boolean | undefined>>,
): void => {
  const all = !dirty;
  // Tahrirda bo'sh qoldirilgan maydon yuborilmaydi (o'lchovsiz eski mahsulot — ixtiyoriy; backend bo'sh qiymatga 400).
  if (all || (dirty.weight && !isBlank(values.weight))) formData.append("weight_kg", toWeightPayload(values.weight));
  if (all || (DIMENSION_FIELDS.some((field) => dirty[field]) && !DIMENSION_FIELDS.every((field) => isBlank(values[field])))) {
    formData.append("length_cm", toDimensionPayload(values.length));
    formData.append("width_cm", toDimensionPayload(values.width));
    formData.append("height_cm", toDimensionPayload(values.height));
  }
  if (all || dirty.volumetric) formData.append("volumetric_enabled", String(values.volumetric));
};

/** Ro'yxatdagi ko'rinish: «Og'irlik», «O'lcham, sm», «Hisob vazni» ustunlari. */
export type ProductMeasureView = {
  weightKg: number | null;
  dimensions: { length: number; width: number; height: number } | null;
  /** Og'irlik va uchala o'lcham bor — hisob vazni chiqadi; aks holda «Kiritilmagan». */
  complete: boolean;
  billableKg: number | null;
  /** `volumeOff` — kalit o'chiq («hajm hisobga olinmaydi»). */
  basis: "weight" | "volume" | "volumeOff" | null;
};

const positiveNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};

export const getProductMeasureView = (product: Product): ProductMeasureView => {
  const weightKg = positiveNumber(product.weight_kg);
  const length = parseDimensionInput(String(product.length_cm ?? ""));
  const width = parseDimensionInput(String(product.width_cm ?? ""));
  const height = parseDimensionInput(String(product.height_cm ?? ""));
  const dimensions = length !== null && width !== null && height !== null ? { length, width, height } : null;
  const volumetric = product.volumetric_enabled !== false;
  if (weightKg === null || dimensions === null) {
    return { weightKg, dimensions, complete: false, billableKg: null, basis: null };
  }
  const weights = computeMeasureWeights({
    weight_kg: weightKg,
    length_cm: dimensions.length,
    width_cm: dimensions.width,
    height_cm: dimensions.height,
    volumetric_enabled: volumetric,
  });
  return {
    weightKg,
    dimensions,
    complete: true,
    billableKg: weights.billableKg,
    basis: volumetric ? weights.basis : "volumeOff",
  };
};
