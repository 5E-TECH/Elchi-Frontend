import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/config/queryKeys";
import { getBranches } from "./branchApi";
import type { BranchParams } from "../model/types";

/** `silentError` — sahifa xatoni o'zi ko'rsatadi (`ErrorState`), global xabar takrorlanmaydi. */
export const useBranches = (params: BranchParams, enabled: boolean = true, options?: { silentError?: boolean }) =>
  useQuery({
    queryKey: queryKeys.branches.list(params),
    queryFn: () => getBranches(params),
    enabled,
    ...(options?.silentError ? { meta: { silentError: true } } : {}),
  });
