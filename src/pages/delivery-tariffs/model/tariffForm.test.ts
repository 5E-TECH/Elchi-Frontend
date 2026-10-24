import { describe, expect, it } from "vitest";
import {
  addDays,
  toIsoDay,
  toTariffForm,
  toTariffPayload,
  validateDays,
  validateDaysMax,
  validateMoney,
  validateValidFrom,
} from "./tariffForm";

const CENTER = {
  id: "2",
  tariffId: "center" as const,
  basePrice: 40000,
  extraPerKg: 4000,
  daysMin: 1,
  daysMax: 2,
  validFrom: "2026-10-08T00:00:00+05:00",
  createdAt: null,
  createdBy: null,
};

describe("tarif oynasi — forma va tana", () => {
  it("joriy tarifdan to'ladi, sana sukut — ertaga", () => {
    expect(toTariffForm(CENTER, "2026-10-24")).toEqual({
      base: "40000",
      perKg: "4000",
      daysMin: "1",
      daysMax: "2",
      validFrom: "2026-10-25",
    });
    expect(toTariffForm(null, "2026-12-31").validFrom).toBe("2027-01-01");
    expect(toTariffForm(null, "2026-10-24").base).toBe("");
  });

  it("kelajak sana — `valid_from` Toshkent 00:00 bilan (rejalashtirilgan); bugun — `valid_from` siz (darhol)", () => {
    const values = { base: "40000", perKg: "4500", daysMin: "1", daysMax: "2", validFrom: "2026-10-25" };
    expect(toTariffPayload("center", values, "2026-10-24")).toEqual({
      tariff_id: "center",
      base_price: 40000,
      extra_per_kg: 4500,
      days_min: 1,
      days_max: 2,
      valid_from: "2026-10-25T00:00:00+05:00",
    });
    expect(toTariffPayload("center", { ...values, validFrom: "2026-10-24" }, "2026-10-24")).not.toHaveProperty("valid_from");
  });

  it("tekshiruv: bo'sh, juda katta narx, 365 kundan ko'p, eng ko'p < eng kam, o'tgan sana", () => {
    expect(validateMoney("")).toBe("page.edit.errors.required");
    expect(validateMoney("1234567890123")).toBe("page.edit.errors.tooLarge");
    expect(validateMoney("4500")).toBe(true);
    expect(validateDays("")).toBe("page.edit.errors.required");
    expect(validateDays("366")).toBe("page.edit.errors.daysMax");
    const values = { base: "1", perKg: "1", daysMin: "3", daysMax: "2", validFrom: "2026-10-25" };
    expect(validateDaysMax("2", values)).toBe("page.edit.errors.daysOrder");
    expect(validateDaysMax("3", values)).toBe(true);
    expect(validateValidFrom("", "2026-10-24")).toBe("page.edit.errors.dateRequired");
    expect(validateValidFrom("2026-10-23", "2026-10-24")).toBe("page.edit.errors.datePast");
    expect(validateValidFrom("2026-10-24", "2026-10-24")).toBe(true);
  });

  it("sana yordamchilari (mahalliy kun)", () => {
    expect(toIsoDay(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
  });
});
