const rawBaseUrl = import.meta.env.VITE_BASE_URL?.trim();
const rawPublicApiUrl = import.meta.env.VITE_PUBLIC_API_URL?.trim();
const isHttpsPage =
  typeof window !== "undefined" && window.location.protocol === "https:";
const isInsecureHttpApi = Boolean(rawBaseUrl?.startsWith("http://"));

// Production backend, served via Cloudflare Tunnel over HTTPS. Used when
// VITE_BASE_URL is unset (the production build has no local .env) or points
// to an http:// API on an https page — browsers block such mixed-content calls.
const PROD_API_URL = "https://api.elchipochta.uz";

/**
 * Ilova so'rovlari ketadigan API manzili (oxirida `/` siz). Absolyut (`https://api.elchipochta.uz`) yoki bir domenli
 * (same-origin) nisbiy yo'l `/api` — kabinet Worker'i (`worker/index.ts`) `/api/*` ni API'ga proksi qiladi:
 * CORS preflight yo'q (`.env.staging`).
 */
export const BASE_URL =
  !rawBaseUrl || (isHttpsPage && isInsecureHttpApi)
    ? PROD_API_URL
    : rawBaseUrl.replace(/\/+$/, "");

const absoluteOrigin = (value: string | undefined): string | null => {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

/**
 * API'ning ommaviy (absolyut) origin'i — TASHQI mijozlarga ko'rsatiladigan havolalar uchun (Carrier API «Base URL»,
 * Swagger). `BASE_URL` nisbiy (`/api`) bo'lsa ham tashqi yetkazuvchi kabinet domeniga emas, API hostiga murojaat
 * qiladi: `VITE_PUBLIC_API_URL`, bo'lmasa absolyut `BASE_URL` ning origin'i, bo'lmasa production API.
 */
export const PUBLIC_API_URL = absoluteOrigin(rawPublicApiUrl) ?? absoluteOrigin(BASE_URL) ?? PROD_API_URL;

export const DEBUG_MODE = import.meta.env.VITE_DEBUG === "true";
