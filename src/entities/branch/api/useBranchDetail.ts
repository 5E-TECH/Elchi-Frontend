import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/config/queryKeys";
import { getBranchById } from "./branchApi";

/** `silentError` — sahifa xatoni o'zi ko'rsatadi (404 «Filial topilmadi» / `ErrorState`), global xabar takrorlanmaydi. */
export const useBranchDetail = (id?: string, options?: { silentError?: boolean }) =>
  useQuery({
    queryKey: id ? queryKeys.branches.detail(id) : queryKeys.branches.all,
    queryFn: () => getBranchById(id as string),
    enabled: Boolean(id),
    ...(options?.silentError ? { meta: { silentError: true } } : {}),
  });
