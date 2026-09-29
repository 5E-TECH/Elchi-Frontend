import axios, { type AxiosError } from "axios";

/** Javob umuman kelmagan (tarmoq uzilgan, vaqt tugagan) — server "yo'q" demagan. */
export const isNetworkError = (error: AxiosError) =>
  error.code !== "ERR_CANCELED" &&
  (!error.response || error.code === "ERR_NETWORK" || error.code === "ECONNABORTED");

export const isNetworkFailure = (error: unknown): error is AxiosError =>
  axios.isAxiosError(error) && isNetworkError(error);

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
