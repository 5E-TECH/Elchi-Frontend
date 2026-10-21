import { api } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";
import type { GroupLinkCode, GroupLinkCodeRequest, TelegramLinkCode } from "../model/types";

/** Javob konvertda (`{ statusCode, message, data }`) yoki to'g'ridan-to'g'ri kelishi mumkin. */
const unwrapEnvelope = (body: unknown): Record<string, unknown> => {
  if (!body || typeof body !== "object") return {};
  const record = body as Record<string, unknown>;
  const nested = record.data;
  return nested && typeof nested === "object" ? (nested as Record<string, unknown>) : record;
};

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

export const normalizeTelegramLinkCode = (body: unknown): TelegramLinkCode => {
  const data = unwrapEnvelope(body);
  return {
    token: text(data.token) ?? "",
    deepLink: text(data.deep_link),
    command: text(data.command),
    expiresAt: text(data.expires_at),
  };
};

/** POST /users/me/telegram/link-code — bir martalik kod (10 daqiqa), `deep_link` = `https://t.me/<bot>?start=<kod>`. */
export const requestTelegramLinkCode = async (): Promise<TelegramLinkCode> => {
  const response = await api.post(API_ENDPOINTS.USERS.MY_TELEGRAM_LINK_CODE);
  return normalizeTelegramLinkCode(response.data);
};

/** DELETE /users/me/telegram → `{ unlinked }` (audit server tomonda yoziladi). */
export const unlinkTelegram = async (): Promise<boolean> => {
  const response = await api.delete(API_ENDPOINTS.USERS.MY_TELEGRAM);
  return unwrapEnvelope(response.data).unlinked === true;
};

export const normalizeGroupLinkCode = (body: unknown): GroupLinkCode => {
  const data = unwrapEnvelope(body);
  const token = text(data.token) ?? "";
  return {
    token,
    purpose: "market_group",
    group_type: data.group_type === "cancel" ? "cancel" : "create",
    expires_at: text(data.expires_at) ?? "",
    deep_link: text(data.deep_link),
    command: text(data.command) ?? (token ? `/start ${token}` : ""),
  };
};

/**
 * POST /telegram/link-code (`purpose: "market_group"`) — market guruhini ulash uchun bir martalik havola
 * (`https://t.me/<bot>?startgroup=<kod>`, 10 daqiqa). Bildirishnoma qo'shish oynasi (`notification-create`) va
 * foydalanuvchi tafsilotidagi «Telegram guruhi» shu yerdan oladi.
 */
export const requestGroupLinkCode = async (payload: GroupLinkCodeRequest): Promise<GroupLinkCode> => {
  const response = await api.post(API_ENDPOINTS.NOTIFICATIONS.TELEGRAM_LINK_CODE, payload);
  return normalizeGroupLinkCode(response.data);
};
