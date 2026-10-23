import { api } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";
import type { AccountSession, AccountSessionList, RevokeSessionsResult } from "../model/types";

type Raw = Record<string, unknown>;

const asRecord = (value: unknown): Raw | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Raw) : null;

const text = (value: unknown): string | null => {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

/** Backend qatori → `AccountSession`; `id` siz qator — `null` (ro'yxatdan tashlanadi). */
export const normalizeAccountSession = (value: unknown): AccountSession | null => {
  const item = asRecord(value);
  const id = item ? text(item.id) : null;
  if (!item || !id) return null;
  return {
    id,
    device_name: text(item.device_name),
    device_id: text(item.device_id),
    user_agent: text(item.user_agent),
    ip: text(item.ip),
    logged_in_at: text(item.logged_in_at),
    last_seen_at: text(item.last_seen_at),
    expires_at: text(item.expires_at),
    current: item.current === true,
  };
};

/**
 * `{ statusCode, message, data: { active_count, sessions } }` → `AccountSessionList`. Tartib server tartibi
 * (oxirgi faollik bo'yicha yangisi tepada). `active_count` yo'q yoki ro'yxatdan kichik bo'lsa — ro'yxat uzunligi;
 * boshqa shakl (bo'sh `data`, massiv) — bo'sh ro'yxat.
 */
export const normalizeAccountSessionList = (value: unknown): AccountSessionList => {
  const response = asRecord(value) ?? {};
  const data = asRecord(response.data) ?? response;
  const rows = Array.isArray(data.sessions) ? data.sessions : [];
  const sessions = rows.map(normalizeAccountSession).filter((row): row is AccountSession => row !== null);
  const reported = Number(data.active_count);
  const activeCount = Number.isFinite(reported) && reported >= 0 ? Math.floor(reported) : 0;
  return { active_count: Math.max(activeCount, sessions.length), sessions };
};

/** `GET /auth/sessions` — so'rovchining o'z faol sessiyalari (boshqa foydalanuvchilarniki va umumiy son yo'q). */
export const getMySessions = async (): Promise<AccountSessionList> => {
  const response = await api.get(API_ENDPOINTS.AUTH.SESSIONS);
  return normalizeAccountSessionList(response.data);
};

/**
 * `{ statusCode, message, data: { revoked, session_ids } }` → `RevokeSessionsResult`. `session_ids` dagi bo'sh /
 * satr bo'lmagan qiymatlar tashlanadi; `revoked` yo'q yoki noto'g'ri bo'lsa — ID lar soni.
 */
export const normalizeRevokeSessionsResult = (value: unknown): RevokeSessionsResult => {
  const response = asRecord(value) ?? {};
  const data = asRecord(response.data) ?? response;
  const ids = Array.isArray(data.session_ids)
    ? data.session_ids.map(text).filter((id): id is string => id !== null)
    : [];
  const reported = Number(data.revoked);
  const revoked = Number.isFinite(reported) && reported >= 0 ? Math.floor(reported) : ids.length;
  return { revoked, session_ids: ids };
};

/**
 * `DELETE /auth/sessions/:id` — o'z BOSHQA sessiyasini yopish (o'sha qurilma keyingi so'rovida 401 oladi va kirish
 * sahifasiga tushadi). 400 — joriy sessiya yoki noto'g'ri ID, 404 — topilmadi / allaqachon yopilgan.
 */
export const revokeSession = async (id: string): Promise<RevokeSessionsResult> => {
  const response = await api.delete(API_ENDPOINTS.AUTH.SESSION_BY_ID(id));
  return normalizeRevokeSessionsResult(response.data);
};

/**
 * `POST /auth/sessions/revoke-others` (tanasiz) — joriydan boshqa barcha faol sessiyalarni yopish. 400 — joriy
 * sessiya aniqlanmadi (sessiyalardan oldingi eski token): qayta kirish kerak.
 */
export const revokeOtherSessions = async (): Promise<RevokeSessionsResult> => {
  const response = await api.post(API_ENDPOINTS.AUTH.SESSIONS_REVOKE_OTHERS);
  return normalizeRevokeSessionsResult(response.data);
};
