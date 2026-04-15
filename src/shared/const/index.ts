const rawBaseUrl = import.meta.env.VITE_BASE_URL?.trim();
const isHttpsPage =
  typeof window !== "undefined" && window.location.protocol === "https:";
const isInsecureHttpApi = Boolean(rawBaseUrl?.startsWith("http://"));

// On Vercel HTTPS deployments, direct HTTP API calls are blocked by the browser.
// Falling back to the local `/api` path lets Vercel proxy requests to the backend.
export const BASE_URL =
  !rawBaseUrl || (isHttpsPage && isInsecureHttpApi)
    ? "/api"
    : rawBaseUrl.replace(/\/+$/, "");

export const DEBUG_MODE = import.meta.env.VITE_DEBUG === "true";
