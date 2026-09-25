/**
 * Matnni buferga nusxalaydi va HAQIQATAN nusxalanganini qaytaradi.
 *
 * `navigator.clipboard` xavfsiz bo'lmagan kontekstda (http) va ba'zi ilova
 * ichidagi brauzerlarda umuman yo'q, `writeText` esa ruxsat berilmasa yoki
 * hujjat fokusda bo'lmasa rad etadi. Natijani tekshirmasdan "nusxalandi"
 * deyish foydalanuvchini aldardi — u bo'sh buferni joylashtirardi.
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};
