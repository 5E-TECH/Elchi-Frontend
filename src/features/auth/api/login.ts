import { useMutation, useQueryClient } from "@tanstack/react-query";
import authService from "../../../auth/authService";
import { mergeSettings, SETTINGS_KEY } from "../../../entities/settings";

/**
 * `useGetMyProfile` kaliti (`entities/user/api/userApi.ts` → `[user, "profile"]`). Modul import qilinmaydi — u katta va
 * `/login` chunkiga tushardi (rzzxMItN, check:bundle).
 */
const MY_PROFILE_KEY = ["user", "profile"] as const;

export const login = "login";

export const useLogin = () => {
  const queryClient = useQueryClient();
  const signinUser = useMutation({
    mutationFn: authService.login,
    // Kirishda olingan profil keshga yoziladi (h0AM0kDL): `SettingsSync` (`useSettings`) va «Profil» (`useGetMyProfile`)
    // `auth/my-profile` ni darhol qayta so'ramaydi. Profil kelmagan bo'lsa (fonda yuklanadi) — kesh tegilmaydi.
    onSuccess: ({ user }) => {
      if (!user) return;
      queryClient.setQueryData(SETTINGS_KEY, mergeSettings(user.settings));
      queryClient.setQueryData(MY_PROFILE_KEY, { statusCode: 200, message: "ok", data: user });
    },
  });

  return {
    signinUser,
  };
};
