import { describe, expect, it } from "vitest";
import {
  changeImpact,
  diffRules,
  parseRuleValue,
  RULES,
  RULES_ORDER,
  toPatchBody,
  toRulesForm,
  toSettingsPatch,
  validateRule,
} from "./rulesForm";

const SETTINGS = {
  id: "1",
  volumetricDivisor: 5000,
  volumetricFromKg: 0,
  firstKgIncluded: 1,
  minBillableKg: 0.1,
  billableStepKg: 0.1,
  roundTo: 500,
  pickupFee: 20000,
  pickupFreeFromCount: 10,
  expressMultiplier: 1.4,
  minDeliveryPrice: null,
  extraCostLimitAmount: null,
};

describe("hisob qoidalari — forma", () => {
  it("sozlama → maydonlar (maket: «1,0», «0,1», «500», «1,4», «20000», «10»)", () => {
    expect(toRulesForm(SETTINGS, "uz")).toEqual({
      firstKg: "1,0",
      volumetricFrom: "0,0",
      minKg: "0,1",
      step: "0,1",
      roundTo: "500",
      express: "1,4",
      pickupFee: "20000",
      pickupFree: "10",
      minPrice: "",
      extraLimit: "",
    });
    expect(toRulesForm({ ...SETTINGS, pickupFreeFromCount: null }, "en")).toMatchObject({ firstKg: "1.0", pickupFree: "" });
  });

  it("PATCH — faqat o'zgargan maydonlar; bo'sh «Pickup tekin» — `null`", () => {
    const values = { ...toRulesForm(SETTINGS, "uz"), firstKg: "2,0", pickupFree: "" };
    expect(toSettingsPatch(values, { firstKg: true, pickupFree: true })).toEqual({
      first_kg_included: 2,
      pickup_free_from_count: null,
    });
    expect(toSettingsPatch(values, {})).toEqual({});
  });

  it("tekshiruv backend chegaralari bilan", () => {
    expect(validateRule("firstKg")("")).toBe("page.rules.errors.required");
    expect(validateRule("firstKg")("abc")).toBe("page.rules.errors.notNumber");
    expect(validateRule("firstKg")("1001")).toBe("page.rules.errors.range");
    expect(validateRule("firstKg")("0")).toBe(true);
    expect(validateRule("minKg")("0")).toBe("page.rules.errors.range");
    expect(validateRule("step")("0,1255")).toBe("page.rules.errors.precision");
    expect(validateRule("roundTo")("0")).toBe("page.rules.errors.min");
    expect(validateRule("express")("0,9")).toBe("page.rules.errors.min");
    expect(validateRule("express")("1,4")).toBe(true);
    expect(validateRule("pickupFree")("")).toBe(true);
    expect(validateRule("pickupFree")("2,5")).toBe("page.rules.errors.integer");
    expect(parseRuleValue("1 000,5")).toBe(1000.5);
    expect(parseRuleValue("x")).toBeNull();
  });

  it("«Hajm bo'yicha hisoblash chegarasi» (volumetric_from_kg): sozlama → maydon, PATCH, tekshiruv 0..1000, 3 kasr", () => {
    expect(toRulesForm({ ...SETTINGS, volumetricFromKg: 3 }, "uz").volumetricFrom).toBe("3,0");
    expect(toRulesForm({ ...SETTINGS, volumetricFromKg: 2.5 }, "en").volumetricFrom).toBe("2.5");
    const values = { ...toRulesForm(SETTINGS, "uz"), volumetricFrom: "3" };
    expect(toSettingsPatch(values, { volumetricFrom: true })).toEqual({ volumetric_from_kg: 3 });
    expect(toSettingsPatch({ ...values, volumetricFrom: "0" }, { volumetricFrom: true })).toEqual({ volumetric_from_kg: 0 });
    // O'zgarmagan bo'lsa yuborilmaydi.
    expect(toSettingsPatch(values, { firstKg: true })).toEqual({ first_kg_included: 1 });

    expect(validateRule("volumetricFrom")("0")).toBe(true);
    expect(validateRule("volumetricFrom")("1,5")).toBe(true);
    expect(validateRule("volumetricFrom")("1000")).toBe(true);
    expect(validateRule("volumetricFrom")("1000,001")).toBe("page.rules.errors.range");
    expect(validateRule("volumetricFrom")("2,1255")).toBe("page.rules.errors.precision");
    expect(validateRule("volumetricFrom")("-1")).toBe("page.rules.errors.notNumber");
    expect(validateRule("volumetricFrom")("")).toBe("page.rules.errors.required");
  });

  it("«eski → yangi» (B0ILd7YI): faqat soni haqiqatan o'zgargan maydonlar, forma tartibida; «1,0» → «1» — o'zgarish emas", () => {
    const values = { ...toRulesForm(SETTINGS, "uz"), firstKg: "1", roundTo: "1000", pickupFree: "", express: "1,40" };
    const dirty = { firstKg: true, roundTo: true, pickupFree: true, express: true };
    const changes = diffRules(values, dirty, SETTINGS);
    expect(changes).toEqual([
      { field: "roundTo", from: 500, to: 1000 },
      { field: "pickupFree", from: 10, to: null },
    ]);
    expect(toPatchBody(changes)).toEqual({ round_to: 1000, pickup_free_from_count: null });
    expect(toSettingsPatch(values, dirty, SETTINGS)).toEqual({ round_to: 1000, pickup_free_from_count: null });
    // Hammasi saqlangandek — so'rov yo'q (vaqt tugagach qayta bosish ham ikkinchi versiya yaratmaydi).
    expect(diffRules(toRulesForm(SETTINGS, "uz"), { firstKg: true, step: true }, SETTINGS)).toEqual([]);
  });

  it("sotuv chegaralari: «Minimal yetkazish narxi» va «Kuryer qo'shimcha xarajati chegarasi» — butun ≥ 0 yoki bo'sh (`null`)", () => {
    const saved = { ...SETTINGS, minDeliveryPrice: 15000, extraCostLimitAmount: null };
    expect(toRulesForm(saved, "uz")).toMatchObject({ minPrice: "15000", extraLimit: "" });
    const values = { ...toRulesForm(saved, "uz"), minPrice: "", extraLimit: "20000" };
    expect(diffRules(values, { minPrice: true, extraLimit: true }, saved)).toEqual([
      { field: "minPrice", from: 15000, to: null },
      { field: "extraLimit", from: null, to: 20000 },
    ]);
    expect(toSettingsPatch(values, { minPrice: true, extraLimit: true }, saved)).toEqual({
      min_delivery_price: null,
      extra_cost_limit_amount: 20000,
    });

    expect(validateRule("minPrice")("")).toBe(true);
    expect(validateRule("minPrice")("0")).toBe(true);
    expect(validateRule("minPrice")("15000")).toBe(true);
    expect(validateRule("minPrice")("150,5")).toBe("page.rules.errors.integer");
    expect(validateRule("extraLimit")("-1")).toBe("page.rules.errors.notNumber");
    expect(validateRule("extraLimit")("")).toBe(true);
  });
});

describe("hisob qoidalari — tartib va oqibatlar (B0ILd7YI)", () => {
  it("RULES_ORDER har maydonni aynan bir marta o'z ichiga oladi (yangi maydon unutilmasin)", () => {
    expect([...RULES_ORDER].sort()).toEqual(Object.keys(RULES).sort());
    expect(new Set(RULES_ORDER).size).toBe(RULES_ORDER.length);
  });

  it("changeImpact: narx qoidasi — sayt kalkulyatori ham; minimal narx / kuryer chegarasi — faqat sotuv", () => {
    expect(changeImpact([{ field: "firstKg", from: 1, to: 2 }])).toEqual({ quote: true, saleOnly: false });
    expect(changeImpact([{ field: "minPrice", from: null, to: 15000 }])).toEqual({ quote: false, saleOnly: true });
    expect(
      changeImpact([
        { field: "extraLimit", from: 20000, to: null },
        { field: "roundTo", from: 500, to: 1000 },
      ]),
    ).toEqual({ quote: true, saleOnly: true });
  });
});
