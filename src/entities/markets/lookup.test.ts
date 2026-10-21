import { describe, expect, it } from "vitest";
import { toMarketLookup } from "./lookup";

describe("toMarketLookup (KM-1)", () => {
  it("massiv, { data }, { items } va { data: { items } } konvertlarini o'qiydi", () => {
    const row = { id: 7, name: "Alfa", phone_number: "+998901112233" };
    const expected = [{ id: "7", name: "Alfa", phone: "+998901112233" }];
    expect(toMarketLookup([row])).toEqual(expected);
    expect(toMarketLookup({ data: [row] })).toEqual(expected);
    expect(toMarketLookup({ items: [row] })).toEqual(expected);
    expect(toMarketLookup({ data: { items: [row] } })).toEqual(expected);
  });

  it("nom bo'lmasa username yoki #id; id'siz qatorlar tashlanadi; kutilmagan javob — bo'sh", () => {
    expect(
      toMarketLookup([{ id: "a", username: "beta" }, { id: 3, name: "  " }, { name: "no-id" }, null]),
    ).toEqual([
      { id: "a", name: "beta" },
      { id: "3", name: "#3" },
    ]);
    expect(toMarketLookup(undefined)).toEqual([]);
    expect(toMarketLookup({ data: "x" })).toEqual([]);
  });
});
