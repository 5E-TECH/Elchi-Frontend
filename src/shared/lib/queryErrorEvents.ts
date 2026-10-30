import axios from "axios";
import { getBackendErrorMessage } from "./backendError";

/**
 * GLOBAL SO'ROV XATOSI (sfNW22M7). `isError` o'qimaydigan sahifalar (25+ fayl)
 * 500/403 da mutlaqo jim qolardi. React Query'ning `QueryCache.onError` shu
 * hodisani chiqaradi, NotificationProvider esa bildirishnoma ko'rsatadi.
 *
 * Chiqarilmaydi: tarmoq xatosi (interceptor o'zi "Tarmoq xatosi" ko'rsatadi),
 * 401 (token yangilash oqimi), 403 `PASSWORD_CHANGE_REQUIRED` (aidsxJ2H —
 * «Yangi parol o'rnating» oynasi o'zi tushuntiradi, sahifadagi har so'rov uchun
 * «Ruxsat yo'q» chiqmasin) va `meta.silentError` bilan belgilangan fon
 * so'rovlari (masalan har daqiqada so'raladigan o'qilmaganlar soni).
 */
export const QUERY_ERROR_EVENT = "elchi:query-error";
/** Xatoga uchragan so'rov keyin muvaffaqiyatli bo'ldi yoki keshdan olib tashlandi (G6F68ti6, 5-band). */
export const QUERY_RECOVERED_EVENT = "elchi:query-recovered";

export type QueryErrorDetail = { status: number; message?: string; queryHash?: string };
export type QueryRecoveredDetail = { queryHash: string };

/** `QueryCache` dagi so'rovning shu modulga kerak qismi (testda soxtasi oson). */
export type QueryErrorSource = { queryHash: string; getObserversCount: () => number };

/**
 * `query` berilsa (ilova `QueryCache` i): ochiq sahifa kuzatmayotgan so'rov (`prefetchQuery`, tark etilgan
 * sahifa, imperativ `fetchQuery` — xatoni chaqiruvchi o'zi ko'rsatadi) global xabar bermaydi; xabar
 * `queryHash` bilan bog'lanadi va so'rov tiklanganda yopiladi (`emitQueryRecovered`).
 */
/** Global xabar bergan so'rovlar — `emitQueryRecovered` faqat ular uchun hodisa chiqaradi (har muvaffaqiyatda emas). */
const reportedHashes = new Set<string>();

const isPasswordChangeRequired = (data: unknown) => {
  const record = data as { code?: unknown; data?: { code?: unknown } | null } | null | undefined;
  return (record?.code ?? record?.data?.code) === "PASSWORD_CHANGE_REQUIRED";
};

export const emitQueryError = (error: unknown, meta?: Record<string, unknown>, query?: QueryErrorSource) => {
  if (typeof window === "undefined" || meta?.silentError) return;
  if (!axios.isAxiosError(error)) return;
  const status = error.response?.status;
  if (!status || status === 401) return;
  if (status === 403 && isPasswordChangeRequired(error.response?.data)) return;
  if (query && query.getObserversCount() === 0) return;
  if (query) reportedHashes.add(query.queryHash);
  window.dispatchEvent(
    new CustomEvent<QueryErrorDetail>(QUERY_ERROR_EVENT, {
      detail: { status, message: getBackendErrorMessage(error) ?? undefined, queryHash: query?.queryHash },
    }),
  );
};

/** So'rov muvaffaqiyatli bo'ldi yoki keshdan olindi — unga bog'langan «Ma'lumotni yuklab bo'lmadi» yopiladi. */
export const emitQueryRecovered = (queryHash: string) => {
  if (typeof window === "undefined" || !reportedHashes.delete(queryHash)) return;
  window.dispatchEvent(new CustomEvent<QueryRecoveredDetail>(QUERY_RECOVERED_EVENT, { detail: { queryHash } }));
};

/**
 * Umumiy hook'lar uchun ixtiyoriy bayroq: sahifa xatoni o'zi chizsa (`ErrorState` / `QueryBoundary`),
 * global xabar takrorlanmaydi. Bayroqsiz iste'molchilar uchun xulq o'zgarmaydi.
 * Ishlatilishi: `useQuery({ …, ...silentErrorMeta(options) })`.
 */
export type SilentErrorOption = { silentError?: boolean };

export const silentErrorMeta = (options?: SilentErrorOption) =>
  options?.silentError ? { meta: { silentError: true } } : {};
