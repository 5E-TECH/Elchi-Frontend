import type { RollbackTarget } from "./rollbackTarget";

/**
 * QAYTARISH (`POST /orders/rollback/:id`) `Idempotency-Key` kalitlari (BE #738; kuryer amallari BOT-3d naqshi).
 *
 * Backend kalitni «amal + buyurtma + tana» ga bog'laydi: ayni kalit takror kelsa — saqlangan natija (200, amal
 * ikkinchi marta bajarilmaydi), ayni kalit BOSHQA tana bilan — 422, bajarilayotgan bo'lsa — 409. Yiqilgan urinish
 * saqlanmaydi (qayta urinish yangidan baholanadi). Shuning uchun:
 *  - kalit «buyurtma + maqsad holat» uchun bitta: bitta bosish — bitta kalit, qayta urinishda (javob kelmadi, 503,
 *    409, «holat o'zgardi») AYNI kalit — rollback ikki marta bajarilmaydi;
 *  - muvaffaqiyatdan keyin kalit tashlanadi (keyingi rollback — masalan qayta sotilgandan keyin — yangi amal);
 *  - 422 (kalit boshqa tanaga bog'langan) — kalit tashlanadi, keyingi urinish yangisini oladi;
 *  - kalit xotirada (sahifalar o'rtasida umumiy: ro'yxatda javobsiz qolgan urinish tafsilotda o'sha kalit bilan
 *    qaytariladi) va `KEY_TTL_MS` dan keyin yangilanadi — backend saqlangan natijani shuncha vaqt ushlaydi.
 */
const KEY_TTL_MS = 10 * 60_000;

const keys = new Map<string, { key: string; createdAt: number }>();

/** `crypto.randomUUID` faqat xavfsiz kontekstda (https/localhost) — aks holda vaqt + tasodifiy qism. */
const newKey = (): string =>
  typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

const slot = (orderId: string | number, target: RollbackTarget) => `${String(orderId)}:${target}`;

/** Shu buyurtma + maqsad uchun kalit: avvalgi (natijasi noma'lum yoki rad etilgan) urinishniki bo'lsa — o'sha. */
export const takeRollbackKey = (orderId: string | number, target: RollbackTarget, now = Date.now()): string => {
  const id = slot(orderId, target);
  const existing = keys.get(id);
  if (existing && now - existing.createdAt < KEY_TTL_MS) return existing.key;
  const key = newKey();
  keys.set(id, { key, createdAt: now });
  return key;
};

/** Amal yakunlandi (muvaffaqiyat yoki 422) — faqat shu buyurtma + maqsadning kaliti tashlanadi. */
export const settleRollbackKey = (orderId: string | number, target: RollbackTarget) => {
  keys.delete(slot(orderId, target));
};

/** Testlar uchun: barcha kalitlarni tozalash. */
export const resetRollbackKeys = () => keys.clear();
