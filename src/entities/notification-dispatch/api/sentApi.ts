import { api } from "../../../shared/api/instance";
import { API_ENDPOINTS } from "../../../shared/api";
import { isDispatchHistoryStatus } from "../model/status";
import type {
  ChannelStatusCounts,
  DispatchAudience,
  SentDetail,
  SentDetailParams,
  UndeliveredFailure,
  UndeliveredItem,
} from "../model/types";

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/** Gateway `{ statusCode, message, data }` o'rami — ehtiyotkor ochish. */
const unwrap = (payload: unknown) => {
  const record = asRecord(payload);
  return "data" in record && record.data && typeof record.data === "object" ? asRecord(record.data) : record;
};

const toCount = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

const toText = (value: unknown): string | null =>
  typeof value === "string" ? value : typeof value === "number" ? String(value) : null;

const toStrings = (value: unknown) => (Array.isArray(value) ? value.map(String) : []);

/** `{ kanal: son }` — faqat sonlar. */
export const toCountMap = (value: unknown): Record<string, number> =>
  Object.fromEntries(Object.entries(asRecord(value)).map(([key, n]) => [key, toCount(n)]));

/** `{ kanal: { holat: son } }`; bo'sh yoki noto'g'ri — `null`. */
export const toChannelStatus = (value: unknown): ChannelStatusCounts | null => {
  const record = asRecord(value);
  const keys = Object.keys(record);
  if (!keys.length) return null;
  return Object.fromEntries(keys.map((channel) => [channel, toCountMap(record[channel])]));
};

const toAudience = (value: unknown): DispatchAudience | null => {
  const record = asRecord(value);
  if (!Object.keys(record).length) return null;
  return {
    ...(record.recipient_ids !== undefined ? { recipient_ids: toCount(record.recipient_ids) } : {}),
    ...(Array.isArray(record.roles) ? { roles: record.roles.map(String) } : {}),
    ...(record.broadcast === true ? { broadcast: true } : {}),
    ...(record.include_customers === true ? { include_customers: true } : {}),
  };
};

const toFailure = (value: unknown): UndeliveredFailure => {
  const record = asRecord(value);
  return {
    channel: String(record.channel ?? ""),
    status: String(record.status ?? ""),
    reason: toText(record.reason),
  };
};

const toUndeliveredItem = (value: unknown): UndeliveredItem => {
  const record = asRecord(value);
  return {
    notification_id: String(record.notification_id ?? ""),
    recipient_id: String(record.recipient_id ?? ""),
    name: toText(record.name),
    role: toText(record.role),
    failures: Array.isArray(record.failures) ? record.failures.map(toFailure).filter((item) => item.channel) : [],
  };
};

/** `GET /notifications/sent/:dispatch_id` javobi → `SentDetail` (backend `DispatchHistoryService.detail`). */
export const normalizeSentDetail = (payload: unknown, params: SentDetailParams = {}): SentDetail => {
  const data = unwrap(payload);
  const undelivered = asRecord(data.undelivered);
  const meta = asRecord(undelivered.meta);
  const items = Array.isArray(undelivered.items) ? undelivered.items.map(toUndeliveredItem) : [];
  const createdBy = asRecord(data.created_by);
  return {
    dispatch_id: String(data.dispatch_id ?? ""),
    status: isDispatchHistoryStatus(data.status) ? data.status : "running",
    type: String(data.type ?? ""),
    category: toText(data.category),
    priority: toText(data.priority),
    title: String(data.title ?? ""),
    body: toText(data.body),
    link: toText(data.link),
    channels: toStrings(data.channels),
    recipients: toCount(data.recipients),
    dispatched: toCount(data.dispatched),
    skipped_by_preference: toCount(data.skipped_by_preference),
    by_channel: toCountMap(data.by_channel),
    channel_status: toChannelStatus(data.channel_status),
    no_provider: toStrings(data.no_provider),
    audience: toAudience(data.audience),
    created_by: Object.keys(createdBy).length
      ? { id: String(createdBy.id ?? ""), name: toText(createdBy.name), role: toText(createdBy.role) }
      : null,
    created_at: toText(data.created_at ?? data.createdAt),
    finished_at: toText(data.finished_at),
    undelivered: {
      items,
      page: toCount(meta.page) || params.page || 1,
      limit: toCount(meta.limit) || params.limit || items.length,
      total: meta.total !== undefined ? toCount(meta.total) : items.length,
    },
  };
};

export const getSentDetail = async (dispatchId: string, params: SentDetailParams = {}) => {
  const response = await api.get(API_ENDPOINTS.NOTIFICATIONS.SENT_BY_ID(dispatchId), { params });
  return normalizeSentDetail(response.data, params);
};
