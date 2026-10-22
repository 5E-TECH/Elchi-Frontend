import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/config/queryKeys";
import { getMySessions } from "./accountSessionApi";

/**
 * `GET /auth/sessions` — o'z faol sessiyalari (profil «Sessiyalar» kartasi). Bo'lim ochilganda va ilovaga
 * qaytilganda (oyna fokusi) qayta so'raladi; davriy so'rov yo'q. Xatoni karta o'zi chizadi
 * (`QueryBoundary` → `ErrorState`), umumiy xabar chiqmaydi (`silentError`).
 */
export const useMySessions = (options: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: queryKeys.accountSessions.mine,
    queryFn: getMySessions,
    enabled: options.enabled ?? true,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    meta: { silentError: true },
  });
