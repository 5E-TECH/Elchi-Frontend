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
 * B0ILd7YI: «Minimal yetkazish narxi» (`min_delivery_price`) va «Kuryer qo'shimcha xarajati chegarasi»
 * (`extra_cost_limit_amount`) — so'm, butun ≥ 0 yoki bo'sh (`null` — chegara yo'q / sukut).
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
  minPrice: string;
  extraLimit: string;
};

export type RulesField = keyof RulesFormValues;

type Rule = {
  kind: "decimal" | "integer";
  min: number;
  max?: number;
  optional?: boolean;
  /** API maydoni. */
  key: keyof UpdateDeliveryPricingSettingsRequest;
  /** Saqlangan qiymat (`GET` javobidagi maydon) — «eski → yangi» va o'zgarishsiz maydonni tashlash uchun. */
  saved: keyof Omit<DeliveryPricingSettings, "id" | "volumetricDivisor">;
};

export const RULES: Record<RulesField, Rule> = {
  firstKg: { kind: "decimal", min: 0, max: 1000, key: "first_kg_included", saved: "firstKgIncluded" },
  volumetricFrom: { kind: "decimal", min: 0, max: 1000, key: "volumetric_from_kg", saved: "volumetricFromKg" },
  minKg: { kind: "decimal", min: 0.001, max: 1000, key: "min_billable_kg", saved: "minBillableKg" },
  step: { kind: "decimal", min: 0.001, max: 1000, key: "billable_step_kg", saved: "billableStepKg" },
  roundTo: { kind: "integer", min: 1, key: "round_to", saved: "roundTo" },
  express: { kind: "decimal", min: 1, key: "express_multiplier", saved: "expressMultiplier" },
  pickupFee: { kind: "integer", min: 0, key: "pickup_fee", saved: "pickupFee" },
  pickupFree: { kind: "integer", min: 1, optional: true, key: "pickup_free_from_count", saved: "pickupFreeFromCount" },
  minPrice: { kind: "integer", min: 0, optional: true, key: "min_delivery_price", saved: "minDeliveryPrice" },
  extraLimit: { kind: "integer", min: 0, optional: true, key: "extra_cost_limit_amount", saved: "extraCostLimitAmount" },
};

/** Forma tartibi — tasdiq oynasidagi «eski → yangi» qatorlari shu tartibda. */
export const RULES_ORDER: readonly RulesField[] = [
  "firstKg",
  "minKg",
  "step",
  "roundTo",
  "express",
  "pickupFee",
  "pickupFree",
  "volumetricFrom",
  "minPrice",
  "extraLimit",
];

/**
 * Faqat sotuvdagi narx dvigatelida ishlatiladigan maydonlar (`SALE_PRICING_ENGINE`, backend DARVOZA 1/2). Saytdagi narx
 * kalkulyatori (`computeDeliveryQuote`) ularni o'qimaydi — tasdiq oynasi oqibatlari shunga qarab tanlanadi.
 */
export const SALE_ONLY_RULES: ReadonlySet<RulesField> = new Set<RulesField>(["minPrice", "extraLimit"]);

/** Tasdiq oynasi oqibatlari uchun: o'zgarishlar narx hisobiga (sayt kalkulyatori ham) va / yoki faqat sotuvga tegadimi. */
export const changeImpact = (changes: readonly RuleChange[]) => ({
  quote: changes.some((change) => !SALE_ONLY_RULES.has(change.field)),
  saleOnly: changes.some((change) => SALE_ONLY_RULES.has(change.field)),
});

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
  minPrice: settings.minDeliveryPrice === null ? "" : String(Math.round(settings.minDeliveryPrice)),
  extraLimit: settings.extraCostLimitAmount === null ? "" : String(Math.round(settings.extraCostLimitAmount)),
});

/** Bitta qoida o'zgarishi: `from` — saqlangan, `to` — yuboriladigan qiymat (`null` — bo'sh). */
export type RuleChange = { field: RulesField; from: number | null; to: number | null };

/**
 * O'zgargan qoidalar (`RULES_ORDER` tartibida): tegilgan (`dirty`) va qiymati saqlangandan farq qiladigan maydonlar.
 * «1,0» ni «1» ga almashtirish — o'zgarish emas (son bir xil); bo'sh ixtiyoriy maydon — `null`.
 */
export const diffRules = (
  values: RulesFormValues,
  dirty: Partial<Record<RulesField, boolean | undefined>>,
  saved?: DeliveryPricingSettings,
): RuleChange[] =>
  RULES_ORDER.flatMap((field): RuleChange[] => {
    if (!dirty[field]) return [];
    const to = parseRuleValue(values[field]);
    if (to === null && !RULES[field].optional) return [];
    const from = saved ? saved[RULES[field].saved] : null;
    if (saved && (from === null ? to === null : to !== null && Math.abs(from - to) < 1e-9)) return [];
    return [{ field, from, to }];
  });

/** `PATCH` tanasi — `diffRules` dan (hech narsa o'zgarmasa — bo'sh obyekt). */
export const toPatchBody = (changes: readonly RuleChange[]): UpdateDeliveryPricingSettingsRequest =>
  Object.fromEntries(changes.map((change) => [RULES[change.field].key, change.to])) as UpdateDeliveryPricingSettingsRequest;

/**
 * `PATCH` tanasi — faqat o'zgargan maydonlar (hech narsa o'zgarmasa — bo'sh obyekt). `saved` berilsa — qiymati
 * saqlangan bilan bir xil maydon ham tashlanadi.
 */
export const toSettingsPatch = (
  values: RulesFormValues,
  dirty: Partial<Record<RulesField, boolean | undefined>>,
  saved?: DeliveryPricingSettings,
): UpdateDeliveryPricingSettingsRequest => toPatchBody(diffRules(values, dirty, saved));
