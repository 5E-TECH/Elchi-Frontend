import { api } from "../../../shared/api/instance";
import { API_ENDPOINTS } from "../../../shared/api";
import type { PaginatedResponse } from "../../../shared/types/pagination";
import { parseInactiveReason } from "../lib/inactiveReason";
import type {
  MyTelegramGroupStatus,
  Notification,
  NotificationGroupType,
  NotificationParams,
} from "../model/types";

/**
 * Backend qatori (`TelegramMarketPublicDto`): `{ id, createdAt, updatedAt, market_id, group_id, group_type,
 * bot_slug, is_active, inactive_reason, inactive_at }` (G085w5Qr). Market obyekti javobda yo'q — nom marketlar
 * ro'yxatidan olinadi.
 */
const normalizeNotification = (value: unknown): Notification => {
  const item = value as Partial<Omit<Notification, "is_active" | "inactive_reason">> & {
    id?: string | number;
    market_id?: string | number;
    group_id?: string | number;
    group_type?: string;
    is_active?: boolean | string | null;
    inactive_reason?: unknown;
    market?: {
      id?: string | number;
      name?: string;
      username?: string;
      phone_number?: string;
    } | null;
    createdAt?: string;
    updatedAt?: string;
  };
  const market = item.market ?? null;
  const marketId = String(item.market_id ?? market?.id ?? "");
  const marketName = market?.name ?? market?.username ?? market?.phone_number ?? null;
  // Maydon yo'q bo'lsa (eski javob) — faol; faqat aniq `false` nofaol.
  const isActive = item.is_active !== false && item.is_active !== "false";

  return {
    id: String(item.id),
    market_id: marketId,
    market_name: marketName,
    group_id: String(item.group_id ?? ""),
    group_type: item.group_type === "cancel" ? "cancel" : "create",
    is_active: isActive,
    // Sabab va sana faqat nofaol qatorda ma'noli; noma'lum sabab — `null` (umumiy izoh).
    inactive_reason: isActive ? null : parseInactiveReason(item.inactive_reason),
    inactive_at: isActive ? null : (item.inactive_at ?? null),
    // Sana kelmasa — `null` («hozir» deb to'qilmaydi; ko'rsatuvchi «—» yoki sanasiz matn chizadi).
    created_at: item.created_at ?? item.createdAt ?? item.updatedAt ?? null,
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

const MY_GROUP_TYPES: readonly NotificationGroupType[] = ["create", "cancel"];

/**
 * `GET /notifications/me/telegram-groups` javobi (`{ data: [{ group_type, linked, is_active, linked_at,
 * inactive_reason }] }`) → har doim ikkala tur, `create` birinchi. Tur kelmasa yoki javob boshqa shaklda bo'lsa —
 * ulanmagan (bo'sh holat to'qilmaydi: ulanmagan qator «Ulash» bilan chiziladi). Faol bo'lmagan qatorda
 * `is_active: false`, faol qatorda sabab `null`.
 */
export const normalizeMyTelegramGroups = (value: unknown): MyTelegramGroupStatus[] => {
  const payload = (value ?? {}) as { data?: unknown };
  const list = Array.isArray(payload.data) ? payload.data : Array.isArray(value) ? value : [];
  const rows = list.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null);

  return MY_GROUP_TYPES.map((groupType) => {
    const item = rows.find((row) => row.group_type === groupType);
    const linked = item?.linked === true || item?.linked === "true";
    if (!item || !linked) {
      return { group_type: groupType, linked: false, is_active: false, linked_at: null, inactive_reason: null };
    }
    // Maydon yo'q bo'lsa — faol; faqat aniq `false` nofaol (`GET /notifications` bilan bir xil qoida).
    const isActive = item.is_active !== false && item.is_active !== "false";
    return {
      group_type: groupType,
      linked: true,
      is_active: isActive,
      linked_at: typeof item.linked_at === "string" && item.linked_at ? item.linked_at : null,
      inactive_reason: isActive ? null : parseInactiveReason(item.inactive_reason),
    };
  });
};

export const getMyTelegramGroups = async (): Promise<MyTelegramGroupStatus[]> => {
  const response = await api.get(API_ENDPOINTS.NOTIFICATIONS.MY_TELEGRAM_GROUPS);
  return normalizeMyTelegramGroups(response.data);
};
