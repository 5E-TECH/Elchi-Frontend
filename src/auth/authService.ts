import axios from "axios";
import store from "../app/config/store";
import { setId, setName, setRegion, setRole, removeRole } from "../features/auth/model/loginSlice";
import { BASE_URL } from "../shared/const";
import { API_ENDPOINTS } from "../shared/api";
import { loginSuccess, logout as logoutAction, setAppInitializing, setProfile, setError } from "../entities/user/model/slice";
import tokenStorage from "./tokenStorage";
import type { User } from "../entities/user/model/types";

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

const authClient = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
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

export const refreshAccessToken = async () => {
  const response = await authClient.post<RefreshResponse>(API_ENDPOINTS.AUTH.REFRESH, {});
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
        await fetchMyProfile(accessToken);
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
    } catch {
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
