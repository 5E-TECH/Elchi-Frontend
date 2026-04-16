import axios from "axios";
import { BASE_URL } from "../shared/const";
import { setupAuthInterceptors } from "../auth/setupInterceptors";

export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
  paramsSerializer: {
    indexes: null,
  } as any,
});

setupAuthInterceptors(api);

export default api;
