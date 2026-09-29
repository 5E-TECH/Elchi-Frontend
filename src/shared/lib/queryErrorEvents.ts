import axios from "axios";
import { getBackendErrorMessage } from "./backendError";

/**
 * GLOBAL SO'ROV XATOSI (sfNW22M7). `isError` o'qimaydigan sahifalar (25+ fayl)
 * 500/403 da mutlaqo jim qolardi. React Query'ning `QueryCache.onError` shu
 * hodisani chiqaradi, NotificationProvider esa bildirishnoma ko'rsatadi.
 *
 * Chiqarilmaydi: tarmoq xatosi (interceptor o'zi "Tarmoq xatosi" ko'rsatadi),
 * 401 (token yangilash oqimi) va `meta.silentError` bilan belgilangan fon
 * so'rovlari (masalan har daqiqada so'raladigan o'qilmaganlar soni).
 */
export const QUERY_ERROR_EVENT = "elchi:query-error";

export type QueryErrorDetail = { status: number; message?: string };

export const emitQueryError = (error: unknown, meta?: Record<string, unknown>) => {
  if (typeof window === "undefined" || meta?.silentError) return;
  if (!axios.isAxiosError(error)) return;
  const status = error.response?.status;
  if (!status || status === 401) return;
  window.dispatchEvent(
    new CustomEvent<QueryErrorDetail>(QUERY_ERROR_EVENT, {
      detail: { status, message: getBackendErrorMessage(error) ?? undefined },
    }),
  );
};
