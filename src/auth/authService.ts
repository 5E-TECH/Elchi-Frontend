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
};

type RefreshResponse = {
  accessToken: string;
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

const syncUserContext = (user: AuthenticatedUser) => {
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
  localStorage.removeItem("name");
  localStorage.removeItem("region");
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

  tokenStorage.setAccessToken(nextAccessToken);
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
  try {
    await authClient.post(API_ENDPOINTS.AUTH.LOGOUT, {});
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
    store.dispatch(setAppInitializing(true));

    try {
      let accessToken = tokenStorage.getAccessToken();

      if (!accessToken) {
        accessToken = await refreshAccessToken();
      }

      await fetchMyProfile(accessToken);
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
