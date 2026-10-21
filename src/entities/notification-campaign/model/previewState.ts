import { getErrorStatus } from "../../../shared/lib/errorKind";
import type { AudiencePreview } from "../api/campaignApi";
import type { AudienceGate } from "./audience";

/** Backend partiya hajmi (`CAMPAIGN_BATCH_SIZE`, notification-service `campaign-limits.ts`). */
export const CAMPAIGN_BATCH_SIZE = 200;

/**
 * «Kimga» kartasining pastki bloki (maket `superadmin-notifications-send-states` «Auditoriya hisobi»):
 *   `idle` — konstruktor tayyor emas (tur yoki rol tanlanmagan, teskari oraliq) — blok yo'q;
 *   `needsFilter` — mijoz tanlangan, filtr yo'q («Mijozlar uchun filtr tanlang» + «Filtrsiz»);
 *   `loading` — hisoblanmoqda (nishon o'zgardi yoki so'rov ketmoqda);
 *   `error` — hisoblab bo'lmadi (`badRequest` — 4xx, filtr bo'yicha; aks holda server/tarmoq — «Qayta urinish»);
 *   `empty` — 0 ta; `overCap` — kampaniya chegarasidan katta («Yuborish» o'chiq);
 *   `big` — sinxron chegaradan katta, navbat orqali; `ready` — hisoblandi.
 */
export type AudiencePreviewState =
  "idle" | "needsFilter" | "loading" | "error" | "empty" | "overCap" | "big" | "ready";

export type AudiencePreviewErrorKind = "badRequest" | "unavailable";

export const audiencePreviewErrorKind = (error: unknown): AudiencePreviewErrorKind => {
  const status = getErrorStatus(error);
  return status && status >= 400 && status < 500 && status !== 408 && status !== 429
    ? "badRequest"
    : "unavailable";
};

export const audiencePreviewState = (
  gate: AudienceGate,
  query: {
    current: boolean;
    settled: boolean;
    isError: boolean;
    isFetching: boolean;
    data: AudiencePreview | undefined;
  },
): AudiencePreviewState => {
  if (gate === "needsCustomerFilter") return "needsFilter";
  if (gate !== "ready") return "idle";
  if (query.settled && query.isError && !query.isFetching) return "error";
  if (!query.current || !query.data) return "loading";
  const { total, campaignAllowed, campaignMax, dispatchMax } = query.data;
  if (total === 0) return "empty";
  if (!campaignAllowed || (campaignMax !== null && total > campaignMax)) return "overCap";
  if (dispatchMax !== null && total > dispatchMax) return "big";
  return "ready";
};

/** Shu holatda kampaniya yuborilishi mumkinmi. */
export const canSendAudience = (state: AudiencePreviewState) =>
  state === "ready" || state === "big";
