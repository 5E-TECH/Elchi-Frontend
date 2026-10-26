// dizayn-v2: superadmin-notifications-sms-campaign-segment
import { useId } from "react";
import { CircleX, RotateCw, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  isRetryableSmsCampaignError,
  type SmsCampaignErrorKind,
  type SmsCampaignPreview,
  type SmsDailyQuota,
} from "../../../../entities/sms";
import { cx } from "../../../../shared/lib/cx";
import { formatNumberLocalized } from "../../../../shared/lib/formatMoney";
import { Button, Spinner } from "../../../../shared/ui/primitives";

/**
 * Jonli auditoriya holati:
 *  - `loading` — filtr o'zgardi yoki so'rov ketmoqda (oldingi son xira ko'rinadi);
 *  - `error` — hisoblab bo'lmadi: tarmoq / server (`timeout`, `unknown`) — «Qayta urinish»; so'rov yoki sozlama
 *    xatosi (`badRequest` 400, `conflict` 409 — masalan opt-out havolasi sozlanmagan, `forbidden`) — sababi i18n
 *    matnda, qayta urinish tugmasi yo'q (natija o'zgarmaydi);
 *  - `fanout` — bitta kampaniya chegarasidan ko'p;
 *  - `empty` — mos mijoz yo'q;
 *  - `limit` — bugungi SMS limiti yetmaydi;
 *  - `ready` — ko'rib chiqishga tayyor.
 */
export type CampaignAudienceState = "loading" | "error" | "fanout" | "empty" | "limit" | "ready";

export type CampaignAudienceSummaryProps = {
  state: CampaignAudienceState;
  /** So'nggi natija (yuklanayotganda — oldingisi). */
  data: SmsCampaignPreview | undefined;
  /** Bugungi kvota (`GET sms/status`); noma'lum — limit qatori chizilmaydi. */
  quota: SmsDailyQuota | null;
  /** `error` holatida — `smsCampaignErrorKind(error)`; berilmasa `unknown`. */
  errorKind?: SmsCampaignErrorKind;
  /** (sdNGqCBa) Aniq sabab (teskari oraliq, xodimli / o'chirilgan saqlangan segment) — umumiy matn o'rniga. */
  errorText?: string;
  onRetry: () => void;
};

/**
 * «AUDITORIYA» BLOKI — maket `superadmin-notifications-sms-campaign-segment` (o'ng ustun pastida, `sunken`):
 * «Auditoriya: 386 ta» + kimga yuborilmaydi; chiziq ostida «SMS limiti · Bugun qolgan: 420 / 500», «Kerak: 386 ta»
 * va bugungi sarf chizig'i (KM-S4). Limit yetmasa — son va chiziq qizil, izoh bilan. «Segmentni saqlash» va
 * saqlangan segmentlar — «Taklif · backend kerak», chizilmaydi.
 */
export const CampaignAudienceSummary = ({
  state,
  data,
  quota,
  errorKind = "unknown",
  errorText,
  onRetry,
}: CampaignAudienceSummaryProps) => {
  const { t, i18n } = useTranslation("sms");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const quotaLabelId = useId();
  const num = (value: number) => formatNumberLocalized(value, { language });

  const loading = state === "loading";
  const recipients = data?.recipients ?? 0;
  const blocked = data?.blocked_no_consent ?? 0;
  const invalid = data?.skipped_invalid_phone ?? 0;

  let title: string;
  let detail: string | null = null;
  const retryable = isRetryableSmsCampaignError(errorKind);
  if (state === "error") {
    title = t("audience.error");
    detail = errorText ?? (retryable ? t("audience.errorHint") : t(`campaign.errors.${errorKind}`));
  } else if (loading && !data) {
    title = t("audience.loading");
  } else if (state === "fanout") {
    title = t("audience.fanout");
    detail = t("audience.fanoutHint", { max: num(data?.max_fanout ?? 0) });
  } else if (state === "empty") {
    title = t("audience.title", { value: num(0) });
    detail = t("audience.emptyHint");
  } else {
    title = t("audience.title", { value: num(recipients) });
    detail =
      blocked && invalid
        ? t("audience.excludedBoth", { blocked: num(blocked), invalid: num(invalid) })
        : blocked
          ? t("audience.excludedConsent", { blocked: num(blocked) })
          : invalid
            ? t("audience.excludedInvalid", { invalid: num(invalid) })
            : null;
  }

  const showQuota = quota !== null && state !== "error";
  const exceeded = state === "limit";
  const usedPercent = quota ? Math.min(100, Math.round((quota.used / quota.cap) * 100)) : 0;
  const danger = state === "error" || state === "fanout";

  return (
    <div
      data-testid="campaign-audience"
      data-state={state}
      aria-live="polite"
      aria-busy={loading || undefined}
      className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-3 rounded-xl bg-sunken px-4 py-3"
    >
      <div className="flex min-w-0 flex-[1_1_220px] items-center gap-3">
        {state === "error" ? (
          <CircleX aria-hidden="true" size={20} className="shrink-0 text-danger-fg" />
        ) : loading ? (
          <Spinner size="md" className="shrink-0 text-text-muted" />
        ) : (
          <Users aria-hidden="true" size={20} className="shrink-0 text-text-muted" />
        )}
        <div className="flex min-w-0 flex-col gap-0.5">
          <span
            className={cx(
              "text-base font-bold [overflow-wrap:anywhere]",
              danger ? "text-danger-fg" : loading ? "text-text-muted" : "text-text",
            )}
          >
            {title}
          </span>
          {detail ? <span className="text-xs text-text-muted">{detail}</span> : null}
        </div>
      </div>

      {state === "error" && retryable ? (
        <Button variant="secondary" size="sm" leftIcon={RotateCw} onClick={onRetry} className="max-md:w-full">
          {t("audience.retry")}
        </Button>
      ) : null}

      {showQuota && quota ? (
        <div className="flex min-w-0 flex-[1_1_100%] flex-col gap-1.5 border-t border-border pt-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <span id={quotaLabelId} className="text-[13px]">
              <span className="text-text-muted">{t("audience.quotaLabel")}</span>
              <span className="font-semibold text-text">
                {t("audience.quotaRemaining", { left: num(quota.remaining), cap: num(quota.cap) })}
              </span>
            </span>
            {data && !loading && state !== "fanout" ? (
              <span
                className={cx(
                  "text-xs whitespace-nowrap",
                  exceeded ? "font-semibold text-danger-fg" : "text-text-muted",
                )}
              >
                {t("audience.quotaNeed", { value: num(recipients) })}
              </span>
            ) : null}
          </div>
          <div
            role="progressbar"
            aria-labelledby={quotaLabelId}
            aria-valuemin={0}
            aria-valuemax={quota.cap}
            aria-valuenow={Math.min(quota.used, quota.cap)}
            // Izi `bg-border`, CODE-MAP `.el-progress` dagi `bg-sunken` emas: blokning o'zi `bg-sunken` — iz ko'rinmay qolardi.
            className="h-2 overflow-hidden rounded-full bg-border"
          >
            <span
              className={cx("block h-full rounded-full", exceeded ? "bg-danger" : "bg-action")}
              style={{ width: `${usedPercent}%` }}
            />
          </div>
          {exceeded ? (
            <span role="alert" className="text-xs text-danger-fg">
              {t("audience.quotaExceeded", { need: num(recipients), left: num(quota.remaining) })}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default CampaignAudienceSummary;
