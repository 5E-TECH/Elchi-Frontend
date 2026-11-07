/**
 * Kirishlar hisoblagichi (sekin internet, 2026-11-07). Sekin tarmoqda ESKI sessiyaning ishi (chiqish, token
 * yangilash, bootstrap, eski so'rovning 401 i) foydalanuvchi qayta kirgandan KEYIN tugashi mumkin — u yangi sessiyani
 * o'chirmasligi, `/login` ga qaytarmasligi va eski so'rovni yangi foydalanuvchi tokeni bilan qayta yubormasligi kerak.
 *
 *   - `attempts` — boshlangan kirishlar (`login()` boshida +1);
 *   - `epoch` — muvaffaqiyatli kirishlar (yangi token saqlandi, +1).
 *
 * Alohida modul: `setupInterceptors` ham ishlatadi, `authService` ni soxtalashtirgan testlar unga tegmaydi.
 */
let attempts = 0;
let epoch = 0;

export const getLoginAttempts = () => attempts;
export const noteLoginAttempt = () => {
  attempts += 1;
};

export const getLoginEpoch = () => epoch;
export const bumpLoginEpoch = () => {
  epoch += 1;
};

export type LoginMark = { attempts: number; epoch: number };

/** Hozirgi holat — keyin `loginHappenedSince` bilan solishtirish uchun. */
export const markLogins = (): LoginMark => ({ attempts, epoch });

/** Belgidan keyin kirish boshlangan yoki tugagan. */
export const loginHappenedSince = (mark: LoginMark) => attempts !== mark.attempts || epoch !== mark.epoch;

/** Token yangilash javobi kelguncha yangi kirish bo'ldi — javob (eski sessiyaniki) tashlandi. Chiqish sababi EMAS. */
const supersededRefreshErrors = new WeakSet<object>();

export const supersededRefreshError = () => {
  const error = new Error("Refresh superseded by a newer login");
  supersededRefreshErrors.add(error);
  return error;
};

export const isRefreshSuperseded = (error: unknown): boolean =>
  Boolean(error && typeof error === "object" && supersededRefreshErrors.has(error));
