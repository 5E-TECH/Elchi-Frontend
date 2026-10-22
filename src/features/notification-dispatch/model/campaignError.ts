import { getErrorStatus } from "../../../shared/lib/errorKind";

/**
 * Kampaniya yaratish xatosi → foydalanuvchi matni (backend `message` ko'rsatilmaydi — ega S4).
 *
 *   - javobsiz (tarmoq, vaqt tugadi) yoki 502–504 — `unknown`: kampaniya yaratilgan bo'lishi mumkin, «Qayta urinish»
 *     AYNI `Idempotency-Key` bilan (backend ikkinchisini yaratmaydi, mavjudini qaytaradi);
 *   - 400 — so'nggi preview limitlaridan tushunarli matn (0 ta / chegaradan katta), aks holda umumiy rad;
 *   - qolgani — `campaign.createError.*` holat kodi bo'yicha.
 */
export type CampaignErrorKind =
  { kind: "unknown" } | { kind: "error"; messageKey: string; values?: Record<string, number> };

export const classifyCampaignError = (
  error: unknown,
  preview?: { total: number; campaignMax: number | null } | null,
): CampaignErrorKind => {
  const status = getErrorStatus(error);
  if (!status || status >= 502) return { kind: "unknown" };
  if (status === 400 || status === 422) {
    if (preview && preview.total === 0)
      return { kind: "error", messageKey: "campaign.createError.empty" };
    if (preview && preview.campaignMax !== null && preview.total > preview.campaignMax) {
      return {
        kind: "error",
        messageKey: "campaign.createError.overCap",
        values: { total: preview.total, max: preview.campaignMax },
      };
    }
    return { kind: "error", messageKey: "campaign.createError.badRequest" };
  }
  const key =
    status === 403
      ? "forbidden"
      : status === 409
        ? "conflict"
        : status === 429
          ? "tooMany"
          : status >= 500
            ? "server"
            : "generic";
  return { kind: "error", messageKey: `campaign.createError.${key}` };
};
