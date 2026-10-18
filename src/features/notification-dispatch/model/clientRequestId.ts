import type { DispatchPayload } from "./schema";

/**
 * `client_request_id` (backend 7Vozou5x, `POST /notifications/dispatch`) — bitta yuborish urinishining UUID'si.
 * Backend uni `dispatch_id` qiladi: ayni id bilan kelgan takroriy so'rov xabarni IKKINCHI marta yubormaydi, tarixdagi
 * natijani qaytaradi (`duplicate: true` + `status`).
 *
 * Id xabar MAZMUNIGA (to'liq payload — qabul qiluvchilar, kanallar, matn, guruh kaliti) bog'lanadi, xuddi to'lovlarning
 * `Idempotency-Key` i kabi (`pages/payments/components/lib/paymentIdempotency.ts`):
 *   - aynan shu mazmun qayta yuborilsa (xatodan keyin «Yuborish» yana bosilsa) — o'sha id ketadi;
 *   - mazmun o'zgarsa — bu boshqa xabar, yangi id;
 *   - javob kelib yakunlansa (muvaffaqiyat yoki «avval yuborilgan») — faqat SHU mazmunning id'si o'chadi;
 *   - «Yangi xabar» — hammasi tozalanadi (guruh kaliti ham yangi, eski mazmun qaytib kelmaydi).
 * Har mazmun o'z id'sini alohida saqlaydi: A xato bersa, B yuborilsa, keyin yana A — A o'sha id bilan ketadi.
 */

/** Backend tekshiruvi (gateway DTO va notification-service) — kichik harfli UUID. */
export const CLIENT_REQUEST_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const toUuidV4 = (bytes: Uint8Array) => {
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

/**
 * Yangi UUID v4. `crypto.randomUUID` faqat xavfsiz kontekstda (https / localhost) bor — aks holda `getRandomValues`
 * (u http'da ham bor), u ham bo'lmasa `Math.random`. Natija har doim UUID: backend boshqa satrni 400 bilan qaytaradi.
 */
export const newClientRequestId = (): string => {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === "function") return cryptoApi.randomUUID().toLowerCase();
  const bytes = new Uint8Array(16);
  if (typeof cryptoApi?.getRandomValues === "function") {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  return toUuidV4(bytes);
};

/** Mazmunning barmoq izi — `client_request_id` ning o'zi kirmaydi. */
export const dispatchFingerprint = (payload: DispatchPayload) => {
  const content: Partial<DispatchPayload> = { ...payload };
  delete content.client_request_id;
  return JSON.stringify(content);
};

/** Forma umrida yashaydigan urinishlar: barmoq izi → id. */
export const createDispatchAttempts = () => {
  const ids = new Map<string, string>();
  return {
    /** Shu mazmunning id'si: avval yuborilgan (yakunlanmagan) bo'lsa — o'sha, aks holda yangi. */
    take(fingerprint: string) {
      const existing = ids.get(fingerprint);
      if (existing) return existing;
      const id = newClientRequestId();
      ids.set(fingerprint, id);
      return id;
    },
    /** Shu mazmun yakunlandi — keyingi yuborish yangi urinish. */
    settle(fingerprint: string) {
      ids.delete(fingerprint);
    },
    clear() {
      ids.clear();
    },
  };
};
