import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/config/queryKeys";
import { getBranchById } from "./branchApi";

export const useBranchDetail = (id?: string) =>
  useQuery({
    queryKey: id ? queryKeys.branches.detail(id) : queryKeys.branches.all,
    queryFn: () => getBranchById(id as string),
    enabled: Boolean(id),
  });
