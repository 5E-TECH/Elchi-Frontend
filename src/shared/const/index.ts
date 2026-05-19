const rawBaseUrl = import.meta.env.VITE_BASE_URL?.trim();
const isHttpsPage =
  typeof window !== "undefined" && window.location.protocol === "https:";
const isInsecureHttpApi = Boolean(rawBaseUrl?.startsWith("http://"));

// Production backend, served via Cloudflare Tunnel over HTTPS. Used when
// VITE_BASE_URL is unset (the production build has no local .env) or points
// to an http:// API on an https page — browsers block such mixed-content calls.
const PROD_API_URL = "https://api.elchipochta.uz";

export const BASE_URL =
  !rawBaseUrl || (isHttpsPage && isInsecureHttpApi)
    ? PROD_API_URL
    : rawBaseUrl.replace(/\/+$/, "");

export const DEBUG_MODE = import.meta.env.VITE_DEBUG === "true";
