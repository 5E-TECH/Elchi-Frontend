import { api } from "../../../shared/api/instance";
import { API_ENDPOINTS } from "../../../shared/api";
import type { PaginatedResponse } from "../../../shared/types/pagination";
import type { Notification, NotificationParams } from "../model/types";

const normalizeNotification = (value: unknown): Notification => {
  const item = value as Notification;

  return {
    id: String(item.id),
    user: {
      id: String(item.user?.id ?? ""),
      fullName: item.user?.fullName ?? item.user?.username ?? "Noma'lum",
      username: item.user?.username ?? "—",
    },
    chat_id: String(item.chat_id ?? ""),
    status: item.status === "inactive" ? "inactive" : "active",
    created_at: item.created_at ?? new Date().toISOString(),
  };
};

const normalizeNotificationList = (value: unknown, params?: NotificationParams): PaginatedResponse<Notification> => {
  const response = value as Record<string, unknown>;
  const responseData = response.data as unknown;
  const responseDataRecord =
    typeof responseData === "object" && responseData !== null
      ? (responseData as Record<string, unknown>)
      : null;

  const list = Array.isArray(responseData)
    ? (responseData as Notification[])
    : Array.isArray(responseDataRecord?.items)
      ? (responseDataRecord.items as Notification[])
      : Array.isArray(response.items)
        ? (response.items as Notification[])
        : [];

  return {
    data: list.map(normalizeNotification),
    total: Number(
      response.total ??
        responseDataRecord?.total ??
        list.length,
    ),
    page: Number(response.page ?? responseDataRecord?.page ?? params?.page ?? 1),
    limit: Number(response.limit ?? responseDataRecord?.limit ?? params?.limit ?? 10),
  };
};

export const getNotifications = async (params: NotificationParams): Promise<PaginatedResponse<Notification>> => {
  const response = await api.get(API_ENDPOINTS.NOTIFICATIONS.BASE, { params });
  return normalizeNotificationList(response.data, params);
};

export const getNotificationById = async (id: string): Promise<Notification> => {
  const response = await api.get(API_ENDPOINTS.NOTIFICATIONS.BY_ID(id));
  return normalizeNotification((response.data as { data?: Notification }).data ?? response.data);
};
