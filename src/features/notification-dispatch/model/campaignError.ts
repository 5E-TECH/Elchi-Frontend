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

/** Backend matni — faqat SMS sababini TANISH uchun o'qiladi (foydalanuvchiga ko'rsatilmaydi). */
const backendMessage = (error: unknown): string => {
  const data = (error as { response?: { data?: { message?: unknown; error?: unknown } } } | null)?.response?.data;
  const message = data?.message ?? data?.error;
  if (Array.isArray(message)) return message.map(String).join(" ");
  return typeof message === "string" ? message : "";
};

/**
 * SMS kanalli kampaniya rad etildi (KM-5, 9D1Gl9MS) — backend `campaign.service.ts`:
 *   - 409 `(sms_disabled)` — SMS o'chiq yoki sozlanmagan;
 *   - 409 `(opt_out_not_configured)` — reklama SMS uchun bekor qilish havolasi sozlanmagan;
 *   - 400 `SMS_MAX_FANOUT` — auditoriya SMS chegarasidan katta (jimgina kesilmaydi).
 * Matn kelmasa ham (gateway faqat holatni qoldirsa) — SMS so'ralgan va preview'da sabab bor bo'lsa o'shandan.
 */
const classifySmsError = (
  status: number,
  message: string,
  sms: CampaignErrorPreview["sms"],
): CampaignErrorKind | null => {
  if (status === 409) {
    if (/opt_out_not_configured|SMS_OPT_OUT/i.test(message) || (sms && sms.smsEnabled && !sms.optOutConfigured)) {
      return { kind: "error", messageKey: "campaign.createError.smsOptOut" };
    }
    if (/sms_disabled|SMS_ENABLED/i.test(message) || (sms && !sms.smsEnabled)) {
      return { kind: "error", messageKey: "campaign.createError.smsDisabled" };
    }
    return null;
  }
  if (status === 400 || status === 422) {
    const fanout = /SMS_MAX_FANOUT/i.test(message);
    if (!fanout && !sms?.fanoutExceeded) return null;
    const match = /(\d+)\D+?chegara\D*(\d+)/i.exec(message);
    const total = match ? Number(match[1]) : null;
    const max = match ? Number(match[2]) : (sms?.maxFanout ?? null);
    return max !== null && Number.isFinite(max)
      ? {
          kind: "error",
          messageKey: "campaign.createError.smsFanout",
          values: total !== null && Number.isFinite(total) ? { total, max } : { max },
        }
      : { kind: "error", messageKey: "campaign.createError.smsFanoutUnknown" };
  }
  return null;
};

/** Tasdiq paytidagi (yoki 400 dan keyin qayta sanalgan) son va chegara; SMS so'ralgan bo'lsa — `sms` bloki. */
export type CampaignErrorPreview = {
  total: number;
  campaignMax: number | null;
  /** `undefined` — SMS so'ralmagan; `null` — so'ralgan, lekin backend blok qaytarmagan. */
  sms?: { smsEnabled: boolean; optOutConfigured: boolean; fanoutExceeded: boolean; maxFanout: number | null } | null;
};

export const classifyCampaignError = (
  error: unknown,
  preview?: CampaignErrorPreview | null,
): CampaignErrorKind => {
  const status = getErrorStatus(error);
  if (!status || status >= 502) return { kind: "unknown" };
  const message = backendMessage(error);
  const smsKind =
    preview?.sms !== undefined || /sms/i.test(message) ? classifySmsError(status, message, preview?.sms ?? null) : null;
  if (smsKind) return smsKind;
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
