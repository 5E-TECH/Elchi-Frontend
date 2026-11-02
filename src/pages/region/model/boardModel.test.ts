import { filterBoardRegions, normalizeBoardRegions } from "./boardModel";

const TOSHKENT_VIL = { id: "10", name: "Toshkent viloyati", sato_code: "1727" };
const TOSHKENT_SH = { id: "1", name: "Toshkent sh.", sato_code: "1726" };

describe("normalizeBoardRegions (kGvjztpY)", () => {
  it("ustun — `assignedDistricts` (geografik `districts` emas); tumanning geografik viloyati saqlanadi", () => {
    // Angren sh. (geografik — Toshkent viloyati) Toshkent sh. ga o'tkazilgan: `districts` da hali eski joyida.
    const payload = {
      statusCode: 200,
      data: [
        {
          ...TOSHKENT_VIL,
          districts: [
            { id: "5", name: "Angren sh.", region_id: "10" },
            { id: "6", name: "Bekobod tumani", region_id: "10" },
          ],
          assignedDistricts: [{ id: "6", name: "Bekobod tumani", region_id: "10", region: TOSHKENT_VIL }],
        },
        {
          ...TOSHKENT_SH,
          districts: [{ id: "2", name: "Chilonzor", region_id: "1" }],
          assignedDistricts: [
            { id: "2", name: "Chilonzor", region_id: "1", assigned_region: "1", region: TOSHKENT_SH },
            { id: "5", name: "Angren sh.", region_id: "10", assigned_region: "1", region: TOSHKENT_VIL },
          ],
        },
      ],
    };

    expect(normalizeBoardRegions(payload)).toEqual([
      {
        id: "10",
        name: "Toshkent viloyati",
        satoCode: "1727",
        districts: [
          { id: "6", name: "Bekobod tumani", geoRegionId: "10", geoRegionName: "Toshkent viloyati" },
        ],
      },
      {
        id: "1",
        name: "Toshkent sh.",
        satoCode: "1726",
        // Nom bo'yicha: Angren sh. birinchi; geografik viloyati — Toshkent viloyati (SATO prefiksi shundan).
        districts: [
          { id: "5", name: "Angren sh.", geoRegionId: "10", geoRegionName: "Toshkent viloyati" },
          { id: "2", name: "Chilonzor", geoRegionId: "1", geoRegionName: "Toshkent sh." },
        ],
      },
    ]);
  });

  it("A → B ko'chirilgan tuman faqat B ustunida (A ning `districts` ida bo'lsa ham), jami son o'zgarmaydi", () => {
    const regions = normalizeBoardRegions({
      data: [
        {
          id: "A",
          name: "A viloyati",
          districts: [
            { id: "1", name: "Bir" },
            { id: "2", name: "Ikki" },
          ],
          assignedDistricts: [{ id: "1", name: "Bir", region: { id: "A", name: "A viloyati" } }],
        },
        {
          id: "B",
          name: "B viloyati",
          districts: [],
          assignedDistricts: [{ id: "2", name: "Ikki", region: { id: "A", name: "A viloyati" } }],
        },
      ],
    });

    const where = (id: string) => regions.filter((r) => r.districts.some((d) => d.id === id)).map((r) => r.id);
    expect(where("2")).toEqual(["B"]);
    expect(where("1")).toEqual(["A"]);
    expect(regions.reduce((sum, r) => sum + r.districts.length, 0)).toBe(2);
  });

  it("`assignedDistricts` yo'q (eski backend, e2e mock'lari) — geografik `districts`; geografik viloyat — ustunning o'zi", () => {
    const regions = normalizeBoardRegions({
      statusCode: 200,
      data: [
        {
          id: 2,
          name: "Andijon",
          districts: [
            { id: 22, name: "Asaka tumani" },
            { id: 21, name: "Andijon sh." },
            { name: "id siz" },
          ],
        },
      ],
    });

    expect(regions).toEqual([
      {
        id: "2",
        name: "Andijon",
        satoCode: null,
        districts: [
          { id: "21", name: "Andijon sh.", geoRegionId: "2", geoRegionName: "Andijon" },
          { id: "22", name: "Asaka tumani", geoRegionId: "2", geoRegionName: "Andijon" },
        ],
      },
    ]);
  });

  it("viloyat SOATO kodi (`sato_code`) saqlanadi — yangi tuman kodi prefiksi (ExK28CiS); bo'sh kod — `null`", () => {
    const regions = normalizeBoardRegions({
      data: [
        { id: "1", name: "Toshkent sh.", sato_code: " 1726 ", districts: [] },
        { id: "2", name: "Yangi viloyat", sato_code: "", districts: [] },
      ],
    });
    expect(regions.map((region) => region.satoCode)).toEqual(["1726", null]);
  });

  it("bo'sh `assignedDistricts` — bo'sh ustun (`districts` ga qaytilmaydi: hamma tumani boshqa viloyatga o'tgan)", () => {
    const [region] = normalizeBoardRegions({
      data: [{ id: "11", name: "Sirdaryo", districts: [{ id: "7", name: "Guliston" }], assignedDistricts: [] }],
    });
    expect(region.districts).toEqual([]);
  });

  it("konvert turlari: massiv, `{data}`, `{data:{data}}`, `{data:{items}}`, `{items}`; noto'g'ri javob — bo'sh", () => {
    const list = [{ id: "1", name: "X", districts: [] }];
    const expected = [{ id: "1", name: "X", satoCode: null, districts: [] }];
    expect(normalizeBoardRegions(list)).toEqual(expected);
    expect(normalizeBoardRegions({ data: list })).toEqual(expected);
    expect(normalizeBoardRegions({ data: { data: list } })).toEqual(expected);
    expect(normalizeBoardRegions({ data: { items: list } })).toEqual(expected);
    expect(normalizeBoardRegions({ items: list })).toEqual(expected);
    expect(normalizeBoardRegions(undefined)).toEqual([]);
    expect(normalizeBoardRegions({ data: "x" })).toEqual([]);
  });
});

describe("filterBoardRegions", () => {
  const regions = normalizeBoardRegions([
    { id: "1", name: "Toshkent sh.", districts: [{ id: "2", name: "Chilonzor" }, { id: "3", name: "Mirobod" }] },
    { id: "6", name: "Samarqand", districts: [{ id: "179", name: "Urgut" }] },
  ]);

  it("viloyat nomi mos kelsa — hamma tumanlari, aks holda faqat mos tumanlar", () => {
    expect(filterBoardRegions(regions, "toshkent").map((r) => r.districts.length)).toEqual([2]);
    const mirobod = regions[0].districts.find((d) => d.name === "Mirobod");
    expect(filterBoardRegions(regions, "mir")).toEqual([{ ...regions[0], districts: [mirobod] }]);
    expect(filterBoardRegions(regions, "  ")).toBe(regions);
  });
});
