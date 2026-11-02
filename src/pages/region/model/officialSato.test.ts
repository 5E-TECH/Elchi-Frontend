import { findOfficialSatoByName, normalizeOfficialSato, officialSatoNameKey } from "./officialSato";

const ITEMS = normalizeOfficialSato({
  statusCode: 200,
  data: {
    region_id: "14",
    region_sato_code: "1727",
    items: [
      { name: "O'rtachirchiq tumani", sato_code: "1727253", taken_by: null },
      { name: "Bekobod tumani", sato_code: "1727224", taken_by: null },
      { name: "Bekobod shahri", sato_code: "1727413", taken_by: { kind: "district", id: "40", name: "Bekobod" } },
      { name: "Buzuq", sato_code: "17272", taken_by: null },
    ],
  },
});

describe("officialSato", () => {
  it("normalizes the envelope and drops rows without a 7-digit code", () => {
    expect(ITEMS).toEqual([
      { name: "O'rtachirchiq tumani", satoCode: "1727253", takenBy: null },
      { name: "Bekobod tumani", satoCode: "1727224", takenBy: null },
      { name: "Bekobod shahri", satoCode: "1727413", takenBy: { kind: "district", id: "40", name: "Bekobod" } },
    ]);
    expect(normalizeOfficialSato({ statusCode: 200, data: [] })).toEqual([]);
    expect(normalizeOfficialSato(null)).toEqual([]);
  });

  it("name key ignores case, apostrophes and «tumani», keeps «shahri»", () => {
    expect(officialSatoNameKey("O'rtachirchiq tumani")).toBe("ortachirchiq");
    expect(officialSatoNameKey("  ortachirchiq ")).toBe("ortachirchiq");
    expect(officialSatoNameKey("Oʻrtachirchiq tuman")).toBe("ortachirchiq");
    expect(officialSatoNameKey("Bekobod sh.")).toBe("bekobod shahri");
  });

  it("finds only a free official district with exactly the same name", () => {
    expect(findOfficialSatoByName(ITEMS, "O'rtachirchiq")?.satoCode).toBe("1727253");
    expect(findOfficialSatoByName(ITEMS, "bekobod")?.satoCode).toBe("1727224");
    // Shahar kodi band — taklif qilinmaydi; tumanga ham tushmaydi.
    expect(findOfficialSatoByName(ITEMS, "Bekobod shahri")).toBeNull();
    expect(findOfficialSatoByName(ITEMS, "O'rta")).toBeNull();
    expect(findOfficialSatoByName(ITEMS, "")).toBeNull();
  });
});
