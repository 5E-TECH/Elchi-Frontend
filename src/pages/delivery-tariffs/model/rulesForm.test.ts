import { describe, expect, it } from "vitest";
import { parseRuleValue, toRulesForm, toSettingsPatch, validateRule } from "./rulesForm";

const SETTINGS = {
  id: "1",
  volumetricDivisor: 5000,
  firstKgIncluded: 1,
  minBillableKg: 0.1,
  billableStepKg: 0.1,
  roundTo: 500,
  pickupFee: 20000,
  pickupFreeFromCount: 10,
  expressMultiplier: 1.4,
};

describe("hisob qoidalari — forma", () => {
  it("sozlama → maydonlar (maket: «1,0», «0,1», «500», «1,4», «20000», «10»)", () => {
    expect(toRulesForm(SETTINGS, "uz")).toEqual({
      firstKg: "1,0",
      minKg: "0,1",
      step: "0,1",
      roundTo: "500",
      express: "1,4",
      pickupFee: "20000",
      pickupFree: "10",
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
});
