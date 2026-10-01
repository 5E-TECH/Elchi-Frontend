import axios from "axios";
import { getBackendErrorMessage } from "./backendError";

/**
 * Mutatsiya (sotish, bekor qilish, qaytarish, pochtaga yuborish...) rad
 * etilganda foydalanuvchiga ko'rsatiladigan matn (fix3 FE-ORD-02).
 *
 * Ilgari bu amallar faqat `onSuccess` bilan chaqirilardi: backend 400/403
 * qaytarsa spinner to'xtardi, oyna ochiq qolardi va HECH QANDAY sabab
 * ko'rinmasdi (masalan "Uyga yetkaziladigan buyurtmalarda qo'shimcha xarajat
 * yozish mumkin emas").
 *
 * - `null` — javob umuman kelmadi (tarmoq uzildi / vaqt tugadi). Uni
 *   interceptor "Tarmoq xatosi" bildirishnomasi bilan allaqachon ko'rsatgan —
 *   ikkinchi bildirishnoma shovqin.
 * - Server javob bergan bo'lsa — backend matni, bo'lmasa `fallback`.
 * - Axios bo'lmagan xato (masalan isbot fayli yuklanmadi) — `fallback`:
 *   ichki inglizcha matn foydalanuvchiga chiqmasin.
 */
export const getActionErrorMessage = (error: unknown, fallback: string): string | null => {
  if (!axios.isAxiosError(error)) return fallback;

  if (!error.response) {
    // Foydalanuvchi o'zi bekor qilgan so'rov tarmoq xatosi emas — u uchun
    // global bildirishnoma chiqmaydi, shuning uchun bu yerda ko'rsatiladi.
    return error.code === "ERR_CANCELED" ? fallback : null;
  }

  return getBackendErrorMessage({ response: error.response }) ?? fallback;
};
