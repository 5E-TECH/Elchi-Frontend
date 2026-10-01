import axios, { type AxiosError } from "axios";

/** Javob umuman kelmagan (tarmoq uzilgan, vaqt tugagan) — server "yo'q" demagan. */
export const isNetworkError = (error: AxiosError) =>
  error.code !== "ERR_CANCELED" &&
  (!error.response || error.code === "ERR_NETWORK" || error.code === "ECONNABORTED");

export const isNetworkFailure = (error: unknown): error is AxiosError =>
  axios.isAxiosError(error) && isNetworkError(error);

/**
 * Token yangilash (refresh) ning VAQTINCHALIK xatosi — foydalanuvchi tizimdan
 * CHIQARILMAYDI (fix3 RBAC-11 / C10):
 *   - 429 — so'rov cheklovi: ofisda (HQ Wi-Fi) yoki mobil operator NAT'ida
 *     bitta IP dan smena boshida ko'p qurilma bir vaqtda yangilaydi;
 *   - 5xx — server muammosi, foydalanuvchining aybi emas;
 *   - javob umuman kelmadi (tarmoq uzildi / vaqt tugadi).
 * 401/403 (refresh token yaroqsiz, qayta ishlatilgan, muddati o'tgan) va
 * boshqa xatolar — sessiya haqiqatan tugagan, chiqish to'g'ri.
 */
export const isTransientAuthFailure = (error: unknown): boolean => {
  if (!axios.isAxiosError(error)) return false;
  if (isNetworkError(error)) return true;
  const status = error.response?.status ?? 0;
  return status === 429 || status >= 500;
};

/** NotificationProvider "Tarmoq xatosi" bildirishnomasini ko'rsatadi. */
export const emitNetworkError = (error: AxiosError) => {
  if (typeof window === "undefined" || !isNetworkError(error)) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent("elchi:network-error", {
      detail: {
        message: error.message,
        url: error.config?.url,
      },
    }),
  );
};
