/**
 * BRAUZER QURILMA ID SI — `X-Device-Id` (Elchi Pochta #3, «Sessiyalar»).
 *
 * Backend har login'ni alohida sessiya qilib yozadi va qurilmani so'rov sarlavhasidan oladi (`X-Device-Id`
 * bo'lmasa — faqat User-Agent). Shu brauzer uchun bir marta yaratilgan tasodifiy ID `localStorage` da turadi
 * (chiqishda o'chirilmaydi — bu foydalanuvchi emas, qurilma belgisi; shaxsiy ma'lumot yo'q) va faqat ilovaning o'z
 * API'siga — `POST auth/login` va `POST auth/refresh` (`authService`) bilan yuboriladi, uchinchi tomonga emas.
 * Saqlab bo'lmasa (maxfiy rejim, bloklangan sayt ma'lumoti) — sarlavha yuborilmaydi, kirish odatdagidek ishlaydi.
 */
export const DEVICE_ID_STORAGE_KEY = "elchi_device_id";
export const DEVICE_ID_HEADER = "X-Device-Id";

/** Saqlangan qiymat tekshiruvi: faqat shu modul yaratadigan ko'rinish (UUID yoki 32 xonali hex). */
const VALID_ID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

const createDeviceId = (): string | null => {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi) return null;
  // `randomUUID` faqat xavfsiz kontekstda (https / localhost); aks holda `getRandomValues` dan 128 bit.
  if (typeof cryptoApi.randomUUID === "function") return cryptoApi.randomUUID();
  if (typeof cryptoApi.getRandomValues !== "function") return null;
  return Array.from(cryptoApi.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

/** Shu brauzerning qurilma ID si: bor bo'lsa — o'sha, yo'q yoki buzilgan bo'lsa — yangisi; saqlab bo'lmasa `null`. */
export const getDeviceId = (): string | null => {
  try {
    const storage = window.localStorage;
    const stored = storage.getItem(DEVICE_ID_STORAGE_KEY);
    if (stored && VALID_ID.test(stored)) return stored;
    const next = createDeviceId();
    if (!next) return null;
    storage.setItem(DEVICE_ID_STORAGE_KEY, next);
    // Saqlanmagan ID har so'rovda yangi bo'lardi — barqaror bo'lmasa yubormaymiz.
    return storage.getItem(DEVICE_ID_STORAGE_KEY) === next ? next : null;
  } catch {
    return null;
  }
};

/** `authClient` so'roviga qo'shiladigan sarlavha (ID bo'lmasa — bo'sh ob'ekt). */
export const deviceIdHeaders = (): Record<string, string> => {
  const id = getDeviceId();
  return id ? { [DEVICE_ID_HEADER]: id } : {};
};
