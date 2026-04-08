import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/config/queryKeys";
import { getBranchEmployees } from "./branchApi";

export const useBranchEmployees = (id?: string, enabled = true) =>
  useQuery({
    queryKey: id ? queryKeys.branches.employees(id) : queryKeys.branches.all,
    queryFn: () => getBranchEmployees(id as string),
    enabled: Boolean(id) && enabled,
  });
