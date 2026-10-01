/**
 * Login sahifasida bir marta ko'rsatiladigan xabar (fix3b RBAC-09).
 *
 * Chiqish `window.location.replace("/login")` bilan sahifani to'liq qayta
 * yuklaydi — bildirishnoma (toast) yo'qoladi. Shuning uchun sabab
 * sessionStorage'da qoldiriladi va login formasi uni o'qib ko'rsatadi.
 */
export type LoginNotice = "passwordChanged";

const LOGIN_NOTICE_KEY = "elchi_login_notice";
const KNOWN_NOTICES: readonly LoginNotice[] = ["passwordChanged"];

export const rememberLoginNotice = (notice: LoginNotice) => {
  try {
    window.sessionStorage.setItem(LOGIN_NOTICE_KEY, notice);
  } catch {
    // Saqlab bo'lmasa xabar ko'rinmaydi, chiqish baribir bajariladi.
  }
};

/** O'chirmasdan o'qiydi (React StrictMode initializer'ni ikki marta chaqiradi). */
export const peekLoginNotice = (): LoginNotice | null => {
  try {
    const value = window.sessionStorage.getItem(LOGIN_NOTICE_KEY);
    return KNOWN_NOTICES.includes(value as LoginNotice) ? (value as LoginNotice) : null;
  } catch {
    return null;
  }
};

export const clearLoginNotice = () => {
  try {
    window.sessionStorage.removeItem(LOGIN_NOTICE_KEY);
  } catch {
    // Saqlash joyi yopiq bo'lsa ham login ishlayveradi.
  }
};
