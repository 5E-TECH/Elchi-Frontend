/** Doska tumani: id, nom va GEOGRAFIK viloyati (`region` / `region_id`; ko'chirilgan tumanda ustundan farq qiladi). */
export type BoardDistrictItem = {
  id: string;
  name: string;
  /** Tumanning o'z (geografik) viloyati — SATO prefiksi shu viloyat bo'yicha; noma'lum bo'lsa `null`. */
  geoRegionId: string | null;
  geoRegionName: string | null;
};

/** Doska ustuni: viloyat va unga BIRIKTIRILGAN tumanlar (`assigned_region ?? region_id`). */
export type BoardRegionItem = {
  id: string;
  name: string;
  /** Viloyat SOATO kodi (4 raqam, `GET /region` `sato_code`) — yangi tuman kodi shu bilan boshlanadi; yo'q — `null`. */
  satoCode: string | null;
  districts: BoardDistrictItem[];
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const asId = (value: unknown): string =>
  typeof value === "string" ? value : typeof value === "number" ? String(value) : "";

const asText = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value : null;

/** `{ statusCode, data }` konverti (bir yoki ikki qavat) yoki `{ items }` → ro'yxat. */
const listOf = (payload: unknown): unknown[] => {
  let body: unknown = payload;
  for (let depth = 0; depth < 3; depth += 1) {
    if (Array.isArray(body)) return body;
    const record = asRecord(body);
    if (Array.isArray(record.items)) return record.items;
    if (!("data" in record)) return [];
    body = record.data;
  }
  return Array.isArray(body) ? body : [];
};

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "uz");

/**
 * `GET /region` → doska ustunlari (`/regions/districts` va `/regions/sato-management`). Ustun — viloyatga
 * BIRIKTIRILGAN tumanlar (`assignedDistricts`, backend 2026-11-01): `PATCH district/:id {assigned_region}` dan keyin
 * ko'chirilgan tuman yangi viloyatida qoladi (avval geografik `districts` chizilib, eski viloyatiga «sakrab»
 * qaytardi). Maydon yo'q bo'lsa (eski backend, e2e mock'lari) — geografik `districts`. Tumanlar nom bo'yicha.
 */
export const normalizeBoardRegions = (payload: unknown): BoardRegionItem[] =>
  listOf(payload).map((item) => {
    const region = asRecord(item);
    const id = asId(region.id);
    const name = asText(region.name) ?? "—";
    const assigned = Array.isArray(region.assignedDistricts) ? region.assignedDistricts : null;
    const source = assigned ?? (Array.isArray(region.districts) ? region.districts : []);
    const districts = source
      .map((entry): BoardDistrictItem => {
        const district = asRecord(entry);
        const geo = asRecord(district.region);
        // Geografik `districts` da `region` yo'q — tuman shu viloyatniki.
        const geoRegionId = asId(geo.id) || asId(district.region_id) || (assigned ? "" : id) || null;
        const geoRegionName = asText(geo.name) ?? (geoRegionId && geoRegionId === id ? name : null);
        return {
          id: asId(district.id),
          name: asText(district.name) ?? "—",
          geoRegionId,
          geoRegionName,
        };
      })
      .filter((district) => district.id)
      .sort(byName);
    return { id, name, satoCode: asText(region.sato_code)?.trim() ?? null, districts };
  });

/** Viloyat + tumanlar doskasi qidiruvi: viloyat nomi mos kelsa — hamma tumanlari, aks holda mos tumanlar. */
export const filterBoardRegions = <
  D extends { name: string },
  R extends { name: string; districts: D[] },
>(
  regions: R[],
  search: string,
): R[] => {
  const term = search.trim().toLocaleLowerCase("uz");
  if (!term) return regions;
  return regions
    .map((region) => ({
      ...region,
      districts: region.name.toLocaleLowerCase("uz").includes(term)
        ? region.districts
        : region.districts.filter((district) =>
            district.name.toLocaleLowerCase("uz").includes(term),
          ),
    }))
    .filter(
      (region) => region.districts.length > 0 || region.name.toLocaleLowerCase("uz").includes(term),
    );
};
