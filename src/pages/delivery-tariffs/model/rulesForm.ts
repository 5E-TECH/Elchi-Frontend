import type {
  DeliveryPricingSettings,
  UpdateDeliveryPricingSettingsRequest,
} from "../../../entities/delivery-pricing";

/**
 * «HISOB QOIDALARI» (`GET / PATCH /delivery/pricing-settings`) — forma qiymatlari matn ko'rinishida. Chegaralar
 * backend DTO bilan bir xil (`UpdateDeliveryPricingSettingsRequestDto`): o'nli kg maydonlari ko'pi bilan 3 kasr,
 * `round_to` butun ≥ 1, `pickup_fee` ≥ 0, `pickup_free_from_count` butun ≥ 1 yoki bo'sh (`null` — hech qachon tekin
 * emas), `express_multiplier` ≥ 1, `volumetric_from_kg` («Hajm bo'yicha hisoblash chegarasi») 0..1000, 3 kasr
 * (0 — har doim hajm bo'yicha). `volumetric_divisor` — doimiy, faqat ko'rsatiladi (yuborilmaydi).
 */
export type RulesFormValues = {
  firstKg: string;
  volumetricFrom: string;
  minKg: string;
  step: string;
  roundTo: string;
  express: string;
  pickupFee: string;
  pickupFree: string;
};

export type RulesField = keyof RulesFormValues;

type Rule = {
  kind: "decimal" | "integer";
  min: number;
  max?: number;
  optional?: boolean;
  /** API maydoni. */
  key: keyof UpdateDeliveryPricingSettingsRequest;
};

export const RULES: Record<RulesField, Rule> = {
  firstKg: { kind: "decimal", min: 0, max: 1000, key: "first_kg_included" },
  volumetricFrom: { kind: "decimal", min: 0, max: 1000, key: "volumetric_from_kg" },
  minKg: { kind: "decimal", min: 0.001, max: 1000, key: "min_billable_kg" },
  step: { kind: "decimal", min: 0.001, max: 1000, key: "billable_step_kg" },
  roundTo: { kind: "integer", min: 1, key: "round_to" },
  express: { kind: "decimal", min: 1, key: "express_multiplier" },
  pickupFee: { kind: "integer", min: 0, key: "pickup_fee" },
  pickupFree: { kind: "integer", min: 1, optional: true, key: "pickup_free_from_count" },
};

const normalize = (value: string) => value.replace(/\s/g, "").replace(",", ".");
const NUMBER = /^\d+(?:\.\d+)?$/;

/** Maydon qiymati → son (`null` — bo'sh yoki noto'g'ri). */
export const parseRuleValue = (value: string): number | null => {
  const text = normalize(value);
  return NUMBER.test(text) ? Number(text) : null;
};

/** react-hook-form `validate`: `true` yoki `deliveryPricing` kaliti (parametrlari — `RULES[field]`). */
export const validateRule =
  (field: RulesField) =>
  (value: string): true | string => {
    const rule = RULES[field];
    const text = normalize(value);
    if (!text) return rule.optional ? true : "page.rules.errors.required";
    if (!NUMBER.test(text)) return "page.rules.errors.notNumber";
    const number = Number(text);
    if (rule.kind === "integer" && !Number.isInteger(number)) return "page.rules.errors.integer";
    if (rule.kind === "decimal" && (text.split(".")[1]?.replace(/0+$/, "").length ?? 0) > 3)
      return "page.rules.errors.precision";
    if (number < rule.min || (rule.max !== undefined && number > rule.max))
      return rule.max !== undefined ? "page.rules.errors.range" : "page.rules.errors.min";
    return true;
  };

/** O'nli kg: kamida bitta kasr («1,0», «0,1»), uz/ru vergul, en nuqta. */
const decimalInput = (value: number, language?: string | null) => {
  const text = String(Number(value.toFixed(3)));
  const withFraction = text.includes(".") ? text : `${text}.0`;
  return (language ?? "uz").toLowerCase().startsWith("en") ? withFraction : withFraction.replace(".", ",");
};

export const toRulesForm = (settings: DeliveryPricingSettings, language?: string | null): RulesFormValues => ({
  firstKg: decimalInput(settings.firstKgIncluded, language),
  volumetricFrom: decimalInput(settings.volumetricFromKg, language),
  minKg: decimalInput(settings.minBillableKg, language),
  step: decimalInput(settings.billableStepKg, language),
  roundTo: String(Math.round(settings.roundTo)),
  express: decimalInput(settings.expressMultiplier, language),
  pickupFee: String(Math.round(settings.pickupFee)),
  pickupFree: settings.pickupFreeFromCount === null ? "" : String(settings.pickupFreeFromCount),
});

/** `PATCH` tanasi — faqat o'zgargan maydonlar (hech narsa o'zgarmasa — bo'sh obyekt). */
export const toSettingsPatch = (
  values: RulesFormValues,
  dirty: Partial<Record<RulesField, boolean | undefined>>,
): UpdateDeliveryPricingSettingsRequest => {
  const body: Record<string, number | null> = {};
  for (const field of Object.keys(RULES) as RulesField[]) {
    if (!dirty[field]) continue;
    const parsed = parseRuleValue(values[field]);
    if (parsed === null && !RULES[field].optional) continue;
    body[RULES[field].key] = parsed;
  }
  return body as UpdateDeliveryPricingSettingsRequest;
};
