import { api } from "../../../shared/api/instance";
import { API_ENDPOINTS } from "../../../shared/api";
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_PRIORITIES,
  type InboxListParams,
  type InboxListResult,
  type InboxNotification,
  type NotificationCategory,
  type NotificationPriority,
} from "../model/types";

// The gateway wraps every response as `{ statusCode, message, data }`. We unwrap
// defensively so the hooks are resilient to an occasional un-enveloped payload.
const unwrap = (payload: unknown): unknown => {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data: unknown }).data;
  }
  return payload;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const toCategory = (value: unknown): NotificationCategory =>
  NOTIFICATION_CATEGORIES.includes(value as NotificationCategory)
    ? (value as NotificationCategory)
    : "system";

const toPriority = (value: unknown): NotificationPriority =>
  NOTIFICATION_PRIORITIES.includes(value as NotificationPriority)
    ? (value as NotificationPriority)
    : "normal";

const normalizeNotification = (value: unknown): InboxNotification => {
  const row = asRecord(value);
  return {
    id: String(row.id ?? ""),
    type: String(row.type ?? ""),
    category: toCategory(row.category),
    priority: toPriority(row.priority),
    title: String(row.title ?? ""),
    body: row.body != null ? String(row.body) : null,
    data: row.data && typeof row.data === "object" ? (row.data as Record<string, unknown>) : null,
    link: row.link != null ? String(row.link) : null,
    is_read: Boolean(row.is_read),
    read_at: row.read_at != null ? String(row.read_at) : null,
    created_at: String(row.created_at ?? row.createdAt ?? ""),
  };
};

const normalizeList = (payload: unknown, params?: InboxListParams): InboxListResult => {
  const data = asRecord(unwrap(payload));
  const items = Array.isArray(data.items) ? data.items : [];
  const meta = asRecord(data.meta);
  return {
    items: items.map(normalizeNotification),
    unread: Number(data.unread ?? 0),
    page: Number(meta.page ?? params?.page ?? 1),
    limit: Number(meta.limit ?? params?.limit ?? 20),
    total: Number(meta.total ?? items.length),
    totalPages: Number(meta.totalPages ?? 1),
  };
};

export const getInbox = async (params: InboxListParams): Promise<InboxListResult> => {
  const response = await api.get(API_ENDPOINTS.NOTIFICATIONS.INBOX, { params });
  return normalizeList(response.data, params);
};

export const getInboxById = async (id: string): Promise<InboxNotification> => {
  const response = await api.get(API_ENDPOINTS.NOTIFICATIONS.INBOX_BY_ID(id));
  return normalizeNotification(unwrap(response.data));
};

export const getInboxUnreadCount = async (): Promise<number> => {
  const response = await api.get(API_ENDPOINTS.NOTIFICATIONS.INBOX_UNREAD_COUNT);
  const data = asRecord(unwrap(response.data));
  return Number(data.unread ?? 0);
};
