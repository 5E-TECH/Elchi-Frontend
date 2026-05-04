import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/config/queryKeys";
import { getBranchesWithSentBatches } from "./branchApi";
import type { SentBatchBranchParams } from "../model/types";

export const useBranchesWithSentBatches = (
  params: SentBatchBranchParams = { side: "source", direction: "FORWARD" },
) =>
  useQuery({
    queryKey: queryKeys.branches.withSentBatches(params),
    queryFn: () => getBranchesWithSentBatches(params),
  });
