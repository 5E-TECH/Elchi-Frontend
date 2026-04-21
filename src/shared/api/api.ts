import axios from "axios";
import { BASE_URL } from "../const";
import { setupAuthInterceptors } from "../../auth/setupInterceptors";

export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  paramsSerializer: {
    // `status=paid&status=sold` ko'rinishidagi query string saqlanadi.
    indexes: null,
  } as any,
});

setupAuthInterceptors(api);
