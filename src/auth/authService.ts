import axios from "axios";
import store from "../app/config/store";
import { setId, setName, setRegion, setRole, removeRole } from "../shared/model/roleSlice";
import { BASE_URL } from "../shared/const";
import { API_ENDPOINTS } from "../shared/api";
import { loginSuccess, logout as logoutAction, setAppInitializing, setProfile, setError } from "../entities/user/model/slice";
import tokenStorage from "./tokenStorage";
import type { User } from "../entities/user/model/types";
import { clearStoredUiPreferences } from "../shared/lib/preferencesStorage";
import { emitNetworkError, isNetworkFailure, isTransientAuthFailure } from "./networkError";

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

export const fetchMyProfile = async (accessToken?: string) => {
  const resolvedAccessToken = accessToken ?? tokenStorage.getAccessToken();

  if (!resolvedAccessToken) {
    throw new Error("Access token is missing");
  }

  const response = await authClient.get<{ data?: AuthenticatedUser }>(API_ENDPOINTS.AUTH.MY_PROFILE, {
    headers: {
      Authorization: `Bearer ${resolvedAccessToken}`,
    },
  });

  const user = response.data?.data;

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
  const { id, role } = tokenStorage.getAuthIdentity();
  if (role) store.dispatch(setRole(role));
  if (id) store.dispatch(setId(id));
  if (axios.isAxiosError(error)) emitNetworkError(error);
  if (typeof window === "undefined") return;

  if (isNetworkFailure(error)) {
    window.addEventListener("online", () => void initAuth(), { once: true });
    return;
  }

  // 429/5xx — "online" hodisasi kelmaydi (tarmoq bor). Bitta kechiktirilgan
  // qayta urinish: cheklov oynasi o'tgach profil o'zi tiklanadi.
  if (reinitTimer) clearTimeout(reinitTimer);
  reinitTimer = setTimeout(() => {
    reinitTimer = null;
    void initAuth();
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
const REFRESH_RETRY_JITTER_MS = 500;

const isRetryableRefreshError = (error: unknown) => {
  if (!axios.isAxiosError(error) || !error.response) return false;
  const status = error.response.status;
  return status === 429 || status >= 500;
};

const postRefreshWithRetry = async () => {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await authClient.post<RefreshResponse>(API_ENDPOINTS.AUTH.REFRESH, {});
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
  store.dispatch(loginSuccess({ accessToken: nextAccessToken }));

  return nextAccessToken;
};

export const login = async (credentials: LoginCredentials) => {
  try {
    const response = await authClient.post<LoginResponse>(API_ENDPOINTS.AUTH.LOGIN, credentials);
    const accessToken = response.data?.accessToken;

    if (!accessToken) {
      throw new Error("Login response does not include accessToken");
    }

    tokenStorage.setAccessToken(accessToken);
    persistSessionMetadata(response.data);
    store.dispatch(loginSuccess({ accessToken }));

    const user = await fetchMyProfile(accessToken);
    store.dispatch(setAppInitializing(false));

    return { accessToken, user };
  } catch (error) {
    resetClientAuthState();
    store.dispatch(setAppInitializing(false));
    throw error;
  }
};

export const logout = async () => {
  markLogoutSkipRefresh();
  if (reinitTimer) {
    clearTimeout(reinitTimer);
    reinitTimer = null;
  }
  const accessToken = tokenStorage.getAccessToken();

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
  }
};

export const logoutAndRedirect = async () => {
  await logout();
  window.location.replace("/login");
};

export const initAuth = async () => {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      if (shouldSkipRefreshAfterLogout()) {
        resetClientAuthState();
        return;
      }

      let accessToken = tokenStorage.getAccessToken();

      if (!accessToken) {
        resetClientAuthState();
        return;
      }

      store.dispatch(setAppInitializing(true));

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
