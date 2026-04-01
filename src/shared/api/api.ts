import axios from "axios";
import { BASE_URL } from "../const";

export const api = axios.create({
    baseURL: BASE_URL,
    paramsSerializer: {
        indexes: null  // Creates ?status=paid&status=sold instead of status[0]=paid
    } as any // Cast to any to avoid TS error if types don't match perfectly without qs
})

api.interceptors.request.use((config) => {
    const token = localStorage.getItem("accessToken")

    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

api.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;

        if (status === 401) {
            localStorage.removeItem("accessToken");
            localStorage.removeItem("refreshToken");
            window.location.href = "/login";
        } else if (status === 500 && window.location.pathname !== "/500") {
            window.location.replace("/500");
        }

        return Promise.reject(error);
    }
);
