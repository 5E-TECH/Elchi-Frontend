import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { user as userQueryRoot } from "../../../entities/user/api/userApi";
import { requestGroupLinkCode, requestTelegramLinkCode, unlinkTelegram } from "./telegramLinkApi";

/** `useUser().useGetMyProfile()` kaliti (`GET auth/my-profile`) — `telegram_linked` shu yerda. */
export const MY_PROFILE_QUERY_KEY = [userQueryRoot, "profile"] as const;

/** Bir martalik ulash kodi (har bosishda yangisi). */
export const useTelegramLinkCode = () =>
  useMutation({
    mutationFn: requestTelegramLinkCode,
  });

/**
 * Market guruhini ulash uchun bir martalik havola (`POST /telegram/link-code`, `purpose: "market_group"`).
 * Har chaqiruvda yangi kod (oynada faqat oxirgisi ko'rsatiladi).
 */
export const useRequestGroupLink = () =>
  useMutation({
    mutationFn: requestGroupLinkCode,
  });

/** Uzish — muvaffaqiyatdan keyin profil qayta o'qiladi (karta «Ulanmagan» ga o'tadi). */
export const useUnlinkTelegram = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: unlinkTelegram,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MY_PROFILE_QUERY_KEY }),
  });
};

/** Profilni hozir qayta o'qish (oyna ochiq turganda — bot ulaganini kutish). */
export const useRefetchMyProfile = () => {
  const queryClient = useQueryClient();

  return useCallback(
    () =>
      queryClient.refetchQueries({ queryKey: MY_PROFILE_QUERY_KEY, exact: true, type: "active" }),
    [queryClient],
  );
};
