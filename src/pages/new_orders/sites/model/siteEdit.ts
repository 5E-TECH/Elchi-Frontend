import { toSitePreview, withPath, type SiteFieldMapping, type SiteOrderPreview } from "./siteOrder";

/**
 * SAYTDAN XATO KELGAN MA'LUMOTNI SHU YERDA TUZATISH (ega 2026-11-25).
 *
 * Telefon raqami xato formatda kelsa server buyurtmani yaratmaydi (`phone_invalid`) va posilka osilib qolardi: uni
 * tuzatadigan joy yo'q edi. Endi muammo skanerlanishi bilan ko'rinadi va operator qatorning o'zida to'g'rilaydi.
 * Tuzatilgan qiymat serverga ketadigan `payload` ga, ulanish xaritasidagi maydonga yoziladi.
 */

/** Mijoz telefoni — backend `normalizeUzPhone` bilan AYNI qoida: to'ldirmaydi, kesmaydi; mos kelmasa `null`. */
export const normalizeSitePhone = (input: unknown): string | null => {
  if (typeof input === "number" ? !Number.isSafeInteger(input) || input < 0 : typeof input !== "string") return null;
  let digits = String(input).replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("998")) digits = digits.slice(3);
  else if (digits.length === 10 && /^[08]/.test(digits)) digits = digits.slice(1);
  return /^\d{9}$/.test(digits) ? `+998${digits}` : null;
};

/** Tuman (`GET district`): saytning kodi SOATO yoki Elchi id'si bo'lishi mumkin. */
export type SiteDistrict = { id: string; name: string; sato: string | null; regionId: string; regionName: string };

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const asText = (value: unknown): string =>
  typeof value === "string" || typeof value === "number" ? String(value).trim() : "";

/** `GET district` javobi → tumanlar. Viloyat — xizmat viloyati (buyurtma tushadigan pochta), bo'lmasa o'zi. */
export const toSiteDistricts = (body: unknown): SiteDistrict[] => {
  const outer = asRecord(body);
  const rows = [body, outer.data, asRecord(outer.data).data].find(Array.isArray) ?? [];
  return rows.flatMap((value) => {
    const row = asRecord(value);
    const id = asText(row.id);
    const name = asText(row.name);
    if (!id || !name) return [];
    const serving = asRecord(row.assignedToRegion);
    const own = asRecord(row.region);
    const region = asText(serving.id) ? serving : own;
    return [
      {
        id,
        name,
        sato: asText(row.sato_code) || null,
        regionId: asText(region.id) || asText(row.assigned_region) || asText(row.region_id),
        regionName: asText(region.name),
      },
    ];
  });
};

/** Sayt kodi → tuman; server bilan bir xil tartib: avval SOATO, keyin id. */
export const findSiteDistrict = (districts: readonly SiteDistrict[], code: string): SiteDistrict | null => {
  if (!code) return null;
  return districts.find((item) => item.sato === code) ?? districts.find((item) => item.id === code) ?? null;
};

export type SiteProblem = "phone_missing" | "phone_invalid" | "district_unresolved" | "price_invalid";

/**
 * Qatordagi muammolar — server aynan shu sabablar bilan rad etardi. Tumanlar ro'yxati kelmagan bo'lsa (`null`)
 * tuman tekshirilmaydi: ro'yxat yuklanmagani uchun to'g'ri buyurtma to'silmasin.
 */
export const siteProblems = (row: SiteOrderPreview, districts: readonly SiteDistrict[] | null): SiteProblem[] => {
  const problems: SiteProblem[] = [];
  if (!row.phone) problems.push("phone_missing");
  else if (!normalizeSitePhone(row.phone)) problems.push("phone_invalid");
  if (districts?.length && !findSiteDistrict(districts, row.districtCode)) problems.push("district_unresolved");
  if (row.amount === null) problems.push("price_invalid");
  return problems;
};

/** Oynadan kelgan qiymatlar; `undefined` — o'zgarmagan (payload'dagi qiymat tegilmaydi). */
export type SiteOrderEdit = {
  name?: string;
  phone?: string;
  address?: string;
  /** Yangi tumanning SOATO kodi (bo'lmasa id) — server ikkalasini ham biladi. */
  districtCode?: string;
  /** Faqat sayt summasi o'qilmagan bo'lsa: jami (yetkazish bilan). */
  amount?: number;
};

/**
 * Tuzatilgan qator: payload ulanish xaritasi bo'yicha yangilanadi, ko'rinish undan qayta o'qiladi. Kalit (QR)
 * o'zgarmaydi, eski xato o'chadi, `edited` belgisi qoladi.
 */
export const applySiteEdit = (
  row: SiteOrderPreview,
  mapping: SiteFieldMapping,
  edit: SiteOrderEdit,
): SiteOrderPreview => {
  let payload = row.payload;
  const set = (path: string, value: unknown) => {
    payload = withPath(payload, path, value);
  };
  if (edit.name !== undefined) set(mapping.customer_name_field, edit.name);
  if (edit.phone !== undefined) set(mapping.phone_field, edit.phone);
  if (edit.address !== undefined) set(mapping.address_field, edit.address);
  if (edit.districtCode !== undefined) set(mapping.district_code_field, edit.districtCode);
  if (edit.amount !== undefined) {
    set(mapping.total_price_field, edit.amount);
    set(mapping.delivery_price_field, 0);
  }
  return { ...toSitePreview(payload, mapping, row.qr), key: row.key, qr: row.qr, error: undefined, edited: true };
};
