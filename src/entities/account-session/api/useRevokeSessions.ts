import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/config/queryKeys";
import type { AccountSessionList, RevokeSessionsResult } from "../model/types";
import { revokeOtherSessions, revokeSession } from "./accountSessionApi";

/**
 * Yopilgan sessiyalar «Sessiyalar» keshidan darhol olinadi (qator ro'yxat qayta kelguncha osilib turmaydi), so'ng
 * ro'yxat qayta so'raladi — xatoda ham (404: boshqa qurilmadan allaqachon yopilgan bo'lishi mumkin).
 */
const dropFromCache = (queryClient: QueryClient, ids: readonly string[]) => {
  if (ids.length === 0) return;
  const gone = new Set(ids);
  queryClient.setQueryData<AccountSessionList>(queryKeys.accountSessions.mine, (list) => {
    if (!list) return list;
    const sessions = list.sessions.filter((session) => !gone.has(session.id));
    const removed = list.sessions.length - sessions.length;
    return { active_count: Math.max(sessions.length, list.active_count - removed), sessions };
  });
};

const useSessionMutationCallbacks = () => {
  const queryClient = useQueryClient();
  return {
    onSuccess: (result: RevokeSessionsResult) => dropFromCache(queryClient, result.session_ids),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.accountSessions.all }),
  };
};

/** `DELETE /auth/sessions/:id` — profil «Sessiyalar» kartasidagi «Chiqarish». */
export const useRevokeSession = () => {
  const callbacks = useSessionMutationCallbacks();
  return useMutation({ mutationFn: (id: string) => revokeSession(id), ...callbacks });
};

/** `POST /auth/sessions/revoke-others` — «Boshqa barcha qurilmalardan chiqish». */
export const useRevokeOtherSessions = () => {
  const callbacks = useSessionMutationCallbacks();
  return useMutation({ mutationFn: () => revokeOtherSessions(), ...callbacks });
};
