import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/config/queryKeys";
import { getBranchSettings } from "./branchApi";

export const useBranchSettings = (id?: string, enabled = true) =>
  useQuery({
    queryKey: id ? queryKeys.branches.settings(id) : queryKeys.branches.all,
    queryFn: () => getBranchSettings(id as string),
    enabled: Boolean(id) && enabled,
  });
