import { getErrorStatus, isRequestTimeout } from "./errorKind";

/**
 * SO'ROVNI QAYTA URINISH QOIDASI (React Query `retry`, D-08) — ilovaning `QueryClient` sukuti
 * (`app/lib/provider.tsx`).
 *
 *   - vaqt chegarasi (20 s, axios `ECONNABORTED` / `ETIMEDOUT`) — qayta urinilmaydi: aks holda foydalanuvchi xato
 *     holatini 40 s kutardi (qJjLP109). Brauzer bekor qilgan so'rov («Request aborted») — vaqt emas, 1 marta
 *     (G6F68ti6, 12-band);
 *   - 4xx — qayta urinilmaydi: javob qayta so'rashdan o'zgarmaydi (400 noto'g'ri parametr, 403 ruxsat yo'q,
 *     404 topilmadi …), har biri ikki marta so'ralardi. Istisno — 408 (so'rov vaqti) va 429 (so'rov cheklovi):
 *     ular vaqtinchalik;
 *   - qolgani (tarmoq xatosi, 5xx, holatsiz xato) — avvalgidek 1 marta.
 */
export const QUERY_RETRY_LIMIT = 1;

const TRANSIENT_CLIENT_STATUSES: ReadonlySet<number> = new Set([408, 429]);

export const shouldRetryQuery = (failureCount: number, error: unknown): boolean => {
  if (failureCount >= QUERY_RETRY_LIMIT) return false;
  if (isRequestTimeout(error)) return false;
  const status = getErrorStatus(error);
  if (status !== undefined && status >= 400 && status < 500 && !TRANSIENT_CLIENT_STATUSES.has(status)) return false;
  return true;
};
