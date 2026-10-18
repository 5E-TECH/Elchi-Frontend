import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/config/queryKeys";
import { getNotificationById, getNotifications } from "./notificationApi";
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
