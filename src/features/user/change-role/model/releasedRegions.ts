import type { QueryClient } from "@tanstack/react-query";
import { getLogistRegions, logistKeys } from "../../../../entities/logist";

/**
 * Logist boshqa rolga o'tganda bo'shaydigan viloyatlar nomi (`GET /region` → `logist_id`). Tasdiq oynasidan oldin
 * so'raladi (kesh 1 daqiqadan eski bo'lsa — qayta). Yuklab bo'lmasa — `null`: oyna nomlarsiz umumiy qatorni ko'rsatadi.
 */
export const loadReleasedRegionNames = async (
  queryClient: QueryClient,
  logistId: string,
): Promise<string[] | null> => {
  try {
    const regions = await queryClient.fetchQuery({
      queryKey: logistKeys.regions,
      queryFn: getLogistRegions,
      staleTime: 60_000,
    });
    return regions.filter((region) => region.logistId === String(logistId)).map((region) => region.name);
  } catch {
    return null;
  }
};
