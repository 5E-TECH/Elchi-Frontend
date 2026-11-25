import type { HealthcheckResult } from "./healthcheck";

/** Backend `data.reason` (2026-11-25) → `integrations:conn.pingReason.*`. */
const REASONS = ["auth_failed", "auth_rejected", "timeout", "unreachable", "server_error", "endpoint_failed"] as const;

export type HealthReason = (typeof REASONS)[number];

export const readHealthReason = (value: unknown): HealthReason | null =>
  (REASONS as readonly unknown[]).includes(value) ? (value as HealthReason) : null;

type Translate = (key: string, params?: Record<string, unknown>) => string;

/**
 * Yiqilgan sinov matni. Eski backend muvaffaqiyat matnini («integration healthcheck completed») xato bilan
 * birga qaytarardi va u qizil xabar bo'lib chiqardi — `reason` siz javobda xom matn ko'rsatilmaydi.
 */
export const healthcheckErrorText = (result: HealthcheckResult, t: Translate): string => {
  if (result.reason) {
    return t(`conn.pingReason.${result.reason}`, { status: result.status ?? "—" });
  }
  return result.status === null ? t("conn.pingReason.unreachable") : t("conn.pingHttp", { status: result.status });
};
