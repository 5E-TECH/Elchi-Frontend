import { describe, expect, it } from "vitest";
import {
  checkDimensionInput,
  checkWeightInput,
  toDimensionInput,
  toDimensionPayload,
  toMeasureItem,
  toWeightInput,
  toWeightPayload,
} from "./measureInput";

describe("checkWeightInput — og'irlik (kg, ≤ 3 kasr, 0,1…1000)", () => {
  it.each([
    ["", "empty"],
    ["   ", "empty"],
    ["abc", "notNumber"],
    ["o'n", "notNumber"],
    ["1,2,3", "notNumber"],
    ["1e2", "notNumber"],
    ["-0,5", "min"],
    ["0", "min"],
    ["0,05", "min"],
    ["1000,5", "max"],
    ["0,1255", "precision"],
  ])("%j → %s", (raw, issue) => {
    expect(checkWeightInput(raw)).toBe(issue);
  });

  it.each(["0,1", "0.8", " 1,2 ", "1000", "0,125", "0,1250", "12.5"])("%j — to'g'ri", (raw) => {
    expect(checkWeightInput(raw)).toBeNull();
  });
});

describe("checkDimensionInput — o'lcham (butun sm, 1…1000)", () => {
  it.each([
    ["", "empty"],
    ["o'n", "notNumber"],
    ["abc", "notNumber"],
    ["-20", "notPositiveInteger"],
    ["0", "notPositiveInteger"],
    ["30,5", "notPositiveInteger"],
    ["1001", "max"],
  ])("%j → %s", (raw, issue) => {
    expect(checkDimensionInput(raw)).toBe(issue);
  });

  it.each(["1", "30", " 50 ", "1000", "30,0"])("%j — to'g'ri", (raw) => {
    expect(checkDimensionInput(raw)).toBeNull();
  });
});

describe("toMeasureItem va payload", () => {
  it("to'rttala maydon to'g'ri — narx so'rovi elementi (vergul — nuqta)", () => {
    expect(toMeasureItem({ weight: "1,2", length: "30", width: "22", height: "15", volumetric: false })).toEqual({
      weight_kg: 1.2,
      length_cm: 30,
      width_cm: 22,
      height_cm: 15,
      volumetric_enabled: false,
    });
  });

  it("bittasi xato yoki bo'sh — `null` (so'rov ketmaydi)", () => {
    expect(toMeasureItem({ weight: "1,2", length: "30", width: "", height: "15", volumetric: true })).toBeNull();
    expect(toMeasureItem({ weight: "x", length: "30", width: "22", height: "15", volumetric: true })).toBeNull();
  });

  it("API satrlari: og'irlik nuqta bilan, ortiqcha nolsiz; o'lcham butun", () => {
    expect(toWeightPayload("0,80")).toBe("0.8");
    expect(toWeightPayload(" 1,250 ")).toBe("1.25");
    expect(toDimensionPayload(" 30 ")).toBe("30");
    expect(toDimensionPayload("30,0")).toBe("30");
  });

  it("saqlangan qiymat → maydon matni (uz/ru vergul, en nuqta; yo'q — bo'sh)", () => {
    expect(toWeightInput("0.800", "uz")).toBe("0,8");
    expect(toWeightInput(12.5, "ru")).toBe("12,5");
    expect(toWeightInput("1.250", "en")).toBe("1.25");
    expect(toWeightInput(null, "uz")).toBe("");
    expect(toWeightInput("abc", "uz")).toBe("");
    expect(toDimensionInput(30)).toBe("30");
    expect(toDimensionInput("15")).toBe("15");
    expect(toDimensionInput(null)).toBe("");
    expect(toDimensionInput(0)).toBe("");
  });
});
