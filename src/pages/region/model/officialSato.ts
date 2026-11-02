/**
 * «Yangi tuman qo'shish»: viloyatning RASMIY SOATO ro'yxati (`GET district/sato-official/:regionId`, admin va
 * superadmin). Admin kodni yoddan bilmaydi — ro'yxatdan tanlaydi yoki nomni yozadi va kod o'zi tushadi.
 * `takenBy` — kod tizimda band (tuman yoki viloyatda), bunday qatorni qo'shib bo'lmaydi. Viloyat rasmiy
 * ro'yxatda bo'lmasa — bo'sh ro'yxat (kod qo'lda kiritiladi).
 */
export type OfficialSatoDistrict = {
  name: string;
  satoCode: string;
  takenBy: { kind: "district" | "region"; id: string; name: string } | null;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const asString = (value: unknown): string =>
  typeof value === "string" ? value : typeof value === "number" ? String(value) : "";

export const normalizeOfficialSato = (payload: unknown): OfficialSatoDistrict[] => {
  const envelope = asRecord(payload);
  const body = asRecord("data" in envelope ? envelope.data : payload);
  const items = Array.isArray(body.items) ? body.items : [];
  return items
    .map((item) => {
      const entry = asRecord(item);
      const holder = entry.taken_by ? asRecord(entry.taken_by) : null;
      return {
        name: asString(entry.name).trim(),
        satoCode: asString(entry.sato_code).trim(),
        takenBy: holder
          ? {
              kind: holder.kind === "region" ? ("region" as const) : ("district" as const),
              id: asString(holder.id),
              name: asString(holder.name),
            }
          : null,
      };
    })
    .filter((item) => item.name && /^\d{7}$/.test(item.satoCode));
};

/**
 * Nom kaliti: katta-kichik harf, apostrof («O'rtachirchiq» = «Ortachirchiq») va «tumani» farq qilmaydi, «shahri»
 * saqlanadi («Bekobod» = «Bekobod tumani», lekin ≠ «Bekobod shahri»).
 */
export const officialSatoNameKey = (value: string): string =>
  value
    .toLocaleLowerCase("uz")
    .normalize("NFKC")
    .replace(/[‘’ʻʼ`´']/g, "")
    .replace(/[.,()]/g, " ")
    .replace(/(^|\s)(sh|shahar)(?=\s|$)/g, "$1shahri")
    .replace(/(^|\s)(tumani|tuman)(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Yozilgan nomga aynan mos keladigan BO'SH rasmiy tuman (bittadan ortiq bo'lsa — hech biri). */
export const findOfficialSatoByName = (
  items: readonly OfficialSatoDistrict[],
  name: string,
): OfficialSatoDistrict | null => {
  const key = officialSatoNameKey(name);
  if (!key) return null;
  const matches = items.filter((item) => !item.takenBy && officialSatoNameKey(item.name) === key);
  return matches.length === 1 ? matches[0] : null;
};
