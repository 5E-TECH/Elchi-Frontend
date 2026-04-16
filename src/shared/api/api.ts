import axios from "axios";
import { BASE_URL } from "../const";

export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  paramsSerializer: {
    // `status=paid&status=sold` ko'rinishidagi query string saqlanadi.
    indexes: null,
  } as any,
});

api.interceptors.request.use((config) => {
  const token = window.localStorage.getItem("accessToken");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    if (status === 401) {
      window.localStorage.removeItem("accessToken");
      window.location.href = "/login";
    }

    return Promise.reject(error);
  },
);
