import { logoutRevokedSession } from "./authService";
import { isRevokedReason, type RevokedReason } from "./loginNotice";
import tokenStorage from "./tokenStorage";

/**
 * Sessiya boshqa qurilmadan yopilganda jonli kanal orqali joyida chiqish (Elchi Pochta #3, 2026-10-24).
 *
 * Backend kontrakti (`/realtime`, api-gateway `RealtimeGateway`):
 *   - `sid` li token bilan ulangan socket `session:<sid>` xonasida turadi. Sessiya yopilganda («Chiqarish»,
 *     «Boshqa barcha qurilmalardan chiqish», parol almashishi, admin parolni tiklashi, shu sessiyadagi «Chiqish»)
 *     server `auth:session_revoked` `{ session_id, reason }` yuboradi va ~250 ms dan keyin socketni o'zi uzadi
 *     («io server disconnect»).
 *   - Yopilgan sessiya tokeni bilan ulanish rad etiladi: `error` `{ message: "Session revoked", code:
 *     "SESSION_REVOKED" }`, so'ng server uzadi (namespace middleware rad etsa — `connect_error`, xabari shu).
 *
 * Bu modul faqat qaror qiladi: hodisa SHU tokenning sessiyasigami (`sid` mos) va xato «sessiya yopilgan»mi.
 * Chiqishning o'zi — `authService.logoutRevokedSession` (bir marta, `POST auth/logout` siz). Socketni uzish —
 * `RealtimeSync`.
 */
export const SESSION_REVOKED_EVENT = "auth:session_revoked";

const SESSION_REVOKED_CODE = "session_revoked";

const normalizeId = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim().toLowerCase() : null;

/**
 * `auth:session_revoked` — `session_id` joriy access token `sid` iga mos bo'lsa: shu sessiya yopilgan, natija
 * `true` (socket yopiladi) va majburiy chiqish boshlanadi — shu tab o'zi chiqayotgan bo'lsa (`logout()`, o'z
 * «Chiqish» i haqidagi hodisa) chiqish ikkinchi marta boshlanmaydi. Mos emas, `sid` siz token yoki token yo'q
 * (allaqachon chiqilgan) — e'tiborsiz (`false`).
 */
export const handleSessionRevokedEvent = (payload: unknown): boolean => {
  if (!payload || typeof payload !== "object") return false;
  const { session_id: sessionId, reason } = payload as { session_id?: unknown; reason?: unknown };
  const target = normalizeId(sessionId);
  const current = tokenStorage.getSessionId();
  if (!target || !current || target !== current) return false;
  const knownReason: RevokedReason | null = isRevokedReason(reason) ? reason : null;
  void logoutRevokedSession(knownReason);
  return true;
};

const mentionsSessionRevoked = (value: unknown) => {
  if (typeof value !== "string") return false;
  const text = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return text.includes(SESSION_REVOKED_CODE);
};

/**
 * Ulanish xatosi (`connect_error`) yoki server `error` hodisasi «sessiya yopilgan» degani: `code` /
 * `message` (o'zi yoki `data` ichida) `SESSION_REVOKED` / «Session revoked». Oddiy `Unauthorized` (401, masalan
 * access token muddati o'tgan) — YO'Q: u holda sessiya tirik bo'lishi mumkin, HTTP so'rovi tokenni yangilaydi
 * (yopilgan bo'lsa — 401 «Session revoked» → refresh 401 → login, avvalgi zaxira yo'l).
 */
export const isSessionRevokedSocketError = (error: unknown, depth = 0): boolean => {
  if (typeof error === "string") return mentionsSessionRevoked(error);
  if (!error || typeof error !== "object") return false;
  const { message, code, data } = error as { message?: unknown; code?: unknown; data?: unknown };
  if (mentionsSessionRevoked(code) || mentionsSessionRevoked(message)) return true;
  // `connect_error` da server tafsiloti `error.data` da keladi; chuqurlik cheklangan (aylanma obyekt bo'lsa ham).
  return depth < 2 && data !== undefined && data !== error ? isSessionRevokedSocketError(data, depth + 1) : false;
};

/**
 * Socket ulanishi «sessiya yopilgan» deb rad etildi — joriy token `sid` li bo'lsa (sessiya tekshiruvi faqat
 * shunday tokenlarda): natija `true` (socket yopiladi) va majburiy chiqish boshlanadi (shu tab o'zi chiqayotgan
 * bo'lsa — yo'q).
 */
export const handleSessionRevokedSocketError = (error: unknown): boolean => {
  if (!isSessionRevokedSocketError(error)) return false;
  if (!tokenStorage.getSessionId()) return false;
  void logoutRevokedSession();
  return true;
};
