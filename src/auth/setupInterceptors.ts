import type { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from "axios";
import tokenStorage from "./tokenStorage";
import { logoutAndRedirect, refreshAccessToken } from "./authService";

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

let refreshPromise: Promise<string> | null = null;

const shouldAttemptRefresh = (error: AxiosError) => {
  const status = error.response?.status;
  const requestConfig = error.config as RetryableRequestConfig | undefined;
  const requestUrl = requestConfig?.url ?? "";

  if (status !== 401 || !requestConfig || requestConfig._retry) {
    return false;
  }

  return !requestUrl.includes("/auth/login") && !requestUrl.includes("/auth/refresh");
};

const isNetworkError = (error: AxiosError) =>
  !error.response || error.code === "ERR_NETWORK" || error.code === "ECONNABORTED";

const emitNetworkError = (error: AxiosError) => {
  if (typeof window === "undefined" || !isNetworkError(error)) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent("elchi:network-error", {
      detail: {
        message: error.message,
        url: error.config?.url,
      },
    }),
  );
};

export const setupAuthInterceptors = (api: AxiosInstance) => {
  api.interceptors.request.use((config) => {
    const accessToken = tokenStorage.getAccessToken();

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
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null;
          });
        }

        const nextAccessToken = await refreshPromise;
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
