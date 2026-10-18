import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/config/queryKeys";
import { getBranchesWithSentBatches } from "./branchApi";
import type { SentBatchBranchParams } from "../model/types";

/** `options.enabled` — ixtiyoriy (sukut `true`): «Qabul va yaratish» tabidagi son faqat tab ko'rinsa so'raladi. */
export const useBranchesWithSentBatches = (
  params: SentBatchBranchParams = { side: "source", direction: "FORWARD" },
  options?: { enabled?: boolean },
) =>
  useQuery({
    queryKey: queryKeys.branches.withSentBatches(params),
    queryFn: () => getBranchesWithSentBatches(params),
    enabled: options?.enabled ?? true,
  });
