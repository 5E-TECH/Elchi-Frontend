import { useMutation, useQueryClient } from "@tanstack/react-query";
import { changeUserRole } from "../../../../entities/user/api/roleApi";
import type { ChangeableUserRole } from "../../../../entities/user/types/user";
import { useRefreshLogistAssignments } from "../../../../entities/logist";
import { queryKeys } from "../../../../shared/config/queryKeys";
import { classifyRoleChangeError } from "./roleChangeError";

/** `useUser()` so'rovlarining ildiz kaliti (`entities/user/api/userApi.ts` → `user`): ro'yxat, tafsilot, profil. */
const USER_QUERY_ROOT = "user";

export type ChangeUserRoleVariables = {
  id: string;
  role: ChangeableUserRole;
  /** Eski rol: logistdan chiqilsa viloyatlari bo'shaydi — «Logist biriktirish» keshlari ham yangilanadi. */
  from: string;
};

/**
 * `PATCH /users/:id/role` (SZTZ4HEU): muvaffaqiyatda `[user]` (ro'yxat, tafsilot) va `queryKeys.users` eskiradi;
 * logist boshqa rolga o'tsa — logistlar, viloyatlar va hudud statistikasi ham. Natija noma'lum bo'lgan xatoda
 * (5xx, vaqt, tarmoq) ham foydalanuvchi keshlari yangilanadi — rol aslida o'zgargan bo'lishi mumkin.
 */
export const useChangeUserRole = () => {
  const queryClient = useQueryClient();
  const refreshLogists = useRefreshLogistAssignments();

  const invalidateUsers = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: [USER_QUERY_ROOT], refetchType: "active" }),
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all }),
    ]);

  return useMutation({
    mutationFn: ({ id, role }: ChangeUserRoleVariables) => changeUserRole(id, role),
    onSuccess: async (_data, { from }) => {
      await Promise.all([invalidateUsers(), from === "logist" ? refreshLogists() : undefined]);
    },
    onError: (error: unknown) => {
      if (classifyRoleChangeError(error) === "retry") void invalidateUsers();
    },
  });
};
