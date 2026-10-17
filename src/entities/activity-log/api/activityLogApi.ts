import { api } from "../../../shared/api/instance";
import { API_ENDPOINTS } from "../../../shared/api";
import type {
  ActivityActionCategory,
  ActivityActionMeta,
  ActivityActionsCatalog,
  ActivityActor,
  ActivityLog,
  ActivityLogListResult,
  ActivityLogParams,
} from "../model/types";

// The gateway wraps responses as `{ data: ... }`. Unwrap defensively so the
// hooks survive an occasional un-enveloped payload.
const unwrap = (payload: unknown): unknown =>
  payload && typeof payload === "object" && "data" in payload
    ? (payload as { data: unknown }).data
    : payload;

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const str = (value: unknown): string => (value == null ? "" : String(value));
const strOrNull = (value: unknown): string | null => (value == null ? null : String(value));
const objOrNull = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

const normalizeActor = (value: unknown): ActivityActor | null => {
  if (!value || typeof value !== "object") return null;
  const a = value as Record<string, unknown>;
  return {
    id: strOrNull(a.id),
    name: strOrNull(a.name),
    username: strOrNull(a.username),
    phone_number: strOrNull(a.phone_number),
    role: strOrNull(a.role),
    status: strOrNull(a.status),
    resolved: typeof a.resolved === "boolean" ? a.resolved : null,
  };
};

const textOrNull = (value: unknown): string | null => {
  const text = value == null ? "" : String(value).trim();
  return text ? text : null;
};

/** `action_meta` / `registry[]` yozuvi (y8CxCtcK). Fe'l ham, yorliq ham bo'lmasa — `null`. */
export const normalizeActionMeta = (value: unknown): ActivityActionMeta | null => {
  if (!value || typeof value !== "object") return null;
  const m = value as Record<string, unknown>;
  const action = textOrNull(m.action);
  const label = textOrNull(m.label);
  if (!action && !label) return null;
  return {
    action: action ?? "",
    label: label ?? "",
    category: textOrNull(m.category),
    categoryLabel: textOrNull(m.category_label ?? m.categoryLabel),
    icon: textOrNull(m.icon),
    tone: textOrNull(m.tone),
    known: m.known !== false,
  };
};

const normalizeLog = (value: unknown): ActivityLog => {
  const row = asRecord(value);
  return {
    id: str(row.id),
    entity_type: str(row.entity_type),
    entity_id: str(row.entity_id),
    action: str(row.action),
    old_value: objOrNull(row.old_value),
    new_value: objOrNull(row.new_value),
    user_id: strOrNull(row.user_id),
    user_name: strOrNull(row.user_name),
    user_role: strOrNull(row.user_role),
    // Merge adds `_service`; the row itself may also carry `service`.
    service: strOrNull(row.service ?? row._service),
    trace_id: strOrNull(row.trace_id),
    metadata: objOrNull(row.metadata),
    created_at: str(row.created_at ?? row.createdAt),
    actor: normalizeActor(row.actor),
    action_meta: normalizeActionMeta(row.action_meta),
    actor_status: strOrNull(row.actor_status),
    entity: objOrNull(row.entity),
    references: objOrNull(row.references),
  };
};

const normalizeList = (payload: unknown, params?: ActivityLogParams): ActivityLogListResult => {
  const data = asRecord(unwrap(payload));
  const items = Array.isArray(data.items) ? data.items : [];
  const meta = asRecord(data.meta);
  const limit = Number(meta.limit ?? params?.limit ?? 20);
  const total = Number(meta.total ?? items.length);
  return {
    items: items.map(normalizeLog),
    page: Number(meta.page ?? params?.page ?? 1),
    limit,
    total,
    totalPages: Number(meta.totalPages ?? Math.max(1, Math.ceil(total / Math.max(1, limit)))),
  };
};

export const getActivityLogs = async (
  params: ActivityLogParams,
): Promise<ActivityLogListResult> => {
  const response = await api.get(API_ENDPOINTS.ACTIVITY_LOGS.BASE, { params });
  return normalizeList(response.data, params);
};

const normalizeCategory = (value: unknown): ActivityActionCategory | null => {
  const c = asRecord(value);
  const key = textOrNull(c.key);
  return key ? { key, label: textOrNull(c.label) ?? key } : null;
};

/**
 * `GET /activity-logs/actions` (y8CxCtcK): `{ data: string[], registry: [...], categories: [{ key, label }] }`.
 * Eski backend — faqat `data: string[]` (reyestr va kategoriyalar bo'sh).
 */
export const normalizeActionsCatalog = (payload: unknown): ActivityActionsCatalog => {
  const body = asRecord(payload);
  // Qo'shimcha o'ram (`{ data: { data, registry, categories } }`) — ichkarisini o'qiymiz.
  if (body.data && typeof body.data === "object" && !Array.isArray(body.data)) {
    return normalizeActionsCatalog(body.data);
  }
  const data = Array.isArray(payload) ? payload : body.data;
  const registry = (Array.isArray(body.registry) ? body.registry : [])
    .map(normalizeActionMeta)
    .filter((item): item is ActivityActionMeta => Boolean(item?.action));
  const categories = (Array.isArray(body.categories) ? body.categories : [])
    .map(normalizeCategory)
    .filter((item): item is ActivityActionCategory => item !== null);
  const actions = Array.isArray(data) ? data.map(str).filter(Boolean) : registry.map((item) => item.action);
  return { actions, registry, categories };
};

export const getActivityActions = async (): Promise<ActivityActionsCatalog> => {
  const response = await api.get(API_ENDPOINTS.ACTIVITY_LOGS.ACTIONS);
  return normalizeActionsCatalog(response.data);
};

export const getEntityHistory = async (
  entityType: string,
  entityId: string,
  limit = 200,
): Promise<ActivityLog[]> => {
  const response = await api.get(API_ENDPOINTS.ACTIVITY_LOGS.ENTITY(entityType, entityId), {
    params: { limit },
  });
  const data = asRecord(unwrap(response.data));
  const items = Array.isArray(data.items) ? data.items : [];
  return items.map(normalizeLog);
};

export const getUserActivity = async (
  userId: string,
  params: ActivityLogParams,
): Promise<ActivityLogListResult> => {
  const response = await api.get(API_ENDPOINTS.ACTIVITY_LOGS.USER(userId), { params });
  return normalizeList(response.data, params);
};
