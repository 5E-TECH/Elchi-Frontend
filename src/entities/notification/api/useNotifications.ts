import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/config/queryKeys";
import { getMyTelegramGroups, getNotificationById, getNotifications } from "./notificationApi";
import type { NotificationParams } from "../model/types";
import { silentErrorMeta, type SilentErrorOption } from "../../../shared/lib/queryErrorEvents";

export type UseNotificationsOptions = SilentErrorOption & {
  enabled?: boolean;
  /** Qayta so'rash oralig'i, ms (guruh ulanishini kutish). */
  refetchInterval?: number | false;
  /** Oyna fonda bo'lsa ham qayta so'rash (foydalanuvchi Telegram'ga o'tgan payt). */
  refetchIntervalInBackground?: boolean;
};

/**
 * `GET /notifications` (market guruhlari). `silentError` — sahifa xatoni o'zi (`ErrorState`) ko'rsatsa umumiy
 * toast chiqmasin; `refetchInterval` — bir martalik havola bilan ulanishni kutish (yaratish oynasi).
 */
export const useNotifications = (params: NotificationParams, options: UseNotificationsOptions = {}) =>
  useQuery({
    queryKey: queryKeys.notifications.list(params),
    queryFn: () => getNotifications(params),
    enabled: options.enabled ?? true,
    refetchInterval: options.refetchInterval ?? false,
    refetchIntervalInBackground: options.refetchIntervalInBackground ?? false,
    ...silentErrorMeta(options),
  });

export const useNotificationDetail = (id?: string) =>
  useQuery({
    queryKey: id ? queryKeys.notifications.detail(id) : queryKeys.notifications.all,
    queryFn: () => getNotificationById(id as string),
    enabled: Boolean(id),
  });

/**
 * Market o'z guruhlari holati (`GET /notifications/me/telegram-groups`, TG-C): market `/profile` «Telegram guruhi»
 * kartasi va o'z «Ulash» oynasining kuzatuvi (oyna ochiq paytda `refetchInterval`). Kalit `notifications.all`
 * ostida — ulash/faollashtirishdan keyingi `invalidateQueries(notifications.all)` buni ham yangilaydi.
 */
export const useMyTelegramGroups = (options: UseNotificationsOptions = {}) =>
  useQuery({
    queryKey: queryKeys.notifications.myTelegramGroups,
    queryFn: getMyTelegramGroups,
    enabled: options.enabled ?? true,
    refetchInterval: options.refetchInterval ?? false,
    refetchIntervalInBackground: options.refetchIntervalInBackground ?? false,
    ...silentErrorMeta(options),
  });
