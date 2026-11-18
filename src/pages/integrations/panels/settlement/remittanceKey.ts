import { createIdempotencyKey } from "../../../../entities/warehouse/lib/idempotency";

/**
 * «TO'LOV OLINDI» IDEMPOTENTLIK KALITI (ZE5zqXxu; backend N3yNa6rO — gateway `POST integrations/:id/remittances`
 * `Idempotency-Key` ni o'qiydi, integration-service hamkor qulfi ostida ayni kalitli to'lovni qidiradi va topsa
 * birinchisini qaytaradi: yangi to'lov ochilmaydi, kassaga ikkinchi kirim yozilmaydi).
 *
 * Bitta mantiqiy to'lovga bitta kalit: oynadagi birinchi «Yozish» da yaratiladi va MUVAFFAQIYATLI JAVOB kelguncha
 * o'zgarmaydi. Ikki marta bosish, tarmoq uzilishi yoki 502–504 dan keyin qayta yuborish, oynani yopib qayta ochish,
 * hatto sahifani yangilash (`sessionStorage`) ham o'sha kalitni yuboradi. Javob kelgach (yangi yoki takroriy) kalit
 * o'chadi — keyingi to'lov yangi kalit oladi. Xatodan keyin kalit saqlanadi: rad etilgan so'rov (4xx) hech narsa
 * yozmagan, kalitni qayta ishlatish zararsiz.
 *
 * Kalit summaga bog'lanmaydi (kuryer to'lovlaridagi barmoq izidan farqli — `pages/payments/components/lib/
 * paymentIdempotency.ts`): javobsiz urinishdan keyin summa tuzatilib qayta yuborilsa ham server birinchi to'lovni
 * qaytaradi — ikkinchi kirim yozilmaydi. Qaytgan summa kiritilganidan farq qilsa, oyna ochiq qoladi va «Kiritilgan
 * summa yozilmadi» deydi (yangi to'lov bo'lsa — qayta «Yozish», yangi kalit bilan; xato summa — «Olingan to'lovlar»
 * da bekor qilinadi); summa bir xil bo'lsa — «To'lov avval yozilgan edi» xabari. Ulanishlar bo'yicha alohida: backend ham kalitni hamkor ichida
 * qidiradi.
 */
const STORAGE_KEY = "elchi:pending-remittance-keys";
const MAX_PENDING = 20;

/** `sessionStorage` ga yozib bo'lmasa (xususiy rejim, kvota) — xotiradagi nusxa; aks holda `null`. */
let memory: Record<string, string> | null = null;

const readKeys = (): Record<string, string> => {
  if (memory) return { ...memory };
  try {
    const raw = globalThis.sessionStorage?.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? { ...(parsed as Record<string, string>) } : {};
  } catch {
    return {};
  }
};

const writeKeys = (keys: Record<string, string>) => {
  // Eng eskilaridan boshlab kesiladi — cheksiz o'smasin.
  const bounded = Object.fromEntries(Object.entries(keys).slice(-MAX_PENDING));
  try {
    if (!globalThis.sessionStorage) throw new Error("no sessionStorage");
    globalThis.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(bounded));
    memory = null;
  } catch {
    memory = bounded;
  }
};

/** Shu ulanishdagi to'lov kaliti: javobi kelmagan urinish bo'lsa — o'sha, aks holda yangi. */
export const takeRemittanceKey = (integrationId: string): string => {
  const keys = readKeys();
  const existing = keys[integrationId];
  if (existing) return existing;
  const key = createIdempotencyKey();
  keys[integrationId] = key;
  writeKeys(keys);
  return key;
};

/** To'lovga javob keldi (yozildi yoki avval yozilgan) — keyingi to'lov yangi kalit oladi. */
export const settleRemittanceKey = (integrationId: string) => {
  const keys = readKeys();
  if (!(integrationId in keys)) return;
  delete keys[integrationId];
  writeKeys(keys);
};
