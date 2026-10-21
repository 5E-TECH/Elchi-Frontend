import { describe, expect, it } from "vitest";
import { readOperatorProfile, readOperatorRate, sampleEarning } from "./operatorRate";

describe("readOperatorRate — `my-profile` komissiyasi", () => {
  it("foiz va qat'iy summa; `numeric(14,2)` matn bo'lib kelsa ham o'qiladi", () => {
    expect(readOperatorRate({ commission_type: "percent", commission_value: 5 })).toEqual({ type: "percent", value: 5 });
    expect(readOperatorRate({ commission_type: "fixed", commission_value: "3000.00" })).toEqual({ type: "fixed", value: 3000 });
    expect(readOperatorRate({ commission_type: "PERCENT", commission_value: "3.5" })).toEqual({ type: "percent", value: 3.5 });
  });

  it("turi yo'q, qiymati yo'q yoki 0 — `null` (backend daromad yozmaydi)", () => {
    expect(readOperatorRate({ commission_type: null, commission_value: 5 })).toBeNull();
    expect(readOperatorRate({ commission_type: "percent", commission_value: null })).toBeNull();
    expect(readOperatorRate({ commission_type: "percent", commission_value: 0 })).toBeNull();
    expect(readOperatorRate({ commission_type: "fixed", commission_value: "abc" })).toBeNull();
    expect(readOperatorRate({ commission_type: "bonus", commission_value: 5 })).toBeNull();
    expect(readOperatorRate(undefined)).toBeNull();
    expect(readOperatorRate({})).toBeNull();
  });
});

describe("sampleEarning — «Namuna»", () => {
  it("foiz — 250 000 so'mdan, butun so'mga yaxlitlangan; qat'iy — qiymatning o'zi", () => {
    expect(sampleEarning({ type: "percent", value: 5 })).toBe(12_500);
    expect(sampleEarning({ type: "percent", value: 3.33 })).toBe(8_325);
    expect(sampleEarning({ type: "fixed", value: 3_000 })).toBe(3_000);
  });
});

describe("readOperatorProfile", () => {
  it("`{ data: User }` va `User` — profil; bo'sh, matn, `id` siz — null", () => {
    expect(readOperatorProfile({ statusCode: 200, data: { id: "9", commission_type: "percent" } })).toEqual({
      id: "9",
      commission_type: "percent",
    });
    expect(readOperatorProfile({ id: 9 })).toEqual({ id: 9 });
    expect(readOperatorProfile({ data: { data: { id: "9" } } })).toEqual({ id: "9" });
    expect(readOperatorProfile(null)).toBeNull();
    expect(readOperatorProfile("<html>")).toBeNull();
    expect(readOperatorProfile({ statusCode: 200, message: "ok" })).toBeNull();
    expect(readOperatorProfile({ statusCode: 200, data: null })).toBeNull();
  });
});
