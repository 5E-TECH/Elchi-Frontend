import axios from "axios";
import { BASE_URL } from "../const";
import { setupAuthInterceptors } from "../../auth/setupInterceptors";

/**
 * VAQT CHEGARASI (qJjLP109). Ilgari yo'q edi — server osilib qolsa so'rov
 * brauzer chegarasigacha (~5 daqiqa) kutardi, foydalanuvchi cheksiz skeletonga
 * tikilardi. Vaqt tugasa axios `ECONNABORTED` beradi va interceptor
 * "Tarmoq xatosi" bildirishnomasini chiqaradi.
 */
export const API_TIMEOUT_MS = 20_000;
/** Fayl yuklash va eksport kabi uzoq so'rovlar uchun (per-request override). */
export const LONG_REQUEST_TIMEOUT_MS = 120_000;
/**
 * Tumanni birlashtirish (`POST district/:id/merge`, oNAE3LW9): gateway kutishi 120 s (uch servis bo'ylab
 * ko'chirish + qayta sanash + kompensatsiya), brauzer undan 5 s ko'proq kutadi — server javobi (200 / 409 / 503)
 * yo'lda qolmasin. Vaqt tugasa natija noma'lum («Natija noma'lum» oynasi, qayta yuborilmaydi).
 */
export const MERGE_REQUEST_TIMEOUT_MS = 125_000;

declare module "axios" {
  interface AxiosRequestConfig {
    /**
     * Fon so'rovi (G6F68ti6, 9-band): tarmoq xatosida «Internet aloqasi yo'q» xabari ochilmaydi — faqat holat
     * belgilanadi (`auth/networkError.ts`). Har daqiqada yoki fokusda o'zi so'raladigan so'rovlar uchun.
     */
    silentNetworkError?: boolean;
  }
}

export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  timeout: API_TIMEOUT_MS,
  timeoutErrorMessage: "So'rov vaqti tugadi",
  paramsSerializer: {
    // `status=paid&status=sold` ko'rinishidagi query string saqlanadi.
    indexes: null,
  },
});

setupAuthInterceptors(api);
