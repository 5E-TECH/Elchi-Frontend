import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/config/queryKeys";
import { getBranches } from "./branchApi";
import type { BranchParams } from "../model/types";

export const useBranches = (params: BranchParams) =>
  useQuery({
    queryKey: queryKeys.branches.list(params),
    queryFn: () => getBranches(params),
  });
