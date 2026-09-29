import type { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from "axios";
import tokenStorage from "./tokenStorage";
import { logoutAndRedirect, refreshAccessToken } from "./authService";
import { emitNetworkError } from "./networkError";

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

let refreshPromise: Promise<string> | null = null;

const getRefreshedAccessToken = () => {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
};

const hasRefreshTokenExpired = () => {
  const { refreshTokenExpiresAt } = tokenStorage.getSessionMetadata();
  return Boolean(refreshTokenExpiresAt && Date.now() >= refreshTokenExpiresAt);
};

const shouldAttemptRefresh = (error: AxiosError) => {
  const status = error.response?.status;
  const requestConfig = error.config as RetryableRequestConfig | undefined;
  const requestUrl = requestConfig?.url ?? "";

  if (status !== 401 || !requestConfig || requestConfig._retry) {
    return false;
  }

  if (!tokenStorage.getAccessToken()) {
    return false;
  }

  return !requestUrl.includes("/auth/login") && !requestUrl.includes("/auth/refresh");
};

// ⚠️ Foydalanuvchi o'zi bekor qilgan so'rov (AbortController) ham `response`
// siz keladi — u tarmoq xatosi EMAS, "tarmoq xatosi" toast'i chiqmasin.
export const setupAuthInterceptors = (api: AxiosInstance) => {
  api.interceptors.request.use(async (config) => {
    if (hasRefreshTokenExpired()) {
      await logoutAndRedirect();
      return Promise.reject(new Error("Refresh token expired"));
    }

    let accessToken = tokenStorage.getAccessToken();
    const { accessTokenExpiresAt } = tokenStorage.getSessionMetadata();

    if (accessToken && accessTokenExpiresAt && Date.now() >= accessTokenExpiresAt) {
      try {
        accessToken = await getRefreshedAccessToken();
      } catch (refreshError) {
        await logoutAndRedirect();
        return Promise.reject(refreshError);
      }
    }

    if (accessToken) {
      config.headers = config.headers ?? {};
      (config.headers as Record<string, string>).Authorization = `Bearer ${accessToken}`;
    }

    return config;
  });

  api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      emitNetworkError(error);

      if (!shouldAttemptRefresh(error)) {
        return Promise.reject(error);
      }

      const originalRequest = error.config as RetryableRequestConfig;
      originalRequest._retry = true;

      try {
        if (hasRefreshTokenExpired()) {
          throw new Error("Refresh token expired");
        }

        const nextAccessToken = await getRefreshedAccessToken();
        originalRequest.headers = originalRequest.headers ?? {};
        (originalRequest.headers as Record<string, string>).Authorization = `Bearer ${nextAccessToken}`;

        return api(originalRequest);
      } catch (refreshError) {
        await logoutAndRedirect();
        return Promise.reject(refreshError);
      }
    },
  );
};

export default setupAuthInterceptors;
