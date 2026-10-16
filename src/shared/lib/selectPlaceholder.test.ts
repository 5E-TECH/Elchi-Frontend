import { describe, expect, it } from "vitest";
import { isAllPlaceholder, resolveSelectPlaceholder } from "./selectPlaceholder";

describe("selectPlaceholder", () => {
  it("«Barchasi» / «Все» / «All» (va «Barcha …») — umumiy namuna", () => {
    expect(isAllPlaceholder("Barchasi")).toBe(true);
    expect(isAllPlaceholder(" barcha marketlar ")).toBe(true);
    expect(isAllPlaceholder("Все")).toBe(true);
    expect(isAllPlaceholder("All couriers")).toBe(true);
    expect(isAllPlaceholder("Marketni tanlang")).toBe(false);
  });

  it("umumiy namuna «Tanlang <yorliq>» ga aylanadi, boshqasi o'zgarmaydi", () => {
    expect(resolveSelectPlaceholder("Barchasi", "Market", "Tanlang")).toBe("Tanlang market");
    expect(resolveSelectPlaceholder("Viloyat tanlang", "Viloyat", "Tanlang")).toBe("Viloyat tanlang");
  });
});
