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
    duplicateGroups += 1;
    duplicates.push(...group);
  }

  const regionByPrefix = new Map<string, SatoRegionRef>();
  for (const district of districts) {
    const code = district.region?.satoCode;
    if (district.region && code && !regionByPrefix.has(code)) regionByPrefix.set(code, district.region);
  }
  const missing: SatoMissingRow[] = preview.missing.map((entry) => {
    const region = regionByPrefix.get(entry.satoCode.slice(0, 4));
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
