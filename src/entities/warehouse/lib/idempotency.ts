import { useCallback, useRef } from "react";

/**
 * `Idempotency-Key` (kirim va inventarizatsiya — backend MAJBURIY, 8–128 `[A-Za-z0-9._:-]`).
 * `crypto.randomUUID` faqat xavfsiz kontekstda (https/localhost) — aks holda vaqt + tasodifiy qism.
 */
export const createIdempotencyKey = (): string =>
  typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

/**
 * Oyna sessiyasidagi kalitlar: kalit yuborilayotgan tarkibning «barmoq izi»ga bog'lanadi. AYNI tarkib qayta
 * yuborilsa (javobi kelmagan urinish — 504, tarmoq) — o'sha kalit: backend natijani qaytaradi (`replayed: true`),
 * qoldiq ikki marta o'zgarmaydi. Tarkib o'zgarsa — bu boshqa yozuv, yangi kalit (eski kalit boshqa tarkib bilan
 * 409 berardi). Avvalgi tarkibning kaliti saqlanib turadi: A javobsiz qolib, B yuborilib, so'ng yana A yuborilsa —
 * A o'z kalitini oladi. Muvaffaqiyatdan keyin `reset()` — keyingi yuborish yangi yozuv.
 */
export const useIdempotencyKeys = () => {
  const keysRef = useRef(new Map<string, string>());
  const take = useCallback((fingerprint: string) => {
    const existing = keysRef.current.get(fingerprint);
    if (existing) return existing;
    const key = createIdempotencyKey();
    keysRef.current.set(fingerprint, key);
    return key;
  }, []);
  const reset = useCallback(() => keysRef.current.clear(), []);
  return { take, reset };
};

/**
 * Natijasi noma'lum xato: javob umuman kelmadi (tarmoq, timeout) yoki proxy javobni kutmadi (502/503/504). Bunda
 * server yozuvni bajargan bo'lishi MUMKIN — ro'yxat qayta o'qiladi, qayta yuborish AYNI kalit bilan xavfsiz.
 */
export const isUncertainWriteError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const response = (error as { response?: { status?: unknown } }).response;
  if (!response) return true;
  const status = Number(response.status);
  return status === 502 || status === 503 || status === 504;
};
