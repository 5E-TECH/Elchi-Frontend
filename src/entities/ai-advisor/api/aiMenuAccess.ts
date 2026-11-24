import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/config/queryKeys";
import { getAiAccessMe } from "./aiAssistantApi";

/**
 * F7PWp6cK (ega 2026-11-23): adminning menyusidagi «AI yordamchi» bandi — superadmin ruxsat bergan bo'lsa
 * (`GET ai/assistant/access/me` → `allowed`). Sahifadagi `useAiAccessMe` bilan bitta kesh (kalit va so'rov bir xil).
 * Yengil modul (barrel emas): yon menyu (asosiy chunk) maslahatchi kodini olib kelmasin; testlar uni alohida
 * almashtira oladi (`useHasOwnWarehouse` kabi).
 *
 * `true` — ruxsat bor, `false` — yo'q (yoki so'rov yiqildi: band ko'rsatilmaydi), `undefined` — hali noma'lum / o'chiq.
 */
export const useAiAssistantMenuAllowed = (enabled: boolean): boolean | undefined => {
  const query = useQuery({
    queryKey: queryKeys.aiAssistant.accessMe,
    queryFn: getAiAccessMe,
    enabled,
    staleTime: 30_000,
    retry: false,
    meta: { silentError: true },
  });
  if (!enabled) return undefined;
  if (query.isError) return false;
  return query.data?.allowed;
};
