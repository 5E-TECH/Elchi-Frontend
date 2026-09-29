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
