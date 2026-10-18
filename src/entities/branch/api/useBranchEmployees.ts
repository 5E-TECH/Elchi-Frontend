import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/config/queryKeys";
import { getBranchEmployees } from "./branchApi";

/** `silentError` — sahifa xatoni o'zi ko'rsatadi (`ErrorState`), global xabar takrorlanmaydi. */
export const useBranchEmployees = (id?: string, enabled = true, options?: { silentError?: boolean }) =>
  useQuery({
    queryKey: id ? queryKeys.branches.employees(id) : queryKeys.branches.all,
    queryFn: () => getBranchEmployees(id as string),
    enabled: Boolean(id) && enabled,
    ...(options?.silentError ? { meta: { silentError: true } } : {}),
  });
