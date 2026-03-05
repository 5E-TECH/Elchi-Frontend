import axios from "axios";
import { BASE_URL } from "../const";

export const api = axios.create({
    baseURL: BASE_URL,
    headers: {
        "Content-Type": "application/json",
    },
    paramsSerializer: {
        indexes: null
    } as any
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
        }
        //  else if (status === 403) {
        //     window.location.href = "/403";
        // } else if (status === 404) {
        //     window.location.href = "/404";
        // } else if (status === 500) {
        //     window.location.href = "/500";
        // }

        return Promise.reject(error);
    }
);
