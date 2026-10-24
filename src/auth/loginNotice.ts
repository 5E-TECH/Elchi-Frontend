/**
 * Login sahifasida bir marta ko'rsatiladigan xabar (fix3b RBAC-09; dizayn v2 «Sessiya tugadi»).
 *
 * Chiqish `window.location.replace("/login")` bilan sahifani to'liq qayta
 * yuklaydi — bildirishnoma (toast) yo'qoladi. Shuning uchun sabab
 * sessionStorage'da qoldiriladi va login sahifasi uni o'qib ko'rsatadi:
 *   - `passwordChanged` — o'z parolini o'zgartirgan foydalanuvchi (`UpdateUserModal`);
 *   - `sessionExpired`  — sessiya tugadi (`authService.logoutAndRedirect({ reason })`), `at` — tugagan vaqt
 *     (ms), «Sessiya tugadi» ekranida ko'rsatiladi (maket `common-session-expired`); `revoked: true` — sessiya
 *     boshqa qurilmadan yopilgan (server 401 «Session revoked» yoki jonli kanal `auth:session_revoked`), ekran shu
 *     sababni aytadi; `revokedReason` — server aytgan sabab (`password_changed` bo'lsa matn «Parol almashtirildi»).
 *
 * Bir vaqtda bitta xabar turadi (oxirgi yozgan yutadi). Saqlash shakli — JSON
 * (`{"notice":"sessionExpired","at":…}`); o'quvchi eski oddiy satrni (`passwordChanged`) ham qabul qiladi.
 */
export type LoginNotice = "passwordChanged" | "sessionExpired";

/** Sessiya nega yopildi (backend `auth:session_revoked` → `reason`). */
export type RevokedReason = "revoked_by_owner" | "password_changed" | "logout" | "security_reset";

export const REVOKED_REASONS: readonly RevokedReason[] = [
  "revoked_by_owner",
  "password_changed",
  "logout",
  "security_reset",
];

export const isRevokedReason = (value: unknown): value is RevokedReason =>
  typeof value === "string" && REVOKED_REASONS.includes(value as RevokedReason);

export type LoginNoticeMeta = {
  /** Hodisa vaqti (ms). `sessionExpired` uchun — sessiya tugagan vaqt. */
  at?: number | null;
  /** `sessionExpired`: sessiya boshqa qurilmadan («Sessiyalar» → «Chiqarish») yopilgan. */
  revoked?: boolean;
  /** `sessionExpired` + `revoked`: server aytgan sabab (faqat ma'lum qiymat saqlanadi). */
  revokedReason?: RevokedReason | null;
};

export type LoginNoticeDetails = {
  notice: LoginNotice;
  at: number | null;
  /** Faqat `true` bo'lsa bor. */
  revoked?: true;
  /** Faqat `revoked` va ma'lum sabab bo'lsa bor. */
  revokedReason?: RevokedReason;
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
    const parsed = JSON.parse(raw) as {
      notice?: unknown;
      at?: unknown;
      revoked?: unknown;
      revokedReason?: unknown;
    } | null;
    if (!parsed || typeof parsed !== "object" || !isKnownNotice(parsed.notice)) return null;
    const revoked = parsed.notice === "sessionExpired" && parsed.revoked === true;
    return {
      notice: parsed.notice,
      at: toTimestamp(parsed.at),
      ...(revoked ? { revoked: true as const } : {}),
      ...(revoked && isRevokedReason(parsed.revokedReason) ? { revokedReason: parsed.revokedReason } : {}),
    };
  } catch {
    return null;
  }
};

export const rememberLoginNotice = (notice: LoginNotice, meta: LoginNoticeMeta = {}) => {
  const at = toTimestamp(meta.at);
  const revoked = notice === "sessionExpired" && meta.revoked === true;
  const revokedReason = revoked && isRevokedReason(meta.revokedReason) ? meta.revokedReason : null;
  try {
    window.sessionStorage.setItem(
      LOGIN_NOTICE_KEY,
      JSON.stringify({
        notice,
        ...(at ? { at } : {}),
        ...(revoked ? { revoked: true } : {}),
        ...(revokedReason ? { revokedReason } : {}),
      }),
    );
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

/**
 * Majburiy chiqishda (`logoutRevokedSession`) xabar shu hujjat qayta yuklanguncha o'chirilmaydi: holat tozalangach
 * React `/login` ga o'zi o'tadi va kirish sahifasi xabarni o'qib o'chirib qo'yardi — `location.replace("/login")`
 * dan keyingi yangi hujjat esa uni ko'rmasdi (sabab yo'qolib, oddiy forma chiqardi). Yangi hujjatda bayroq yo'q.
 */
let heldUntilReload = false;

export const holdLoginNoticeUntilReload = () => {
  heldUntilReload = true;
};

export const resetLoginNoticeHoldForTests = () => {
  heldUntilReload = false;
};

export const clearLoginNotice = () => {
  if (heldUntilReload) return;
  try {
    window.sessionStorage.removeItem(LOGIN_NOTICE_KEY);
  } catch {
    // Saqlash joyi yopiq bo'lsa ham login ishlayveradi.
  }
};
