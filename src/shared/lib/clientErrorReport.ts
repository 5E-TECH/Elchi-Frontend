import { api } from "../api/api";
import { API_ENDPOINTS } from "../api/endpoints";
import { tokenStorage } from "../../auth/tokenStorage";
import { getRuntimeErrorCode, type RuntimeErrorPayload } from "./runtimeError";

/**
 * FRONTEND XATOLARI JURNALI (QKCeGZ3N, 4-band): xato chegarasi yiqilgan sahifa xatosini backend jurnaliga jim yuboradi
 * (`POST /client-errors`, gateway `client_error` qatori) — prod'da ham ko'rinsin. Faqat kirgan foydalanuvchi; bir xato
 * kodi — sessiyada bir marta; so'rov xatosi (eski backend 404, tarmoq) e'tiborsiz — foydalanuvchiga hech narsa
 * ko'rsatilmaydi. Ishlab chiqishda (`DEV`) yuborilmaydi.
 */
export type ClientErrorScope = "page" | "section" | "app";

const REPORTED_KEY = "elchi_reported_errors";
const LIMITS = { message: 500, path: 300, stack: 4000 } as const;

const clip = (value: string | null | undefined, max: number) => (value ? value.slice(0, max) : undefined);

const readReported = (): string[] => {
  try {
    const raw = window.sessionStorage.getItem(REPORTED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
};

const markReported = (code: string, reported: string[]) => {
  try {
    window.sessionStorage.setItem(REPORTED_KEY, JSON.stringify([...reported, code].slice(-50)));
  } catch {
    // Saqlab bo'lmasa — keyingi safar yana yuboriladi (backend IP bo'yicha cheklaydi).
  }
};

export const reportClientError = (payload: RuntimeErrorPayload, scope: ClientErrorScope) => {
  if (import.meta.env.DEV || typeof window === "undefined") return;
  if (!tokenStorage.getAccessToken()) return;
  const code = getRuntimeErrorCode(payload);
  const reported = readReported();
  if (reported.includes(`${scope}:${code}`)) return;
  markReported(`${scope}:${code}`, reported);

  void api
    .post(
      API_ENDPOINTS.CLIENT_ERRORS,
      {
        code,
        message: clip(payload.message?.trim() || "—", LIMITS.message),
        path: clip(payload.sourcePath || "/", LIMITS.path),
        stack: clip(payload.stack, LIMITS.stack),
        component_stack: clip(payload.componentStack, LIMITS.stack),
        scope,
      },
      { silentNetworkError: true },
    )
    .catch(() => undefined);
};
