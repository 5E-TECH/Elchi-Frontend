import { getErrorStatus, isRequestTimeout } from "./errorKind";

/**
 * SO'ROVNI QAYTA URINISH QOIDASI (React Query `retry`, D-08) — ilovaning `QueryClient` sukuti
 * (`app/lib/provider.tsx`).
 *
 *   - vaqt chegarasi (axios `ECONNABORTED` / `ETIMEDOUT`) — bu yerda qayta urinilmaydi: GET/HEAD ni 60 s dan keyin
 *     axios adapteri o'zi bir marta jim qayta so'raydi (`shared/api/readRetry.ts`, 2026-11-07 sekin internet) — har
 *     xato turiga BITTA qayta urinish qavati, aks holda o'qish xatosi ~4 daqiqa kutilardi; amal (POST/PATCH …) 20 s,
 *     qayta yuborilmaydi (qJjLP109). Brauzer bekor qilgan so'rov («Request aborted») — vaqt emas, 1 marta
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
