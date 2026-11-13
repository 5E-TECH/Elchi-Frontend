import { BASE_URL } from "../shared/const";
import tokenStorage from "./tokenStorage";
import { getLoginEpoch } from "./loginEpoch";
import { emitNetworkRestored, markNetworkDown } from "./networkError";
import {
  handleSecurityResponse,
  isSessionRevokedBody,
  prepareAccessToken,
  refreshAfterUnauthorized,
} from "./setupInterceptors";

/**
 * ────────────────────────────────────────────────────────────────────────────
 *  `fetch` + AXIOS INTERCEPTOR XULQI (F7PWp6cK, AI yordamchining SSE oqimi)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  SSE javobini o'qish uchun `fetch` + `ReadableStream` kerak (`EventSource` POST va `Authorization` ni bilmaydi;
 *  axios xato tanasini oqim sifatida berib, `PASSWORD_CHANGE_REQUIRED` kodini o'qib bo'lmaydi). Shuning uchun
 *  axios interceptor qiladigan ishlar shu yerda — o'sha yordamchilar bilan (`setupInterceptors.ts`):
 *
 *   - so'rov oldidan: refresh token muddati o'tgan — chiqish; access token muddati o'tgan — bitta umumiy yangilash;
 *   - `Authorization: Bearer …` (token `sessionStorage` da, cookie emas) + `credentials: "include"` (refresh cookie);
 *   - 401 — bitta yangilash va bitta qayta yuborish; so'rov ESKI kirishda ketgan bo'lsa (`loginEpoch`) — qayta
 *     yuborilmaydi (boshqa foydalanuvchi tokeni bilan eski savol ketmasin); «Session revoked» — sababi bilan chiqish;
 *   - 403 `PASSWORD_CHANGE_REQUIRED` — «Yangi parol o'rnating» oynasi; 503 `SESSION_CHECK_UNAVAILABLE` — ogohlantirish;
 *   - javob kelsa — «Aloqa tiklandi» (uzilish bo'lgan bo'lsa); javobsiz (`TypeError`) — tarmoq uzilgani belgilanadi,
 *     xabarsiz (oqim xatosini sahifa o'zi ko'rsatadi: «Aloqa uzildi»).
 *
 *  Bekor qilish (`signal`) — `AbortError` bilan rad etiladi (tarmoq xatosi emas, xabarsiz).
 */

/** API manzili: `BASE_URL` oxiridagi `/` olib tashlangan (`shared/const`), yo'l boshidagisi — shu yerda. */
export const apiUrl = (path: string) => `${BASE_URL}/${path.replace(/^\/+/, "")}`;

export const isAbortError = (error: unknown): boolean =>
  typeof error === "object" && error !== null && (error as { name?: unknown }).name === "AbortError";

/** `fetch` / oqim o'qishining tarmoq xatosi (javob kelmadi yoki ulanish uzildi) — bekor qilish emas. */
export const isFetchNetworkError = (error: unknown): boolean => !isAbortError(error) && error instanceof TypeError;

/** Tarmoq uzilganini xabarsiz belgilaydi — keyingi muvaffaqiyatli javob «Aloqa tiklandi» ni chiqaradi. */
export const noteFetchNetworkFailure = (error: unknown) => {
  if (isFetchNetworkError(error)) markNetworkDown("offline");
};

const readJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.clone().json();
  } catch {
    return null;
  }
};

const abortError = () => new DOMException("The operation was aborted.", "AbortError");

export const authFetch = async (path: string, init: RequestInit = {}): Promise<Response> => {
  const epoch = getLoginEpoch();

  const send = async (token: string | null) => {
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    try {
      const response = await fetch(apiUrl(path), { ...init, headers, credentials: "include" });
      emitNetworkRestored();
      return { response, authorization: headers.get("Authorization") };
    } catch (error) {
      noteFetchNetworkFailure(error);
      throw error;
    }
  };

  let sent = await send(await prepareAccessToken());

  if (sent.response.status === 401 && epoch === getLoginEpoch() && tokenStorage.getAccessToken()) {
    const body = await readJson(sent.response);
    const next = await refreshAfterUnauthorized({ revoked: isSessionRevokedBody(body) });
    // Yangilash paytida foydalanuvchi qayta kirdi yoki savolni to'xtatdi — qayta yuborilmaydi.
    if (epoch !== getLoginEpoch()) return sent.response;
    if (init.signal?.aborted) throw abortError();
    sent = await send(next);
  }

  if (sent.response.status === 403 || sent.response.status === 503) {
    handleSecurityResponse(sent.response.status, await readJson(sent.response), sent.authorization);
  }

  return sent.response;
};

export default authFetch;
