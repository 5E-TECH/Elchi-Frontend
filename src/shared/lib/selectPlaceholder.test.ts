import { describe, expect, it } from "vitest";
import { isAllPlaceholder, isFilterSelect, resolveFilterEmptyLabel } from "./selectPlaceholder";

/** Ega qarori (2026-10-16): filtrda bo'sh maydon — «Barchasi» (v1 «Tanlang <yorliq>» emas), forma — o'z namunasi. */
describe("selectPlaceholder", () => {
  it("«Barchasi» / «Все» / «All» (va «Barcha …») — umumiy namuna", () => {
    expect(isAllPlaceholder("Barchasi")).toBe(true);
    expect(isAllPlaceholder(" barcha marketlar ")).toBe(true);
    expect(isAllPlaceholder("Все")).toBe(true);
    expect(isAllPlaceholder("All couriers")).toBe(true);
    expect(isAllPlaceholder("Marketni tanlang")).toBe(false);
    expect(isAllPlaceholder(undefined)).toBe(false);
    expect(isAllPlaceholder("")).toBe(false);
  });

  it("filtr belgilari: allOption, value=\"\" li variant, «Barchasi»-simon namuna, o'ramning o'zi; false — o'chiradi", () => {
    expect(isFilterSelect({ allOption: true })).toBe(true);
    expect(isFilterSelect({ emptyOptionLabel: "Barchasi" })).toBe(true);
    expect(isFilterSelect({ placeholder: "Barcha manbalar" })).toBe(true);
    expect(isFilterSelect({ implicitFilter: true })).toBe(true);
    expect(isFilterSelect({ placeholder: "Filialni tanlang" })).toBe(false);
    expect(isFilterSelect({ allOption: false, emptyOptionLabel: "Barchasi", placeholder: "Barchasi" })).toBe(false);
  });

  it("forma ro'yxati — null (iste'molchi namunasi qoladi)", () => {
    expect(resolveFilterEmptyLabel({ placeholder: "Viloyat tanlang", allWord: "Barchasi" })).toBeNull();
  });

  it("filtr: «Barchasi» — «Tanlang <yorliq>» emas; ustuvorlik: allOption satri → bo'sh variant → «Barcha …» namuna", () => {
    expect(resolveFilterEmptyLabel({ allOption: true, placeholder: "Marketni tanlang", allWord: "Barchasi" })).toBe(
      "Barchasi",
    );
    expect(resolveFilterEmptyLabel({ placeholder: "Barchasi", allWord: "Barchasi" })).toBe("Barchasi");
    expect(resolveFilterEmptyLabel({ placeholder: "Barcha manbalar", allWord: "Barchasi" })).toBe("Barcha manbalar");
    expect(resolveFilterEmptyLabel({ emptyOptionLabel: "Hammasi", placeholder: "Barchasi", allWord: "Barchasi" })).toBe(
      "Hammasi",
    );
    expect(
      resolveFilterEmptyLabel({ allOption: "Barcha marketlar", emptyOptionLabel: "Hammasi", allWord: "Barchasi" }),
    ).toBe("Barcha marketlar");
    expect(resolveFilterEmptyLabel({ implicitFilter: true, placeholder: "Rolni tanlang", allWord: "Все" })).toBe("Все");
  });

  it("yashirin yorliqli filtr — qisqa «Barchasi» (nom maydon ichida: «Viloyat: Barchasi»)", () => {
    expect(
      resolveFilterEmptyLabel({ placeholder: "Barcha viloyatlar", hideLabel: true, allWord: "Barchasi" }),
    ).toBe("Barchasi");
    expect(
      resolveFilterEmptyLabel({ implicitFilter: true, placeholder: "Rolni tanlang", hideLabel: true, allWord: "Barchasi" }),
    ).toBe("Barchasi");
  });
});
