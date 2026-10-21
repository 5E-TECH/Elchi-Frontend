import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BulkAssignRegionLogistRequest, LogistRegion } from "../model/types";
import { bulkAssignRegionLogist, getLogistRegions, getLogists } from "./logistApi";

/** So'rov kalitlari — shu entity ichida (`shared/config/queryKeys.ts` boshqa PR'lar egaligida). */
export const logistKeys = {
  all: ["logists"] as const,
  regions: ["region-logists"] as const,
};

/**
 * Logist biriktirilishi o'zgarganda eskiradigan boshqa keshlar: viloyatlar ro'yxati (`useGetRegions`) va hudud
 * statistikasi (`region-stats` — `logist_id` shu yerda ham keladi, logist bosh sahifasi undan o'qiydi).
 */
const DEPENDENT_KEYS = [["regions"], ["region-stats"]] as const;

/**
 * `GET /logists` — logistlar (superadmin, admin). Xatoni sahifa o'zi chizadi (`ErrorState`), global xabar
 * chiqmaydi (`silentError`).
 */
export const useLogists = (options: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: logistKeys.all,
    queryFn: getLogists,
    enabled: options.enabled ?? true,
    meta: { silentError: true },
  });

/** `GET /region` — viloyatlar va ularning logisti (`logist_id`). */
export const useLogistRegions = (options: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: logistKeys.regions,
    queryFn: getLogistRegions,
    enabled: options.enabled ?? true,
    meta: { silentError: true },
  });

/** Logistlar ro'yxati va viloyatlarni qayta so'rash (saqlashdan keyin yoki server rad etganda). */
export const useRefreshLogistAssignments = () => {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      [logistKeys.all, logistKeys.regions, ...DEPENDENT_KEYS].map((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      ),
    );
};

/**
 * Saqlangan to'plamni keshga yozish (backend semantikasi: `region_ids` — shu logistniki, uning qolgan viloyatlari
 * logistsiz). Qayta so'rov tarmoq xatosi bilan tugasa ham sahifa «Saqlandi» dan keyin eski holatni ko'rsatmaydi.
 */
export const applyBulkAssignment = (
  regions: readonly LogistRegion[],
  { logist_id, region_ids }: BulkAssignRegionLogistRequest,
): LogistRegion[] => {
  const ids = new Set(region_ids);
  return regions.map((region) =>
    ids.has(region.id)
      ? { ...region, logistId: logist_id }
      : region.logistId === logist_id
        ? { ...region, logistId: null }
        : region,
  );
};

/** `POST /region/logist/bulk`. Xabar va xato matnini sahifa beradi (server matni ko'rsatilmaydi). */
export const useBulkAssignRegionLogist = () => {
  const queryClient = useQueryClient();
  const refresh = useRefreshLogistAssignments();
  return useMutation({
    mutationFn: bulkAssignRegionLogist,
    onSuccess: (_data, variables) => {
      queryClient.setQueryData<LogistRegion[]>(logistKeys.regions, (regions) =>
        regions ? applyBulkAssignment(regions, variables) : regions,
      );
      return refresh();
    },
  });
};
