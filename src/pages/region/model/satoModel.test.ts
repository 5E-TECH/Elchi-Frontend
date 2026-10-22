import { describe, expect, it } from "vitest";
import uzRegion from "../../../locales/uz/region.json";
import ruRegion from "../../../locales/ru/region.json";
import enRegion from "../../../locales/en/region.json";
import {
  buildAdminSatoView,
  buildSuperadminSatoView,
  filterSatoRows,
  isValidSatoCode,
  normalizeSatoDistricts,
  normalizeSatoOwner,
  normalizeSatoPreview,
  paginateSatoRows,
  satoDraftFor,
  satoMatchedPercent,
  satoRegionOptions,
  type SatoDistrictRow,
  type SatoRow,
} from "./satoModel";

const TOSHKENT_SH = { id: "1", name: "Toshkent sh.", sato_code: "1726" };
const TOSHKENT_V = { id: "2", name: "Toshkent viloyati", sato_code: "1727" };
const SAMARQAND = { id: "6", name: "Samarqand", sato_code: "1718" };

/** `GET district` javobi (`successRes`) — `region` — `region_id` bo'yicha. */
const DISTRICTS = {
  statusCode: 200,
  message: "success",
  data: [
    { id: "10", name: "Yangihayot tumani", sato_code: null, region_id: "1", region: TOSHKENT_SH },
    { id: "11", name: "Bektemir tumani", sato_code: null, region_id: "1", region: TOSHKENT_SH },
    { id: "12", name: "Uchtepa tumani", sato_code: "1726262", region_id: "1", region: TOSHKENT_SH },
    { id: "13", name: "Do'stobod sh.", sato_code: "", region_id: "2", region: TOSHKENT_V },
    { id: "14", name: "Urgut sh.", sato_code: null, region_id: "6", region: SAMARQAND },
    // Takroriy nom: turli viloyatlar.
    { id: "31", name: "Chilonzor tumani", sato_code: "1726294", region_id: "1", region: TOSHKENT_SH },
    { id: "188", name: "Chilonzor tumani", sato_code: null, region_id: "2", region: TOSHKENT_V },
    // Preview eskirgan: «Topildi» da edi, lekin endi kodi saqlangan → «Kodi bor».
    { id: "15", name: "Zangiota tumani", sato_code: "1727237", region_id: "2", region: TOSHKENT_V },
  ],
};

const PREVIEW = {
  statusCode: 200,
  message: "SATO matching natijasi",
  data: {
    matched: [
      { dbId: "10", dbName: "Yangihayot tumani (Toshkent sh.)", satoCode: "1726292", satoName: "Yangihayot tumani (Toshkent shahri)" },
      { dbId: "11", dbName: "Bektemir tumani (Toshkent sh.)", satoCode: "1726264", satoName: "Bektemir tumani (Toshkent shahri)" },
      { dbId: "12", dbName: "Uchtepa tumani", satoCode: "1726262", satoName: "(allaqachon mavjud)" },
      { dbId: "15", dbName: "Zangiota tumani (Toshkent viloyati)", satoCode: "1727237", satoName: "Zangiota tumani (Toshkent viloyati)" },
      // `/district` da yo'q (orada o'chirilgan) — chiqarilmaydi.
      { dbId: "999", dbName: "Yo'q tuman", satoCode: "1700000", satoName: "Yo'q tuman" },
    ],
    unmatched: [
      { dbId: "13", dbName: "Do'stobod sh.", regionName: "Toshkent viloyati" },
      { dbId: "14", dbName: "Urgut sh.", regionName: "Samarqand" },
    ],
    duplicates: [
      {
        name: "Chilonzor tumani (Toshkent sh., Toshkent viloyati)",
        entries: [
          { id: "31", regionName: "Toshkent sh." },
          { id: "188", regionName: "Toshkent viloyati" },
        ],
      },
    ],
    missingSatoEntries: [
      { satoCode: "1718236", satoName: "Urgut tumani", regionName: "Samarqand viloyati" },
      { satoCode: "1799001", satoName: "Noma'lum tumani", regionName: "Boshqa viloyati" },
    ],
    stats: { totalDb: 8, totalSato: 203, matchedCount: 5, unmatchedCount: 2, duplicatesCount: 2, missingCount: 2 },
  },
};

const names = (rows: readonly SatoRow[]) => rows.map((row) => (row.kind === "district" ? row.name : row.satoName));

describe("satoModel — normalizatsiya", () => {
  it("GET /district: region `region_id` bo'yicha, bo'sh kod — null", () => {
    const districts = normalizeSatoDistricts(DISTRICTS);
    expect(districts).toHaveLength(8);
    expect(districts[0]).toEqual({
      id: "10",
      name: "Yangihayot tumani",
      satoCode: null,
      region: { id: "1", name: "Toshkent sh.", satoCode: "1726" },
    });
    expect(districts.find((d) => d.id === "13")?.satoCode).toBeNull();
    expect(normalizeSatoDistricts({ data: [{ id: 5, name: "X", region_id: 3 }] })[0].region).toEqual({
      id: "3",
      name: "—",
      satoCode: null,
    });
    expect(normalizeSatoDistricts(null)).toEqual([]);
  });

  it("preview: stats va bo'limlar; dbName ishlatilmaydi", () => {
    const preview = normalizeSatoPreview(PREVIEW);
    expect(preview.stats).toEqual(PREVIEW.data.stats);
    expect(preview.matched[0]).toEqual({
      dbId: "10",
      satoCode: "1726292",
      satoName: "Yangihayot tumani (Toshkent shahri)",
    });
    expect(preview.duplicates).toEqual([{ ids: ["31", "188"] }]);
    expect(preview.missing[0]).toEqual({ satoCode: "1718236", satoName: "Urgut tumani", regionName: "Samarqand viloyati" });
    expect(normalizeSatoPreview({}).stats.totalDb).toBe(0);
  });

  it("kod egasi (409 dan keyin GET district/sato/:code)", () => {
    expect(
      normalizeSatoOwner({ data: { id: "12", name: "Uchtepa tumani", region: { name: "Toshkent sh." } } }),
    ).toEqual({ id: "12", name: "Uchtepa tumani", regionName: "Toshkent sh." });
    expect(normalizeSatoOwner({ data: null })).toBeNull();
  });
});

describe("satoModel — superadmin tablari (sato_code bo'yicha)", () => {
  const view = buildSuperadminSatoView(normalizeSatoPreview(PREVIEW), normalizeSatoDistricts(DISTRICTS));

  it("«Topildi» — preview topgan, saqlangan kodi yo'q; topilgan kod va rasmiy nom bilan", () => {
    expect(names(view.rows.found)).toEqual(["Bektemir tumani", "Yangihayot tumani"]);
    expect(view.rows.found[1]).toMatchObject({
      foundCode: "1726292",
      officialName: "Yangihayot tumani (Toshkent shahri)",
      regionName: "Toshkent sh.",
      satoCode: null,
    });
  });

  it("eskirgan preview: kodi saqlangan tuman «Topildi» da emas, «Kodi bor» da", () => {
    expect(names(view.rows.found)).not.toContain("Zangiota tumani");
    expect(names(view.rows.hasCode)).toContain("Zangiota tumani");
  });

  it("«Topilmadi» — unmatched (kodsiz)", () => {
    expect(names(view.rows.notFound)).toEqual(["Urgut sh.", "Do'stobod sh."]);
  });

  it("«Kodi bor» — saqlangan kodli, takroriylarsiz (superadmin)", () => {
    expect(names(view.rows.hasCode)).toEqual(["Uchtepa tumani", "Zangiota tumani"]);
  });

  it("«Takroriy nomlar» — guruh yozuvlari (sato_code ham), guruhlar soni alohida", () => {
    expect(view.duplicateGroups).toBe(1);
    expect(view.rows.duplicates.map((row) => (row as SatoDistrictRow).id)).toEqual(["31", "188"]);
    expect(view.rows.duplicates[0]).toMatchObject({ satoCode: "1726294", regionName: "Toshkent sh." });
  });

  it("«Bazada yo'q» — viloyat kod prefiksidan, topilmasa SATO nomi", () => {
    expect(view.rows.missing).toEqual([
      { kind: "missing", satoCode: "1799001", satoName: "Noma'lum tumani", regionId: null, regionName: "Boshqa viloyati" },
      { kind: "missing", satoCode: "1718236", satoName: "Urgut tumani", regionId: "6", regionName: "Samarqand" },
    ]);
  });

  it("preview'da bor, /district da yo'q yozuv chiqmaydi", () => {
    const all = Object.values(view.rows).flat();
    expect(all.some((row) => row.kind === "district" && row.id === "999")).toBe(false);
  });
});

describe("satoModel — admin (preview yo'q)", () => {
  it("«Kodsiz» va «Kodi bor» — takroriylar ham kiradi", () => {
    const view = buildAdminSatoView(normalizeSatoDistricts(DISTRICTS));
    expect(view.noCode).toHaveLength(5);
    expect(names(view.hasCode)).toEqual(["Chilonzor tumani", "Uchtepa tumani", "Zangiota tumani"]);
  });
});

describe("satoModel — qidiruv, filtr, sahifalash", () => {
  const districts = normalizeSatoDistricts(DISTRICTS);
  const rows = buildAdminSatoView(districts).noCode;

  it("tuman, viloyat yoki kod; apostrof turlari bir xil", () => {
    expect(names(filterSatoRows(rows, { search: "do‘stobod", regionId: null }))).toEqual(["Do'stobod sh."]);
    expect(names(filterSatoRows(rows, { search: "samarqand", regionId: null }))).toEqual(["Urgut sh."]);
    const hasCode = buildAdminSatoView(districts).hasCode;
    expect(names(filterSatoRows(hasCode, { search: "1726262", regionId: null }))).toEqual(["Uchtepa tumani"]);
  });

  it("viloyat filtri (region id)", () => {
    expect(names(filterSatoRows(rows, { search: "", regionId: "1" }))).toEqual([
      "Bektemir tumani",
      "Yangihayot tumani",
    ]);
  });

  it("viloyat variantlari — nom bo'yicha, takrorsiz", () => {
    expect(satoRegionOptions(districts)).toEqual([
      { value: "6", label: "Samarqand" },
      { value: "1", label: "Toshkent sh." },
      { value: "2", label: "Toshkent viloyati" },
    ]);
  });

  it("sahifalash: 10 talik, chegaradan chiqsa oxirgi sahifa", () => {
    const list = Array.from({ length: 12 }, (_, i) => i);
    expect(paginateSatoRows(list, 1, 10).items).toHaveLength(10);
    expect(paginateSatoRows(list, 2, 10)).toEqual({ page: 2, totalPages: 2, items: [10, 11] });
    expect(paginateSatoRows(list, 9, 10).page).toBe(2);
    expect(paginateSatoRows([], 3, 10)).toEqual({ page: 1, totalPages: 1, items: [] });
  });
});

describe("satoModel — kod va KPI", () => {
  it("faqat raqam (DTO ^\\d+$)", () => {
    expect(isValidSatoCode("1727401")).toBe(true);
    expect(isValidSatoCode(" 1727401 ")).toBe(true);
    expect(isValidSatoCode("")).toBe(false);
    expect(isValidSatoCode("17-27")).toBe(false);
  });

  it("muharrir qiymati: saqlangan kod, bo'lmasa topilgan", () => {
    const base: SatoDistrictRow = { kind: "district", id: "1", name: "A", regionId: null, regionName: "—", satoCode: null };
    expect(satoDraftFor({ ...base, foundCode: "1726292" })).toBe("1726292");
    expect(satoDraftFor({ ...base, satoCode: "1726262", foundCode: "1" })).toBe("1726262");
    expect(satoDraftFor(base)).toBe("");
  });

  it("«Mos keldi» ulushi", () => {
    const stats = normalizeSatoPreview(PREVIEW).stats;
    expect(satoMatchedPercent({ ...stats, totalDb: 204, matchedCount: 197 })).toBeCloseTo(96.57, 1);
    expect(satoMatchedPercent({ ...stats, totalDb: 0 })).toBe(0);
  });
});

type Tree = { [key: string]: string | Tree };
/** Kalitlar (ko'plik qo'shimchasiz: `_one`, `_few`, `_many`, `_other`). */
const keysOf = (tree: Tree, prefix = ""): string[] =>
  Object.entries(tree).flatMap(([key, value]) => {
    const path = `${prefix}${key.replace(/_(one|few|many|other)$/, "")}`;
    return typeof value === "string" ? [path] : keysOf(value, `${path}.`);
  });
const valuesOf = (tree: Tree): string[] =>
  Object.values(tree).flatMap((value) => (typeof value === "string" ? [value] : valuesOf(value)));

describe("region.json v2.sato — uch til", () => {
  const sato = (json: unknown) => (json as { v2: { sato: Tree } }).v2.sato;
  const uz = [...new Set(keysOf(sato(uzRegion)))].sort();

  it("kalitlar uz/ru/en da bir xil, qiymat bo'sh emas, ruschada kirill", () => {
    expect(uz.length).toBeGreaterThan(60);
    expect([...new Set(keysOf(sato(ruRegion)))].sort()).toEqual(uz);
    expect([...new Set(keysOf(sato(enRegion)))].sort()).toEqual(uz);
    for (const value of [...valuesOf(sato(uzRegion)), ...valuesOf(sato(ruRegion))]) expect(value.length).toBeGreaterThan(0);
    expect(sato(ruRegion).title).toMatch(/[А-Яа-я]/);
  });

  it("maket matnlari (uz)", () => {
    const tree = sato(uzRegion) as Record<string, Tree>;
    expect(tree.title).toBe("Tumanlar va SATO kodlari");
    expect((tree.tabs as Tree).found).toBe("Topildi");
    expect((tree.editor as Tree).taken).toBe("Bu kod band: {{district}}, {{region}}");
  });
});
