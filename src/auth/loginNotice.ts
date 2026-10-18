/**
 * Login sahifasida bir marta ko'rsatiladigan xabar (fix3b RBAC-09; dizayn v2 «Sessiya tugadi»).
 *
 * Chiqish `window.location.replace("/login")` bilan sahifani to'liq qayta
 * yuklaydi — bildirishnoma (toast) yo'qoladi. Shuning uchun sabab
 * sessionStorage'da qoldiriladi va login sahifasi uni o'qib ko'rsatadi:
 *   - `passwordChanged` — o'z parolini o'zgartirgan foydalanuvchi (`UpdateUserModal`);
 *   - `sessionExpired`  — sessiya tugadi (`authService.logoutAndRedirect({ reason })`), `at` — tugagan vaqt
 *     (ms), «Sessiya tugadi» ekranida ko'rsatiladi (maket `common-session-expired`).
 *
 * Bir vaqtda bitta xabar turadi (oxirgi yozgan yutadi). Saqlash shakli — JSON
 * (`{"notice":"sessionExpired","at":…}`); o'quvchi eski oddiy satrni (`passwordChanged`) ham qabul qiladi.
 */
export type LoginNotice = "passwordChanged" | "sessionExpired";

export type LoginNoticeMeta = {
  /** Hodisa vaqti (ms). `sessionExpired` uchun — sessiya tugagan vaqt. */
  at?: number | null;
};

export type LoginNoticeDetails = {
  notice: LoginNotice;
  at: number | null;
};

const LOGIN_NOTICE_KEY = "elchi_login_notice";
const KNOWN_NOTICES: readonly LoginNotice[] = ["passwordChanged", "sessionExpired"];

const isKnownNotice = (value: unknown): value is LoginNotice =>
  typeof value === "string" && KNOWN_NOTICES.includes(value as LoginNotice);

const toTimestamp = (value: unknown): number | null => {
  const parsed = typeof value === "number" ? value : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const parseNotice = (raw: string | null): LoginNoticeDetails | null => {
  if (!raw) return null;
  // Eski shakl: oddiy satr.
  if (isKnownNotice(raw)) return { notice: raw, at: null };
  try {
    const parsed = JSON.parse(raw) as { notice?: unknown; at?: unknown } | null;
    if (!parsed || typeof parsed !== "object" || !isKnownNotice(parsed.notice)) return null;
    return { notice: parsed.notice, at: toTimestamp(parsed.at) };
  } catch {
    return null;
  }
};

export const rememberLoginNotice = (notice: LoginNotice, meta: LoginNoticeMeta = {}) => {
  const at = toTimestamp(meta.at);
  try {
    window.sessionStorage.setItem(LOGIN_NOTICE_KEY, JSON.stringify(at ? { notice, at } : { notice }));
  } catch {
    // Saqlab bo'lmasa xabar ko'rinmaydi, chiqish baribir bajariladi.
  }
};

/** Xabar va uning vaqti — o'chirmasdan (React StrictMode initializer'ni ikki marta chaqiradi). */
export const peekLoginNoticeDetails = (): LoginNoticeDetails | null => {
  try {
    return parseNotice(window.sessionStorage.getItem(LOGIN_NOTICE_KEY));
  } catch {
    return null;
  }
};

/** Faqat xabar turi — o'chirmasdan o'qiydi. */
export const peekLoginNotice = (): LoginNotice | null => peekLoginNoticeDetails()?.notice ?? null;

export const clearLoginNotice = () => {
  try {
    window.sessionStorage.removeItem(LOGIN_NOTICE_KEY);
  } catch {
    // Saqlash joyi yopiq bo'lsa ham login ishlayveradi.
  }
};
