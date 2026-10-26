import axios from "axios";
import type { QueryClient } from "@tanstack/react-query";
import store from "../app/config/store";
import { queryKeys } from "../shared/config/queryKeys";
import { setId, setName, setRegion, setRole, removeRole } from "../shared/model/roleSlice";
import { BASE_URL } from "../shared/const";
import { API_ENDPOINTS } from "../shared/api";
import { loginSuccess, logout as logoutAction, setAppInitializing, setProfile, setError } from "../entities/user/model/slice";
import tokenStorage from "./tokenStorage";
import type { User } from "../entities/user/model/types";
import { clearStoredUiPreferences } from "../shared/lib/preferencesStorage";
import { emitNetworkError, isNetworkFailure, isTransientAuthFailure, NETWORK_RESTORED_EVENT } from "./networkError";
import {
  clearLoginNotice,
  holdLoginNoticeUntilReload,
  peekLoginNotice,
  peekLoginNoticeDetails,
  rememberLoginNotice,
  resetLoginNoticeHoldForTests,
  type RevokedReason,
} from "./loginNotice";
import { loadAppLocales } from "../i18n";
import { deviceIdHeaders } from "./deviceId";
import { deviceNameHeaders } from "./deviceName";
import { clearPasswordChangeFlag, syncPasswordChangeFlag } from "./passwordChange";

type LoginCredentials = {
  phone_number: string;
  password: string;
};

type LoginResponse = {
  accessToken: string;
  accessTokenExpiresAt?: number | null;
  refreshTokenExpiresAt?: number | null;
  refreshTokenWarnAt?: number | null;
  access_token_expires_at?: number | null;
  refresh_token_expires_at?: number | null;
  refresh_token_warn_at?: number | null;
};

type RefreshResponse = {
  accessToken: string;
  accessTokenExpiresAt?: number | null;
  refreshTokenExpiresAt?: number | null;
  refreshTokenWarnAt?: number | null;
  access_token_expires_at?: number | null;
  refresh_token_expires_at?: number | null;
  refresh_token_warn_at?: number | null;
};

type AuthenticatedUser = User & {
  region?: {
    name?: string;
  };
};

/** Bootstrap (profil, token yangilash) tezroq taslim bo'lsin — 15 s. */
export const AUTH_TIMEOUT_MS = 15_000;

export const authClient = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  timeout: AUTH_TIMEOUT_MS,
  headers: {
    "Content-Type": "application/json",
  },
});

let initPromise: Promise<void> | null = null;
const LOGOUT_SKIP_REFRESH_KEY = "elchi_skip_refresh_once";
const LOGOUT_SKIP_REFRESH_MS = 10_000;

const markLogoutSkipRefresh = () => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(LOGOUT_SKIP_REFRESH_KEY, String(Date.now()));
  } catch {
    // Ignore storage failures and continue logout flow.
  }
};

const shouldSkipRefreshAfterLogout = () => {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const logoutAt = Number(window.sessionStorage.getItem(LOGOUT_SKIP_REFRESH_KEY));
    const shouldSkip = Number.isFinite(logoutAt) && Date.now() - logoutAt < LOGOUT_SKIP_REFRESH_MS;

    if (!shouldSkip) {
      window.sessionStorage.removeItem(LOGOUT_SKIP_REFRESH_KEY);
    }

    return shouldSkip;
  } catch {
    return false;
  }
};

const syncUserContext = (user: AuthenticatedUser) => {
  tokenStorage.setAuthIdentity({ id: user.id, role: user.role });
  store.dispatch(setProfile(user));
  store.dispatch(setRole(user.role));
  store.dispatch(setId(user.id));
  store.dispatch(setName(user.name));

  if (user.region?.name) {
    store.dispatch(setRegion(user.region.name));
  }
};

const resetClientAuthState = () => {
  tokenStorage.clear();
  clearPasswordChangeFlag();
  store.dispatch(logoutAction());
  store.dispatch(removeRole());
  store.dispatch(setError(null));

  if (typeof window !== "undefined") {
    window.localStorage.removeItem("name");
    window.localStorage.removeItem("region");
    clearStoredUiPreferences();
  }
};

const persistSessionMetadata = (response: LoginResponse | RefreshResponse) => {
  tokenStorage.setSessionMetadata({
    accessTokenExpiresAt: response.accessTokenExpiresAt ?? response.access_token_expires_at ?? null,
    refreshTokenExpiresAt: response.refreshTokenExpiresAt ?? response.refresh_token_expires_at ?? null,
    refreshTokenWarnAt: response.refreshTokenWarnAt ?? response.refresh_token_warn_at ?? null,
  });
};

/**
 * Yagona profil keshi (z87E6tdQ): `AuthBootstrap` ilovaning `QueryClient` ini bog'laydi — profil `useSettings` va
 * `useGetMyProfile` bilan bitta kesh kaliti orqali olinadi: parallel so'rovlar bitta, javob ularga ham yoziladi.
 */
let profileCache: QueryClient | null = null;

export const bindProfileCache = (client: QueryClient | null) => {
  profileCache = client;
};

const requestMyProfile = (accessToken: string) =>
  authClient
    .get<{ data?: AuthenticatedUser }>(API_ENDPOINTS.AUTH.MY_PROFILE, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    .then((response) => response.data);

export const fetchMyProfile = async (accessToken?: string) => {
  const resolvedAccessToken = accessToken ?? tokenStorage.getAccessToken();

  if (!resolvedAccessToken) {
    throw new Error("Access token is missing");
  }

  // Har chaqiruv yangi javob oladi (`staleTime: 0`); qayta urinish va xato xabari — chaqiruvchida.
  const body = profileCache
    ? await profileCache.fetchQuery({
        queryKey: queryKeys.myProfile,
        queryFn: () => requestMyProfile(resolvedAccessToken),
        staleTime: 0,
        retry: false,
        meta: { silentError: true },
      })
    : await requestMyProfile(resolvedAccessToken);

  const user = body?.data;

  if (!user) {
    throw new Error("Profile payload is missing");
  }

  syncUserContext(user);
  return user;
};

/** Bootstrap'da profil so'rovi tarmoq sababli yiqilsa — 1 s va 3 s dan keyin qayta urinish. */
export const PROFILE_RETRY_DELAYS_MS = [1_000, 3_000];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchMyProfileWithRetry = async (accessToken?: string) => {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fetchMyProfile(accessToken);
    } catch (error) {
      if (!isNetworkFailure(error) || attempt >= PROFILE_RETRY_DELAYS_MS.length) throw error;
      await wait(PROFILE_RETRY_DELAYS_MS[attempt]);
    }
  }
};

/**
 * Sessiya faqat server "ruxsat yo'q" desa (401/403) yoki holat buzilgan bo'lsa
 * tozalanadi. Tarmoq uzilishi, vaqt tugashi yoki 5xx — foydalanuvchining
 * aybi emas: token saqlanadi, aks holda liftda F5 bosgan kuryer parolni
 * qaytadan terardi (9w5Fq94s). 429 (so'rov cheklovi) ham shu qatorda —
 * fix3 RBAC-11 / C10.
 */
const shouldKeepSessionOnError = (error: unknown) => isTransientAuthFailure(error);

/** Server javob bergan vaqtinchalik xatodan (429/5xx) keyin bootstrap qayta urinishi. */
export const AUTH_REINIT_DELAY_MS = 30_000;
let reinitTimer: ReturnType<typeof setTimeout> | null = null;

const keepSessionWhileOffline = (error: unknown) => {
  // Profil kelmadi — oxirgi ma'lum rol bilan ilova ochiladi, so'rovlar tarmoq
  // qaytgach (refetchOnReconnect) o'zi tiklanadi, profil ham qayta olinadi.
  // Tab identifikatori yo'q (cookie bilan tiklangan yangi tab) — token'dagi rol/id (h0AM0kDL).
  const stored = tokenStorage.getAuthIdentity();
  const fromToken = stored.role ? null : tokenStorage.getTokenIdentity();
  const id = stored.id ?? fromToken?.id;
  const role = stored.role ?? fromToken?.role;
  if (role) store.dispatch(setRole(role));
  if (id) store.dispatch(setId(id));
  if (axios.isAxiosError(error)) emitNetworkError(error);
  if (typeof window === "undefined") return;

  if (isNetworkFailure(error)) {
    // Aloqa qaytdi: brauzer `online` yoki (Wi-Fi bor, internet yo'q holatida `online` kelmaydi) uzilishdan keyingi
    // birinchi javob — `elchi:network-restored` (G6F68ti6, 3/10-bandlar). Qaysi biri oldin kelsa, bir marta; profil
    // orqa fonda olinadi — ilova yuklanish ekrani ostiga yashirilmaydi (rol tiklangan, sahifa ishlab turibdi).
    const retry = () => {
      window.removeEventListener("online", retry);
      window.removeEventListener(NETWORK_RESTORED_EVENT, retry);
      void initAuth({ background: true });
    };
    window.addEventListener("online", retry);
    window.addEventListener(NETWORK_RESTORED_EVENT, retry);
    return;
  }

  // 429/5xx — "online" hodisasi kelmaydi (tarmoq bor). Bitta kechiktirilgan
  // qayta urinish: cheklov oynasi o'tgach profil o'zi tiklanadi.
  if (reinitTimer) clearTimeout(reinitTimer);
  reinitTimer = setTimeout(() => {
    reinitTimer = null;
    void initAuth({ background: true });
  }, AUTH_REINIT_DELAY_MS);
};

/**
 * POST /auth/refresh qayta urinishlari (fix3 RBAC-11 / C10): 429 yoki 5xx
 * kelsa 1 s, 3 s, 7 s (+ tasodifiy 0–0.5 s) kutib, KO'PI BILAN 3 marta qayta
 * so'raladi. Tasodifiy qo'shimcha — bitta NAT ortidagi qurilmalar bir xil
 * soniyada qayta urinmasligi uchun. 429 so'rov cheklovchida, handlerdan OLDIN
 * qaytadi, shuning uchun qayta yuborish xavfsiz. Tarmoq xatosida qayta
 * urinilmaydi (har biri 15 s kutardi) — u baribir vaqtinchalik hisoblanadi.
 */
export const REFRESH_RETRY_DELAYS_MS = [1_000, 3_000, 7_000];

/**
 * Sessiya qurilmasi sarlavhalari (Elchi Pochta #3): `X-Device-Id` (shu brauzer) va `X-Device-Name` (aniq nom —
 * «Samsung SM-A515F · Android 13 · Chrome 155»; saqlangan yoki User-Agent'dan, so'rov uni kutmaydi).
 */
const deviceHeaders = (): Record<string, string> => ({ ...deviceIdHeaders(), ...deviceNameHeaders() });
const REFRESH_RETRY_JITTER_MS = 500;

const isRetryableRefreshError = (error: unknown) => {
  if (!axios.isAxiosError(error) || !error.response) return false;
  const status = error.response.status;
  return status === 429 || status >= 500;
};

const postRefreshWithRetry = async () => {
  for (let attempt = 0; ; attempt += 1) {
    try {
      // `X-Device-Id` / `X-Device-Name` — sessiya qurilmasi (deploy'dan oldingi sessiya birinchi refresh'da shu
      // bilan yoziladi; nom o'zgarsa — yangilanadi).
      return await authClient.post<RefreshResponse>(API_ENDPOINTS.AUTH.REFRESH, {}, { headers: deviceHeaders() });
    } catch (error) {
      if (!isRetryableRefreshError(error) || attempt >= REFRESH_RETRY_DELAYS_MS.length) throw error;
      await wait(REFRESH_RETRY_DELAYS_MS[attempt] + Math.floor(Math.random() * REFRESH_RETRY_JITTER_MS));
    }
  }
};

export const refreshAccessToken = async () => {
  const response = await postRefreshWithRetry();
  const nextAccessToken = response.data?.accessToken;

  if (!nextAccessToken) {
    throw new Error("Refresh response does not include accessToken");
  }

  if (!tokenStorage.tokenMatchesCurrentSession(nextAccessToken)) {
    throw new Error("Refreshed token belongs to another browser tab session");
  }

  tokenStorage.setAccessToken(nextAccessToken);
  persistSessionMetadata(response.data);
  // NDmZMzCP: `must_change_password` — «Yangi parol o'rnating» oynasi (parol almashgach refresh `false` beradi).
  syncPasswordChangeFlag(response.data);
  store.dispatch(loginSuccess({ accessToken: nextAccessToken }));

  return nextAccessToken;
};

/**
 * POST /auth/login qayta urinishi (h0AM0kDL): FAQAT darhol uzilishda (`ERR_NETWORK` — so'rov serverga yetmadi:
 * Wi-Fi ↔ mobil almashuvi, tunnel/Cloudflare uzilishi) bir marta, 400–800 ms dan keyin. Vaqt tugashi
 * (`ECONNABORTED`, 15 s) qayta urinilmaydi — foydalanuvchi yana 15 s kutib qolmasin; server javobi (4xx/5xx) ham.
 */
export const LOGIN_RETRY_DELAY_MS = 400;
export const LOGIN_RETRY_JITTER_MS = 400;

const isImmediateNetworkError = (error: unknown) =>
  axios.isAxiosError(error) && !error.response && error.code === "ERR_NETWORK";

const postLoginWithRetry = async (credentials: LoginCredentials) => {
  // Elchi Pochta #3: `X-Device-Id` sessiyani shu brauzerga bog'laydi (shu qurilmadagi ochiq sessiya qayta
  // ishlatiladi), `X-Device-Name` — ro'yxatdagi aniq qurilma nomi.
  const send = () => authClient.post<LoginResponse>(API_ENDPOINTS.AUTH.LOGIN, credentials, { headers: deviceHeaders() });
  try {
    return await send();
  } catch (error) {
    if (!isImmediateNetworkError(error)) throw error;
    await wait(LOGIN_RETRY_DELAY_MS + Math.floor(Math.random() * LOGIN_RETRY_JITTER_MS));
    return send();
  }
};

/**
 * Kirishdan keyin profil kelmasa (tarmoq / 429 / 5xx) — profil FONDA qayta so'raladi (h0AM0kDL): shu oraliqlar
 * bilan, internet qaytsa darhol. Bootstrap yuklash ekrani (`appInitializing`) qayta yoqilmaydi.
 */
export const PROFILE_BACKGROUND_DELAYS_MS = [5_000, 15_000, 30_000, 60_000];

const loadProfileInBackground = () => {
  if (typeof window === "undefined") return;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const stop = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    window.removeEventListener("online", run);
  };
  function run() {
    if (timer) clearTimeout(timer);
    timer = null;
    // Chiqildi yoki boshqa foydalanuvchi kirdi — to'xtaydi.
    if (!tokenStorage.getAccessToken()) return stop();
    fetchMyProfile()
      .then(stop)
      .catch((error: unknown) => {
        if (!isTransientAuthFailure(error) || attempt >= PROFILE_BACKGROUND_DELAYS_MS.length) return stop();
        timer = setTimeout(run, PROFILE_BACKGROUND_DELAYS_MS[attempt++]);
      });
  }
  window.addEventListener("online", run);
  timer = setTimeout(run, PROFILE_BACKGROUND_DELAYS_MS[attempt++]);
};

/**
 * Server login'ni QABUL QILGAN, lekin profil kelmadi (javobsiz yoki 429/5xx) — kirish bekor qilinmaydi
 * (h0AM0kDL): rol va id token'dan olinadi, profil fonda so'raladi. Token'da rol bo'lmasa — `false` (eski oqim).
 */
const keepLoginWithoutProfile = (accessToken: string) => {
  const identity = tokenStorage.getTokenIdentity(accessToken);
  if (!identity?.role) return false;
  tokenStorage.setAuthIdentity(identity);
  store.dispatch(setRole(identity.role));
  if (identity.id) store.dispatch(setId(identity.id));
  loadProfileInBackground();
  return true;
};

export const login = async (credentials: LoginCredentials) => {
  // Kirishdan keyingi sahifalar tarjimasi — so'rov bilan parallel (to'g'ridan-to'g'ri `/login` da kechiktirilgan,
  // `src/i18n.ts`). Yuklanmasa kirish to'xtamaydi: kerakli nomlar fazosi chizilishda qayta so'raladi.
  const appLocales = loadAppLocales().catch(() => undefined);
  try {
    const response = await postLoginWithRetry(credentials);
    const accessToken = response.data?.accessToken;

    if (!accessToken) {
      throw new Error("Login response does not include accessToken");
    }

    tokenStorage.setAccessToken(accessToken);
    persistSessionMetadata(response.data);
    syncPasswordChangeFlag(response.data);
    store.dispatch(loginSuccess({ accessToken }));

    let user: AuthenticatedUser | null = null;
    try {
      user = await fetchMyProfileWithRetry(accessToken);
    } catch (error) {
      if (!isTransientAuthFailure(error) || !keepLoginWithoutProfile(accessToken)) throw error;
    }
    await appLocales;
    store.dispatch(setAppInitializing(false));

    return { accessToken, user };
  } catch (error) {
    resetClientAuthState();
    store.dispatch(setAppInitializing(false));
    throw error;
  }
};

type BeforeLogoutHook = (accessToken: string | null) => Promise<unknown>;

const beforeLogoutHooks = new Set<BeforeLogoutHook>();
/** Hooklar logout'ni shundan ortiq ushlab turmaydi. */
export const BEFORE_LOGOUT_TIMEOUT_MS = 4_000;

/**
 * Token BEKOR QILINISHIDAN OLDIN bajariladigan ish (masalan push obunasini
 * serverdan o'chirish — keyin so'rov 401 olardi va umumiy qurilmada keyingi
 * odam avvalgisining xabarlarini olardi). Xatolar yutiladi, kutish cheklangan.
 */
export const registerBeforeLogout = (hook: BeforeLogoutHook) => {
  beforeLogoutHooks.add(hook);
  return () => {
    beforeLogoutHooks.delete(hook);
  };
};

const runBeforeLogoutHooks = async (accessToken: string | null, timeoutMs = BEFORE_LOGOUT_TIMEOUT_MS) => {
  if (!beforeLogoutHooks.size) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    Promise.allSettled([...beforeLogoutHooks].map((hook) => hook(accessToken))),
    new Promise((resolve) => {
      timer = setTimeout(resolve, timeoutMs);
    }),
  ]);
  if (timer) clearTimeout(timer);
};

/**
 * Shu tab o'zi chiqyapti (`logout()` — «Chiqish», sessiya tugadi). Shu payt jonli kanaldan kelgan
 * `auth:session_revoked` (masalan shu tabning `POST auth/logout` i sessiyani yopgani haqida) e'tiborsiz qoladi —
 * aks holda o'z chiqishi «boshqa qurilmadan yopildi» deb ko'rinardi.
 */
let logoutsInFlight = 0;

/** Boshqa qurilmadan yopilgan sessiya uchun majburiy chiqish (bitta; hodisa va ulanish xatosi birga kelsa ham). */
let revokedLogout: Promise<void> | null = null;

/** `logoutRevokedSession` dagi hooklar (push obunasini qurilmadan o'chirish) chegarasi — chiqish kechikmasin. */
export const REVOKED_LOGOUT_HOOKS_TIMEOUT_MS = 1_500;

export const logout = async () => {
  logoutsInFlight += 1;
  markLogoutSkipRefresh();
  if (reinitTimer) {
    clearTimeout(reinitTimer);
    reinitTimer = null;
  }
  const accessToken = tokenStorage.getAccessToken();
  await runBeforeLogoutHooks(accessToken);

  try {
    await authClient.post(API_ENDPOINTS.AUTH.LOGOUT, {}, {
      headers: accessToken
        ? {
            Authorization: `Bearer ${accessToken}`,
          }
        : undefined,
    });
  } catch {
    // Backend logout endpoint may be unavailable in some environments.
  } finally {
    resetClientAuthState();
    store.dispatch(setAppInitializing(false));
    logoutsInFlight = Math.max(0, logoutsInFlight - 1);
  }
};

/** Chiqish sababi: `sessionExpired` — login sahifasida «Sessiya tugadi» ekrani (`common-session-expired`). */
export type LogoutReason = "sessionExpired";

export type LogoutAndRedirectOptions = {
  reason?: LogoutReason;
  /** `sessionExpired`: server sessiyani «Session revoked» deb rad etdi (boshqa qurilmadan yopilgan). */
  revoked?: boolean;
};

/**
 * «Sessiya tugadi» xabarini qoldiradi — `logout()` metama'lumotni tozalashidan OLDIN (tugagan vaqt shundan).
 * Refresh token muddati hali o'tmagan bo'lsa (server sessiyani oldinroq rad etdi) — hozirgi vaqt.
 * `passwordChanged` ustun: parol o'zgargach chiqarilgan foydalanuvchiga o'sha sabab ko'rinadi.
 */
const rememberSessionExpired = (revoked = false, revokedReason: RevokedReason | null = null) => {
  const existing = peekLoginNoticeDetails();
  if (existing?.notice === "passwordChanged") return;
  const now = Date.now();
  const { refreshTokenExpiresAt } = tokenStorage.getSessionMetadata();
  const at = refreshTokenExpiresAt && refreshTokenExpiresAt <= now ? refreshTokenExpiresAt : now;
  // Bir vaqtdagi bir nechta chaqiruv (parallel so'rovlar): `logout()` metama'lumotni tozalagach kelgani
  // birinchisi yozgan haqiqiy tugash vaqtini «hozir» bilan almashtirmasin — eng erta vaqt qoladi.
  if (
    existing?.notice === "sessionExpired" &&
    existing.at &&
    existing.at <= at &&
    (existing.revoked || !revoked) &&
    (!revokedReason || existing.revokedReason === revokedReason)
  ) {
    return;
  }
  const earliest = existing?.notice === "sessionExpired" && existing.at && existing.at <= at ? existing.at : at;
  rememberLoginNotice("sessionExpired", {
    at: earliest,
    revoked: revoked || existing?.revoked === true,
    revokedReason: revokedReason ?? existing?.revokedReason ?? null,
  });
};

/**
 * Chiqish va `/login` ga o'tish. `reason` ixtiyoriy — mavjud chaqiruvchilar o'zgarmaydi.
 *   - `{ reason: "sessionExpired" }` — sessiya tugadi (taymer, token yangilanmadi): login sahifasida «Sessiya
 *     tugadi» ekrani;
 *   - sababsiz (profil menyusidagi «Chiqish», parol o'zgargach) — oddiy kirish formasi; qolib ketgan «Sessiya
 *     tugadi» xabari o'chiriladi, `passwordChanged` saqlanadi.
 * Xabar sahifa qayta yuklanguncha o'chirilmaydi (`holdLoginNoticeUntilReload`).
 */
export const logoutAndRedirect = async (options: LogoutAndRedirectOptions = {}) => {
  // Sessiya jonli kanal orqali allaqachon yopildi (`logoutRevokedSession`) — o'sha chiqish kutiladi: yopilgan
  // sessiya uchun `POST auth/logout` (yana 401) va ikkinchi yo'naltirish yo'q.
  if (revokedLogout) return revokedLogout;
  if (options?.reason === "sessionExpired") {
    rememberSessionExpired(options.revoked === true);
  } else if (peekLoginNotice() === "sessionExpired") {
    clearLoginNotice();
  }
  // `logout()` holatni tozalagach React `/login` ga o'zi o'tadi; kirish sahifasi xabarni o'qib o'chirib qo'ysa,
  // `location.replace` dan keyingi yangi hujjat sababni ko'rmasdi — xabar qayta yuklanguncha ushlab turiladi.
  holdLoginNoticeUntilReload();
  await logout();
  window.location.replace("/login");
};

/**
 * Sessiya BOSHQA qurilmadan yopildi (Elchi Pochta #3: «Chiqarish», «Boshqa barcha qurilmalardan chiqish», parol
 * almashishi, admin parolni tiklashi, shu brauzerning boshqa tabida «Chiqish») — jonli kanal `auth:session_revoked`
 * (yoki yopilgan sessiya tokeni bilan ulanish rad etildi). Qurilma joyida chiqadi, keyingi HTTP so'rovni kutmaydi:
 *   - `POST auth/logout` YO'Q (sessiya serverda allaqachon yopilgan — ortiqcha 401 va aylanma bo'lmasin);
 *   - xabar — «Sessiya tugadi» ekrani, sababi bilan (`revoked`; `password_changed` — «Parol almashtirildi»);
 *     xabar sahifa qayta yuklanguncha o'chirilmaydi (`holdLoginNoticeUntilReload`);
 *   - token, sessiya metama'lumoti, rol tozalanadi (React o'zi `/login` ga o'tadi, socket uziladi), so'ng push
 *     obunasi qurilmadan o'chiriladi (hooklar `null` token bilan — serverga so'rov yo'q, ko'pi bilan 1,5 s) va
 *     `location.replace("/login")` — so'rovlar keshi va modul holati ham tozalanadi; qayta yuklangach token
 *     yangilanmaydi (`markLogoutSkipRefresh`).
 * Bir marta: takroriy chaqiruv o'sha va'dani qaytaradi; shu tab o'zi chiqayotgan bo'lsa (`logout()`) — `null`
 * (hodisa e'tiborsiz).
 */
export const logoutRevokedSession = (reason: RevokedReason | null = null): Promise<void> | null => {
  if (revokedLogout) return revokedLogout;
  if (logoutsInFlight > 0) return null;

  revokedLogout = (async () => {
    markLogoutSkipRefresh();
    if (reinitTimer) {
      clearTimeout(reinitTimer);
      reinitTimer = null;
    }
    rememberSessionExpired(true, reason);
    holdLoginNoticeUntilReload();
    resetClientAuthState();
    store.dispatch(setAppInitializing(false));
    await runBeforeLogoutHooks(null, REVOKED_LOGOUT_HOOKS_TIMEOUT_MS);
    window.location.replace("/login");
  })();
  return revokedLogout;
};

/** Testlar uchun: modul holati (majburiy chiqish, xabarni ushlash) boshlang'ich holatga. */
export const resetRevokedLogoutForTests = () => {
  revokedLogout = null;
  logoutsInFlight = 0;
  resetLoginNoticeHoldForTests();
};

/**
 * Token yo'q ochilishda refresh cookie bilan tiklash (h0AM0kDL) — `/login` (foydalanuvchi ataylab kirish
 * sahifasini ochgan: boshqa hisob bilan kirishi mumkin) va Telegram Mini App (`/tg/…` — o'z `init_data`
 * kirishi bor) dan TASHQARI. Chiqishdan keyingi 10 s (`elchi_skip_refresh_once`) yuqorida alohida tekshiriladi.
 */
const shouldRestoreSessionFromCookie = () => {
  if (typeof window === "undefined") return false;
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  return path !== "/login" && path !== "/tg" && !path.startsWith("/tg/");
};

export type InitAuthOptions = {
  /**
   * Aloqa qaytgandan keyingi qayta urinish (G6F68ti6, 10-band): rol saqlangan bo'lsa yuklanish ekrani
   * (`setAppInitializing`) ko'rsatilmaydi — foydalanuvchi ochiq sahifada ishlashda davom etadi.
   */
  background?: boolean;
};

export const initAuth = async (options: InitAuthOptions = {}) => {
  if (initPromise) {
    return initPromise;
  }
  const showLoader = () => {
    if (options.background && store.getState().role.role) return;
    store.dispatch(setAppInitializing(true));
  };

  initPromise = (async () => {
    // Sessiyali ochilish: tarjimalarning qolgan qismi ham chizishdan oldin (to'g'ridan-to'g'ri `/login` da ham —
    // undan `/` ga o'tiladi; `src/i18n.ts`, rzzxMItN). Yuklanmasa — chizishda qayta so'raladi.
    let appLocales: Promise<unknown> = Promise.resolve();
    try {
      if (shouldSkipRefreshAfterLogout()) {
        resetClientAuthState();
        return;
      }

      let accessToken = tokenStorage.getAccessToken();

      if (!accessToken) {
        // Yangi tab / telefon tashrifi (token sessionStorage'da — tabga xos): refresh cookie bilan sessiya
        // tiklanadi, har tashrifda qayta kirish talab qilinmaydi (h0AM0kDL). Cookie yo'q/yaroqsiz yoki tarmoq
        // yo'q — jim, kirish sahifasi (xato xabarisiz).
        if (!shouldRestoreSessionFromCookie()) {
          resetClientAuthState();
          return;
        }
        showLoader();
        appLocales = loadAppLocales().catch(() => undefined);
        try {
          accessToken = await refreshAccessToken();
        } catch {
          resetClientAuthState();
          return;
        }
      } else {
        showLoader();
        appLocales = loadAppLocales().catch(() => undefined);
      }

      const { accessTokenExpiresAt } = tokenStorage.getSessionMetadata();
      if (accessTokenExpiresAt && Date.now() >= accessTokenExpiresAt) {
        accessToken = await refreshAccessToken();
      }

      try {
        await fetchMyProfileWithRetry(accessToken);
      } catch (error) {
        // Profile bootstrap uses the interceptor-free auth client. If an older
        // session has no expiry metadata, recover once from a server-side 401
        // instead of discarding a still-valid refresh cookie.
        if (!axios.isAxiosError(error) || error.response?.status !== 401) {
          throw error;
        }

        accessToken = await refreshAccessToken();
        await fetchMyProfile(accessToken);
      }
    } catch (error) {
      if (shouldKeepSessionOnError(error)) {
        keepSessionWhileOffline(error);
        return;
      }
      resetClientAuthState();
    } finally {
      await appLocales;
      store.dispatch(setAppInitializing(false));
      initPromise = null;
    }
  })();

  return initPromise;
};

export default {
  login,
  logout,
  logoutAndRedirect,
  initAuth,
  refreshAccessToken,
  fetchMyProfile,
};
