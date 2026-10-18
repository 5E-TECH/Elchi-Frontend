import { api } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";
import type { TelegramLinkCode } from "../model/types";

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
