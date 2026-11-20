import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/config/queryKeys";
import {
  getBranchTelegram,
  requestBranchGroupLinkCode,
  setBranchReportTarget,
  unlinkBranchGroup,
} from "./branchTelegramApi";

type StatusOptions = {
  enabled?: boolean;
  /** Havola oynasi ochiq — bot guruhni ulaganini kutish (ms). */
  refetchInterval?: number | false;
};

/** Filial kassasi Telegram guruhi holati (`GET branches/:id/telegram`). */
export const useBranchTelegram = (branchId: string, { enabled = true, refetchInterval = false }: StatusOptions = {}) =>
  useQuery({
    queryKey: queryKeys.branches.telegram(branchId),
    queryFn: () => getBranchTelegram(branchId),
    enabled: enabled && Boolean(branchId),
    refetchInterval,
    refetchIntervalInBackground: Boolean(refetchInterval),
    meta: { silentError: true },
  });

/** Bir martalik guruh havolasi (har bosishda yangisi). */
export const useBranchGroupLinkCode = () =>
  useMutation({
    mutationFn: requestBranchGroupLinkCode,
  });

/** Hisobot manzili — javobdagi holat keshga yoziladi. */
export const useSetBranchReportTarget = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setBranchReportTarget,
    onSuccess: (status, { branchId }) => {
      queryClient.setQueryData(queryKeys.branches.telegram(branchId), (previous: typeof status | undefined) =>
        // `can_manage` faqat GET da keladi — eskisi saqlanadi.
        previous ? { ...status, canManage: previous.canManage } : status,
      );
    },
  });
};

/** Guruhni uzish — holat qayta o'qiladi. */
export const useUnlinkBranchGroup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: unlinkBranchGroup,
    onSuccess: (_data, branchId) =>
      queryClient.invalidateQueries({ queryKey: queryKeys.branches.telegram(branchId) }),
  });
};
