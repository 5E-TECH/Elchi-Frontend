import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/config/queryKeys";
import { getHqBranch } from "./branchApi";

/**
 * HQ filiali (`GET branches/hq`; SUPERADMIN, ADMIN) — `{ id, name }` yoki `null` (HQ yo'q, aniqlanmadi yoki so'rov
 * yiqildi). Carrier API konsoli va katalogi: kuryer filiali HQ bo'lsa naqdni superadmin / admin asosiy kassaga oladi.
 * Xato xabarsiz (`silentError`): chaqiruvchi zaxira matnni ko'rsatadi («Toshkent HQ») va tavsiyani chizmaydi.
 */
export const useHqBranch = (enabled: boolean): { id: string; name: string } | null => {
  const query = useQuery({
    queryKey: queryKeys.branches.hq,
    queryFn: getHqBranch,
    enabled,
    staleTime: 5 * 60_000,
    retry: false,
    meta: { silentError: true },
  });
  return query.data?.id ? { id: String(query.data.id), name: String(query.data.name ?? "") } : null;
};
