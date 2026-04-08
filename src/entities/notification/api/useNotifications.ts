import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/config/queryKeys";
import { getNotificationById, getNotifications } from "./notificationApi";
import type { NotificationParams } from "../model/types";

export const useNotifications = (params: NotificationParams) =>
  useQuery({
    queryKey: queryKeys.notifications.list(params),
    queryFn: () => getNotifications(params),
  });

export const useNotificationDetail = (id?: string) =>
  useQuery({
    queryKey: id ? queryKeys.notifications.detail(id) : queryKeys.notifications.all,
    queryFn: () => getNotificationById(id as string),
    enabled: Boolean(id),
  });
