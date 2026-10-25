import { useCallback, useRef } from "react";
import type { CreateOrderRequest } from "../types/order";

/**
 * BUYURTMA YARATISH IDEMPOTENTLIGI (gpCIsGjH). Gateway `POST /orders` `Idempotency-Key` sarlavhasini o'qiydi
 * (≤ 255 belgi): AYNI kalit bilan takroriy so'rov ikkinchi buyurtma yaratmaydi — avvalgi javob
 * `idempotent_replay: true` bilan qaytadi, birinchisi hali bajarilayotgan bo'lsa 409. Kalit faqat kalitning
 * o'zidan (tanasiz) hisoblanadi — shuning uchun u tarkibning «barmoq izi»ga bog'lanadi:
 *  - AYNI tarkib qayta yuborilsa (javobi kelmagan urinish — 20 s timeout, tarmoq, 502/503/504; ikki marta bosish)
 *    — o'sha kalit, buyurtma bir marta yaratiladi;
 *  - forma o'zgarsa — bu boshqa buyurtma, yangi kalit (eski kalit bilan backend yangi tarkibni yaratmay, avvalgi
 *    buyurtmani qaytarardi);
 *  - muvaffaqiyatdan keyin `reset()` — keyingi buyurtma yangi kalit bilan.
 * Avvalgi tarkibning kaliti saqlanib turadi: A javobsiz qolib, B yuborilib, so'ng yana A yuborilsa — A o'z kalitini
 * oladi (pul to'lovlaridagi `paymentIdempotency` naqshi). Kalitlar forma sessiyasida (xotirada) — sahifa yangilansa
 * forma ham bo'shaydi.
 */

/** `crypto.randomUUID` faqat xavfsiz kontekstda (https/localhost) — aks holda vaqt + tasodifiy qism. */
const newIdempotencyKey = (): string =>
  typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

/** Yuboriladigan tarkibning barmoq izi (`buildCreateOrderPayload` kalitlari tartibi barqaror). */
export const createOrderFingerprint = (payload: CreateOrderRequest): string => JSON.stringify(payload);

export const useCreateOrderIdempotencyKeys = () => {
  const keysRef = useRef(new Map<string, string>());
  const take = useCallback((payload: CreateOrderRequest) => {
    const fingerprint = createOrderFingerprint(payload);
    const existing = keysRef.current.get(fingerprint);
    if (existing) return existing;
    const key = newIdempotencyKey();
    keysRef.current.set(fingerprint, key);
    return key;
  }, []);
  const reset = useCallback(() => keysRef.current.clear(), []);
  return { take, reset };
};
