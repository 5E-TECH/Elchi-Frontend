import { api } from "../../../shared/api/instance";
import { API_ENDPOINTS } from "../../../shared/api";
import type { PaginatedResponse } from "../../../shared/types/pagination";
import type { Notification, NotificationParams } from "../model/types";

const normalizeNotification = (value: unknown): Notification => {
  const item = value as Notification & {
    user_id?: string | number;
    user?: {
      id?: string | number;
      fullName?: string;
      full_name?: string;
      name?: string;
      username?: string;
      phone_number?: string;
    } | null;
    createdAt?: string;
    updatedAt?: string;
  };
  const user = item.user ?? null;
  const username = user?.username ?? user?.phone_number ?? "—";

  return {
    id: String(item.id),
    user: {
      id: String(user?.id ?? item.user_id ?? ""),
      fullName: user?.fullName ?? user?.full_name ?? user?.name ?? username,
      username,
    },
    chat_id: String(item.chat_id ?? ""),
    status: item.status === "inactive" ? "inactive" : "active",
    created_at: item.created_at ?? item.createdAt ?? item.updatedAt ?? new Date().toISOString(),
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
  const meta = (
    responseDataRecord?.meta ??
    responseDataRecord?.pagination ??
    response.meta ??
    response.pagination ??
    {}
  ) as Record<string, unknown>;

  return {
    data: list.map(normalizeNotification),
    total: Number(
      response.total ??
        meta.total ??
        responseDataRecord?.total ??
        list.length,
    ),
    page: Number(response.page ?? meta.page ?? responseDataRecord?.page ?? params?.page ?? 1),
    limit: Number(response.limit ?? meta.limit ?? responseDataRecord?.limit ?? params?.limit ?? 10),
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
