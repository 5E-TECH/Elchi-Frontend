import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/config/queryKeys";
import { getDispatchDestinations } from "./branchApi";

const EMPTY = new Map<string, string>();

/**
 * Filial id → nomi — `GET /branches/dispatch-destinations` (faol REGIONAL/HYBRID; superadmin, admin va HQ
 * registratori, qolganlar 403). «Qaytarish»dagi filial o'tkazmasi guruhlari (backend faqat `branch_id` beradi)
 * filial nomi bilan ko'rsatilishi uchun. `enabled` — chaqiruvchi: shunday guruh bor va rol ruxsatli bo'lsa.
 * Xatoda (403, tarmoq) — bo'sh xarita, xabarsiz: chaqiruvchi zaxira matnni ko'rsatadi.
 */
export const useDispatchBranchNames = (enabled: boolean): Map<string, string> => {
  const query = useQuery({
    queryKey: queryKeys.branches.dispatchNames,
    queryFn: () => getDispatchDestinations(),
    enabled,
    staleTime: 5 * 60_000,
    retry: false,
    meta: { silentError: true },
  });
  const branches = query.data?.data;
  return useMemo(
    () =>
      branches
        ? new Map(branches.map((branch) => [String(branch.id), String(branch.name ?? "").trim()] as const))
        : EMPTY,
    [branches],
  );
};
