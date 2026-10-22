/**
 * SATO kodlari (SA-1, `/regions/sato-management?tab=sato`) — ma'lumot modeli.
 *
 * Manbalar:
 * - `GET district` — tumanlar: nom, viloyat (`region`, `region_id` bo'yicha) va saqlangan `sato_code`
 *   (superadmin va admin).
 * - `GET district/sato-match/preview` — faqat superadmin (adminga 403): rasmiy ro'yxat bilan solishtirish
 *   (`matched`, `unmatched`, `duplicates`, `missingSatoEntries`, `stats`).
 *
 * Preview `/district` bilan `dbId = id` bo'yicha birlashtiriladi: nom, viloyat va kod faqat `/district` dan olinadi
 * (preview `dbName` satri — «Nom (Viloyat)» — parse qilinmaydi). Tab tarqatish saqlangan `sato_code` bo'yicha,
 * preview'dagi «(allaqachon mavjud)» sehrli matni bo'yicha EMAS: preview eskirgan bo'lsa ham kodli tuman «Kodi
 * bor» da, kodsiz tuman «Topildi» / «Topilmadi» da turadi.
 *
 * Qidiruv, viloyat filtri va sahifalash — klientda (API sahifalamaydi, ~200 tuman).
 */

export type SatoRegionRef = { id: string; name: string; satoCode: string | null };

export type SatoDistrict = {
  id: string;
  name: string;
  satoCode: string | null;
  region: SatoRegionRef | null;
};

export type SatoPreviewStats = {
  totalDb: number;
  totalSato: number;
  matchedCount: number;
  unmatchedCount: number;
  /** Takroriy nomli YOZUVLAR soni (guruhlar emas). */
  duplicatesCount: number;
  missingCount: number;
};

export type SatoPreview = {
  matched: { dbId: string; satoCode: string; satoName: string }[];
  unmatched: { dbId: string }[];
  /** Bir xil nomli tumanlar guruhi (viloyatdan qat'i nazar) — yozuv id'lari. */
  duplicates: { ids: string[] }[];
  missing: { satoCode: string; satoName: string; regionName: string | null }[];
  stats: SatoPreviewStats;
};

/** Superadmin holat tablari (ega S2: «Kodsiz» → «Topildi» va «Topilmadi»; S3: oxirgi ikkisi faqat superadmin). */
export const SUPERADMIN_SATO_TABS = ["found", "notFound", "hasCode", "duplicates", "missing"] as const;
/** Admin: preview yo'q (403) — faqat `/district` bo'yicha ikki tab. */
export const ADMIN_SATO_TABS = ["noCode", "hasCode"] as const;

export type SatoTab = (typeof SUPERADMIN_SATO_TABS)[number] | (typeof ADMIN_SATO_TABS)[number];

/** Tuman qatori (Topildi, Topilmadi, Kodi bor, Takroriy nomlar, admin tablari). */
export type SatoDistrictRow = {
  kind: "district";
  id: string;
  name: string;
  regionId: string | null;
  regionName: string;
  /** Saqlangan kod (`/district`). */
  satoCode: string | null;
  /** «Topildi»: preview topgan, hali saqlanmagan kod. */
  foundCode?: string;
  /** «Topildi»: rasmiy nom («Yangihayot tumani (Toshkent shahri)»). */
  officialName?: string;
  /** «Takroriy nomlar»: guruh tartib raqami (0 dan) — guruh sarlavha qatorlari va «Birlashtirish» uchun (SA-2). */
  duplicateGroup?: number;
};

/** «Bazada yo'q»: rasmiy ro'yxatda bor, bazada yo'q tuman. */
export type SatoMissingRow = {
  kind: "missing";
  satoCode: string;
  satoName: string;
  /** Bazadagi viloyat — `sato_code` prefiksi (4 raqam) bo'yicha; topilmasa `null`. */
  regionId: string | null;
  regionName: string;
};

export type SatoRow = SatoDistrictRow | SatoMissingRow;

export type SatoTabRows = Partial<Record<SatoTab, SatoRow[]>>;

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const asString = (value: unknown): string =>
  typeof value === "string" ? value : typeof value === "number" ? String(value) : "";

const asCode = (value: unknown): string | null => {
  const code = asString(value).trim();
  return code ? code : null;
};

const asCount = (value: unknown): number => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
};

/** `{ statusCode, data }` konvertini ochadi (axios `res.data` yoki to'g'ridan-to'g'ri `data`). */
const unwrap = (payload: unknown): unknown => {
  const record = asRecord(payload);
  return "data" in record ? record.data : payload;
};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** `GET district` → tumanlar (`region` — `region_id` bo'yicha rasmiy viloyat). */
export const normalizeSatoDistricts = (payload: unknown): SatoDistrict[] => {
  const body = unwrap(payload);
  const list = Array.isArray(body) ? body : asArray(asRecord(body).items);
  return list
    .map((item) => {
      const district = asRecord(item);
      const region = asRecord(district.region);
      const regionId = asString(region.id ?? district.region_id);
      return {
        id: asString(district.id),
        name: asString(district.name) || "—",
        satoCode: asCode(district.sato_code),
        region: regionId
          ? { id: regionId, name: asString(region.name) || "—", satoCode: asCode(region.sato_code) }
          : null,
      };
    })
    .filter((district) => district.id);
};

/** `GET district/sato-match/preview` → solishtirish natijasi. */
export const normalizeSatoPreview = (payload: unknown): SatoPreview => {
  const body = asRecord(unwrap(payload));
  const stats = asRecord(body.stats);
  return {
    matched: asArray(body.matched)
      .map((item) => {
        const entry = asRecord(item);
        return {
          dbId: asString(entry.dbId),
          satoCode: asString(entry.satoCode).trim(),
          satoName: asString(entry.satoName),
        };
      })
      .filter((entry) => entry.dbId),
    unmatched: asArray(body.unmatched)
      .map((item) => ({ dbId: asString(asRecord(item).dbId) }))
      .filter((entry) => entry.dbId),
    duplicates: asArray(body.duplicates)
      .map((item) => ({
        ids: asArray(asRecord(item).entries)
          .map((entry) => asString(asRecord(entry).id))
          .filter(Boolean),
      }))
      .filter((group) => group.ids.length > 0),
    missing: asArray(body.missingSatoEntries)
      .map((item) => {
        const entry = asRecord(item);
        return {
          satoCode: asString(entry.satoCode).trim(),
          satoName: asString(entry.satoName) || "—",
          regionName: asString(entry.regionName) || null,
        };
      })
      .filter((entry) => entry.satoCode),
    stats: {
      totalDb: asCount(stats.totalDb),
      totalSato: asCount(stats.totalSato),
      matchedCount: asCount(stats.matchedCount),
      unmatchedCount: asCount(stats.unmatchedCount),
      duplicatesCount: asCount(stats.duplicatesCount),
      missingCount: asCount(stats.missingCount),
    },
  };
};

/**
 * Lotin alifbosi tartibi (maketdagi taxta: «Sergeli», «Shayxontohur», «Chilonzor» — A–Z bo'yicha). `uz` ICU qoidasi
 * («Sh», «Ch» — «Z» dan keyin) muhitga qarab farq qiladi (Node bor, brauzerda yo'q) — ataylab olinmadi.
 */
const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });
const byName = (a: SatoDistrictRow, b: SatoDistrictRow) =>
  collator.compare(a.regionName, b.regionName) || collator.compare(a.name, b.name);

const toRow = (district: SatoDistrict, extra?: Partial<SatoDistrictRow>): SatoDistrictRow => ({
  kind: "district",
  id: district.id,
  name: district.name,
  regionId: district.region?.id ?? null,
  regionName: district.region?.name ?? "—",
  satoCode: district.satoCode,
  ...extra,
});

export type SuperadminSatoView = {
  rows: Required<Pick<SatoTabRows, (typeof SUPERADMIN_SATO_TABS)[number]>>;
  /** Takroriy nomlar guruhlari soni (tab soni; KPI «Yozuv · N ta nomda»). */
  duplicateGroups: number;
};

/**
 * Superadmin: preview + `/district`. Preview'da bor, lekin `/district` da yo'q yozuv (ro'yxatlar orasida
 * o'chirilgan) chiqarilmaydi — keyingi refetch ikkalasini tenglashtiradi.
 */
export const buildSuperadminSatoView = (
  preview: SatoPreview,
  districts: readonly SatoDistrict[],
): SuperadminSatoView => {
  const byId = new Map(districts.map((district) => [district.id, district]));
  const duplicateIds = new Set(preview.duplicates.flatMap((group) => group.ids));

  const found: SatoDistrictRow[] = [];
  const seen = new Set<string>();
  for (const entry of preview.matched) {
    const district = byId.get(entry.dbId);
    if (!district || district.satoCode || duplicateIds.has(district.id) || seen.has(district.id)) continue;
    seen.add(district.id);
    found.push(
      toRow(district, {
        foundCode: entry.satoCode || undefined,
        officialName: entry.satoName || undefined,
      }),
    );
  }

  const notFound: SatoDistrictRow[] = [];
  for (const entry of preview.unmatched) {
    const district = byId.get(entry.dbId);
    if (!district || district.satoCode || duplicateIds.has(district.id) || seen.has(district.id)) continue;
    seen.add(district.id);
    notFound.push(toRow(district));
  }

  const hasCode = districts
    .filter((district) => district.satoCode && !duplicateIds.has(district.id))
    .map((district) => toRow(district));

  const duplicates: SatoDistrictRow[] = [];
  let duplicateGroups = 0;
  const groups = preview.duplicates
    .map((group) =>
      group.ids
        .map((id) => byId.get(id))
        .filter((district): district is SatoDistrict => Boolean(district))
        .map((district) => toRow(district))
        .sort(byName),
    )
    .filter((group) => group.length > 0)
    .sort((a, b) => collator.compare(a[0].name, b[0].name));
  for (const group of groups) {
    const index = duplicateGroups;
    duplicateGroups += 1;
    duplicates.push(...group.map((row) => ({ ...row, duplicateGroup: index })));
  }

  const regionByPrefix = new Map<string, SatoRegionRef>();
  const regionByName = new Map<string, SatoRegionRef>();
  for (const district of districts) {
    const code = district.region?.satoCode;
    if (district.region && code && !regionByPrefix.has(code)) regionByPrefix.set(code, district.region);
    const key = district.region ? satoRegionNameKey(district.region.name) : "";
    if (district.region && key && !regionByName.has(key)) regionByName.set(key, district.region);
  }
  const missing: SatoMissingRow[] = preview.missing.map((entry) => {
    // Viloyat: `sato_code` prefiksi (4 raqam), zaxira — rasmiy viloyat nomi («Samarqand viloyati» ↔ «Samarqand»).
    const region =
      regionByPrefix.get(entry.satoCode.slice(0, 4)) ??
      (entry.regionName ? regionByName.get(satoRegionNameKey(entry.regionName)) : undefined);
    return {
      kind: "missing",
      satoCode: entry.satoCode,
      satoName: entry.satoName,
      regionId: region?.id ?? null,
      regionName: region?.name ?? entry.regionName ?? "—",
    };
  });

  return {
    rows: {
      found: found.sort(byName),
      notFound: notFound.sort(byName),
      hasCode: hasCode.sort(byName),
      duplicates,
      missing: missing.sort(
        (a, b) => collator.compare(a.regionName, b.regionName) || collator.compare(a.satoName, b.satoName),
      ),
    },
    duplicateGroups,
  };
};

/** Admin: faqat `/district` — «Kodsiz» va «Kodi bor» (takroriylar ham kiradi; shuning uchun son superadmindan ko'p). */
export const buildAdminSatoView = (
  districts: readonly SatoDistrict[],
): Required<Pick<SatoTabRows, (typeof ADMIN_SATO_TABS)[number]>> => ({
  noCode: districts.filter((district) => !district.satoCode).map((district) => toRow(district)).sort(byName),
  hasCode: districts.filter((district) => district.satoCode).map((district) => toRow(district)).sort(byName),
});

/** Viloyat filtri variantlari — `/district` dagi viloyatlar, nom bo'yicha. */
export const satoRegionOptions = (districts: readonly SatoDistrict[]): { value: string; label: string }[] => {
  const regions = new Map<string, string>();
  for (const district of districts) {
    if (district.region && !regions.has(district.region.id)) regions.set(district.region.id, district.region.name);
  }
  return [...regions.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => collator.compare(a.label, b.label));
};

/** Qidiruv uchun: kichik harf, apostrof turlari bitta (`O‘zbek`, `O'zbek`, `O`zbek`). */
export const normalizeSatoQuery = (value: string): string =>
  value
    .toLocaleLowerCase("uz")
    .normalize("NFKC")
    .replace(/[‘’ʻʼ`´]/g, "'")
    .replace(/\s+/g, " ")
    .trim();

const searchableText = (row: SatoRow): string =>
  row.kind === "missing"
    ? [row.satoName, row.regionName, row.satoCode].join(" ")
    : [row.name, row.regionName, row.satoCode ?? "", row.foundCode ?? "", row.officialName ?? ""].join(" ");

/** Qidiruv (tuman, viloyat yoki kod) va viloyat filtri. */
export const filterSatoRows = <T extends SatoRow>(
  rows: readonly T[],
  { search, regionId }: { search: string; regionId: string | null },
): T[] => {
  const query = normalizeSatoQuery(search);
  return rows.filter((row) => {
    if (regionId && row.regionId !== regionId) return false;
    if (!query) return true;
    return normalizeSatoQuery(searchableText(row)).includes(query);
  });
};

/** Klient sahifalash: sahifa chegaradan chiqsa oxirgi sahifa olinadi. */
export const paginateSatoRows = <T>(rows: readonly T[], page: number, pageSize: number) => {
  const size = Math.max(1, Math.floor(pageSize) || 1);
  const totalPages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
  return { page: current, totalPages, items: rows.slice((current - 1) * size, current * size) };
};

/** Backend DTO: `sato_code` — `^\d+$`. */
export const isValidSatoCode = (value: string): boolean => /^\d+$/.test(value.trim());

/** «Mos keldi» meter'i: mos kelganlar / bazadagi jami (0–100). */
export const satoMatchedPercent = (stats: SatoPreviewStats): number =>
  stats.totalDb > 0 ? Math.min(100, (stats.matchedCount / stats.totalDb) * 100) : 0;

/** `GET district/sato/:code` → kod egasi (409 «kod band» xabari uchun). */
export const normalizeSatoOwner = (payload: unknown): { id: string; name: string; regionName: string | null } | null => {
  const district = asRecord(unwrap(payload));
  const id = asString(district.id);
  const name = asString(district.name);
  if (!id || !name) return null;
  const region = asRecord(district.region);
  return { id, name, regionName: asString(region.name) || null };
};

/** Qatorni tahrirlashda maydonning boshlang'ich qiymati: saqlangan kod, bo'lmasa topilgan kod. */
export const satoDraftFor = (row: SatoDistrictRow): string => row.satoCode ?? row.foundCode ?? "";


/* ─── SA-2: kodlarni yozish, tuman qo'shish, takroriylar ─────────────────────────────────────────────── */

const apostrophes = (value: string) => value.replace(/[‘’ʻʼ`´]/g, "'");

/**
 * Viloyat nomi kaliti: «Samarqand viloyati» = «Samarqand», «Toshkent shahri» = «Toshkent sh.» (lekin «Toshkent
 * viloyati» ≠ «Toshkent sh.»).
 */
export const satoRegionNameKey = (value: string): string =>
  apostrophes(value.toLocaleLowerCase("uz").normalize("NFKC"))
    .replace(/(^|\s)(sh\.?|shahar)(?=\s|$)/g, "$1shahri")
    .replace(/(^|\s)(viloyati|viloyat|respublikasi)(?=\s|$)/g, " ")
    .replace(/[.,()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Tuman nomining o'zagi: «Urgut tumani» = «Urgut sh.» = «urgut» (o'xshash nom ogohlantirishi uchun). */
export const satoNameStem = (value: string): string =>
  apostrophes(value.toLocaleLowerCase("uz").normalize("NFKC"))
    .replace(/[.,()]/g, " ")
    .replace(/(^|\s)(tumani|tuman|shahri|shahar|sh|t)(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * «Tuman qo'shish»: shu viloyatda o'xshash nomli tuman (o'zagi teng yoki biri ikkinchisining boshi, ≥ 4 harf).
 * Viloyat tanlanmagan bo'lsa — butun bazadan.
 */
export const findSimilarSatoDistrict = (
  districts: readonly SatoDistrict[],
  { name, regionId }: { name: string; regionId: string | null },
): SatoDistrict | null => {
  const stem = satoNameStem(name);
  if (stem.length < 3) return null;
  const similar = (other: string) => {
    if (!other) return false;
    if (other === stem) return true;
    const [short, long] = other.length < stem.length ? [other, stem] : [stem, other];
    return short.length >= 4 && long.startsWith(short);
  };
  return (
    districts.find(
      (district) => (!regionId || district.region?.id === regionId) && similar(satoNameStem(district.name)),
    ) ?? null
  );
};

/** «SATO kodlarini yozish» oynasining xulosasi (maket `superadmin-regions-sato-codes-apply-dialog`). */
export type SatoApplySummary = {
  /** Yoziladi — «Topildi» tabi (N tugmadagi son). */
  write: number;
  /** O'zgarmaydi — «Kodi bor». */
  unchanged: number;
  /** Yozilmaydi — topilmagan + takroriy yozuvlar. */
  skipped: number;
  notFound: number;
  duplicates: number;
  /** Yoziladigan tumanlar id'lari (haqiqiy holatni qayta yuklangan ro'yxatdan sanash uchun). */
  ids: string[];
  /** Ro'yxatdagi birinchi 3 ta tuman. */
  preview: SatoDistrictRow[];
  /** «yana N ta tuman». */
  rest: number;
};

export const SATO_APPLY_PREVIEW = 3;

export const satoApplySummary = (rows: SatoTabRows): SatoApplySummary => {
  const found = (rows.found ?? []).filter((row): row is SatoDistrictRow => row.kind === "district");
  const notFound = rows.notFound?.length ?? 0;
  const duplicates = rows.duplicates?.length ?? 0;
  return {
    write: found.length,
    unchanged: rows.hasCode?.length ?? 0,
    skipped: notFound + duplicates,
    notFound,
    duplicates,
    ids: found.map((row) => row.id),
    preview: found.slice(0, SATO_APPLY_PREVIEW),
    rest: Math.max(0, found.length - SATO_APPLY_PREVIEW),
  };
};

/** `POST district/sato-match/apply` → `appliedCount` (bo'lmasa `null`). */
export const parseSatoAppliedCount = (payload: unknown): number | null => {
  const data = asRecord(unwrap(payload));
  const value = Number(data.appliedCount);
  return Number.isFinite(value) && value >= 0 ? value : null;
};

/** Haqiqiy holat (504, aloqa uzildi, qisman yozildi): `ids` dan nechtasida endi kod bor (qayta yuklangan `/district`). */
export const countSatoCodesWritten = (ids: readonly string[], districts: readonly SatoDistrict[]): number => {
  const withCode = new Set(districts.filter((district) => district.satoCode).map((district) => district.id));
  return ids.filter((id) => withCode.has(id)).length;
};

/** Takroriy nomlar guruhi (jadvaldagi sarlavha qatori + yozuvlar). */
export type SatoDuplicateGroup = {
  key: string;
  name: string;
  rows: SatoDistrictRow[];
  /** Turli viloyatlar nomlari (sarlavhadagi «Toshkent sh., Toshkent viloyati»). */
  regionNames: string[];
  /**
   * Birlashtirish: bitta viloyatda ≥ 2 yozuv bo'lsa — manba (o'chadi) va maqsad (qoladi), aks holda `null`
   * («Turli viloyatda — birlashtirilmaydi»).
   */
  merge: { source: SatoDistrictRow; target: SatoDistrictRow } | null;
};

/** ID bo'yicha (raqamli: «31» < «142»). */
const byIdNumber = (a: SatoDistrictRow, b: SatoDistrictRow) => collator.compare(a.id, b.id);

/**
 * Sukut (ega S4): kodsiz yozuv → kodli yozuv («SATO kodi N saqlanadi»). Ikkalasida kod bor yoki hech birida yo'q
 * (maket yo'q, ochiq savol): maqsad — eski yozuv (kichik ID), manba — eng yangisi; maqsadni oynada o'zgartirsa bo'ladi.
 */
export const pickSatoMerge = (
  rows: readonly SatoDistrictRow[],
): { source: SatoDistrictRow; target: SatoDistrictRow } | null => {
  const byRegion = new Map<string, SatoDistrictRow[]>();
  for (const row of rows) {
    if (!row.regionId) continue;
    byRegion.set(row.regionId, [...(byRegion.get(row.regionId) ?? []), row]);
  }
  const bucket = [...byRegion.values()].find((items) => items.length >= 2);
  if (!bucket) return null;
  const sorted = [...bucket].sort(byIdNumber);
  const coded = sorted.filter((row) => row.satoCode);
  const uncoded = sorted.filter((row) => !row.satoCode);
  // Kodsiz yozuv bor bo'lsa — hech qachon kodli yozuv o'chirilmaydi: eng yangi kodsiz → eng eski kodli.
  if (coded.length > 0 && uncoded.length > 0) return { source: uncoded[uncoded.length - 1], target: coded[0] };
  return { source: sorted[sorted.length - 1], target: sorted[0] };
};

/**
 * «Takroriy nomlar» qatorlari (`duplicateGroup` bo'yicha) → guruhlar, tartib saqlanadi. `key` — guruhdagi eng kichik
 * tuman ID si (barqaror: birlashtirilgach indekslar siljiydi, React va fokus boshqa guruhga o'tib ketmasin).
 */
export const groupSatoDuplicates = (rows: readonly SatoRow[]): SatoDuplicateGroup[] => {
  const groups = new Map<string, SatoDistrictRow[]>();
  for (const row of rows) {
    if (row.kind !== "district") continue;
    const index = String(row.duplicateGroup ?? row.id);
    groups.set(index, [...(groups.get(index) ?? []), row]);
  }
  return [...groups.values()].map((items) => ({
    key: [...items].sort(byIdNumber)[0].id,
    name: items[0].name,
    rows: items,
    regionNames: [...new Set(items.map((row) => row.regionName))],
    merge: pickSatoMerge(items),
  }));
};

/** Qidiruv/viloyat filtri: guruhning birorta yozuvi mos kelsa — butun guruh (birlashtirish uchun hammasi kerak). */
export const filterSatoDuplicateGroups = (
  groups: readonly SatoDuplicateGroup[],
  filter: { search: string; regionId: string | null },
): SatoDuplicateGroup[] => groups.filter((group) => filterSatoRows(group.rows, filter).length > 0);

/** Birlashtirish maqsadlari — manba viloyatidagi (`region_id`) boshqa tumanlar, nom va ID bo'yicha (ega S2). */
export const satoMergeCandidates = (
  districts: readonly SatoDistrict[],
  source: { id: string; regionId: string | null },
): SatoDistrict[] =>
  districts
    .filter((district) => district.id !== source.id && source.regionId && district.region?.id === source.regionId)
    .sort((a, b) => collator.compare(a.name, b.name) || collator.compare(a.id, b.id));
