import { buildRegionFilterOptions, regionSearchFilter } from "./regionFilterOptions";

describe("regionFilterOptions", () => {
  it("viloyatlar takrorsiz, o'zbekcha tartibda", () => {
    const options = buildRegionFilterOptions([
      { region: { id: "2", name: "Buxoro" } },
      { region: { id: "1", name: "Andijon" } },
      { region: { id: "2", name: "Buxoro" } },
      { region: null },
    ]);
    expect(options).toEqual([
      { value: "1", label: "Andijon" },
      { value: "2", label: "Buxoro" },
    ]);
  });

  it("regionSearchFilter: «Barchasi» (value '') yozilganda chiqmaydi; nom ichidagi qism va apostrof turlari topiladi", () => {
    const all = { value: "", label: "Barchasi" };
    expect(regionSearchFilter(all, "a")).toBe(false);
    expect(regionSearchFilter(all, "barchasi")).toBe(false);
    expect(regionSearchFilter({ value: "8", label: "Buxoro" }, "xor")).toBe(true);
    expect(regionSearchFilter({ value: "10", label: "Farg‘ona" }, "farg'")).toBe(true);
    expect(regionSearchFilter({ value: "3", label: "Navoiy" }, "jiz")).toBe(false);
  });
});
