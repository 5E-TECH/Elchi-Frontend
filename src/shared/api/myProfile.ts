import { queryOptions } from "@tanstack/react-query";
import { queryKeys } from "../config/queryKeys";
import { api } from "./api";
import { API_ENDPOINTS } from "./endpoints";

/**
 * JORIY FOYDALANUVCHI PROFILI — yagona kesh (z87E6tdQ).
 *
 * `GET auth/my-profile` ni uch joy alohida so'rardi: auth bootstrap (Redux), `useSettings` (['app-settings']) va
 * `useGetMyProfile` — har sahifa yuklanishida 2–3 marta, nusxalar bir-biridan farq qilishi mumkin edi. Endi
 * uchalasi shu kalit orqali o'qiydi: bir vaqtda ketgan so'rovlar bitta bo'ladi, yangi javob qayta so'ralmaydi
 * (bootstrap — `authService.fetchMyProfile`, `AuthBootstrap` bog'laydi).
 */
export const myProfileQuery = queryOptions({
  queryKey: queryKeys.myProfile,
  queryFn: () => api.get(API_ENDPOINTS.AUTH.MY_PROFILE).then((res) => res.data),
  staleTime: 60_000,
});
