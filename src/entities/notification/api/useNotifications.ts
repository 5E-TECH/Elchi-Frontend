import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/config/queryKeys";
import { getNotificationById, getNotifications } from "./notificationApi";
import type { NotificationParams } from "../model/types";
import { silentErrorMeta, type SilentErrorOption } from "../../../shared/lib/queryErrorEvents";

export const useNotifications = (params: NotificationParams, options?: SilentErrorOption) =>
  useQuery({
    queryKey: queryKeys.notifications.list(params),
    queryFn: () => getNotifications(params),
    ...silentErrorMeta(options),
  });

export const useNotificationDetail = (id?: string) =>
  useQuery({
    queryKey: id ? queryKeys.notifications.detail(id) : queryKeys.notifications.all,
    queryFn: () => getNotificationById(id as string),
    enabled: Boolean(id),
  });
