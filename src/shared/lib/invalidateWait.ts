import type { QueryClient } from "@tanstack/react-query";

/**
 * Yozuvdan keyingi yangilashni kutish chegarasi (sekin internet, 2026-11-07).
 *
 * Ko'p amallar (buyurtma yaratish, kassa to'lovi, smena …) `onSuccess` da `invalidateQueries` ni KUTADI — React Query
 * mutatsiyani shu kutish tugaguncha `isPending` da ushlaydi: tugma aylanadi, «Saqlandi» xabari chiqmaydi. O'qish
 * so'rovlari endi 60 s + 1 jim qayta urinish (`shared/api/readRetry.ts`) — qotgan liniyada bu kutish ~2 daqiqaga
 * cho'zilardi (oldin 20 s), server esa yozuvni allaqachon saqlagan.
 *
 * Chegara — oldingi eng uzun holat (`API_TIMEOUT_MS`, 20 s): undan keyin `invalidateQueries` qaytadi, ma'lumot fonda
 * kelishda davom etadi (so'rovning o'z `isFetching` holati ko'rsatadi). Oddiy internetda yangilash bundan ancha tez
 * tugaydi — natija o'zgarmaydi (yangi ma'lumot bilan qaytadi).
 */
export const INVALIDATE_WAIT_MS = 20_000;

export const capInvalidateWait = (client: QueryClient, waitMs = INVALIDATE_WAIT_MS) => {
  const invalidate = client.invalidateQueries.bind(client);
  client.invalidateQueries = ((...args: Parameters<QueryClient["invalidateQueries"]>) => {
    const refresh = invalidate(...args);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cap = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, waitMs);
    });
    return Promise.race([refresh, cap]).finally(() => clearTimeout(timer));
  }) as QueryClient["invalidateQueries"];
  return client;
};

/**
 * So'rov natijasi HOZIRGI holatmi: javob kelgan va amaldan keyingi qayta o'qish kutilmayapti. `invalidateQueries`
 * so'rovni eskirgan (`isStale`) qiladi va qayta o'qiydi — chegara (20 s) tugab, javob hali kelmagan bo'lsa `isSuccess`
 * baribir `true` (eski ma'lumot). Shu eski qiymat asosida hisob qilinmasligi kerak joylar (smena oynasidagi kutilgan
 * qoldiq va farq) — shu bilan tekshiradi; yangi javob kelishi bilan `true` ga qaytadi.
 */
export const isSettledQuery = (query: {
  isSuccess: boolean;
  isFetching: boolean;
  isStale: boolean;
}) => query.isSuccess && !(query.isFetching && query.isStale);
