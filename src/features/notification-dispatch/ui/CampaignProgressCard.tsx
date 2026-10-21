// dizayn-v2: superadmin-notifications-send-states
import { useEffect, useRef } from "react";
import { Ban, Clock, Plus, RefreshCw } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import {
  CampaignStatusBadge,
  campaignDisplayStatus,
  isCampaignActive,
  useCampaign,
  useCancelCampaign,
  type CampaignCreated,
} from "../../../entities/notification-campaign";
import { DispatchStatusBadge } from "../../../entities/notification-dispatch";
import { NoticeAlert } from "../../../entities/notification";
import { getErrorStatus } from "../../../shared/lib/errorKind";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { notify } from "../../../shared/lib/notify";
import { Button, Card, useConfirm } from "../../../shared/ui/primitives";

export type CampaignProgressCardProps = {
  /** Xabar sarlavhasi (kampaniya javobi kelguncha). */
  title: string;
  onNewMessage: () => void;
} & (
  | { kind: "created"; created: CampaignCreated }
  | {
      /** Javob kelmadi (502–504, tarmoq) — kampaniya yaratilgan bo'lishi mumkin. */
      kind: "unknown";
      retrying: boolean;
      retryError: string | null;
      onRetry: () => void;
    }
);

/** `.el-progress` (CODE-MAP): `h-2 rounded-full bg-sunken` > `bg-action`. */
const ProgressBar = ({ value, label }: { value: number; label: string }) => (
  <div
    role="progressbar"
    aria-label={label}
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={value}
    className="h-2 w-full overflow-hidden rounded-full bg-sunken"
  >
    <span className="block h-full rounded-full bg-action" style={{ width: `${value}%` }} />
  </div>
);

/**
 * KAMPANIYA PROGRESSI (maket `superadmin-notifications-send-states` «"Yuborish" bosildi — navbatga qo'yildi»):
 * sarlavha + holat belgisi, progress chizig'i, «654 / 1 308 yuborildi», «Har 2–3 soniyada yangilanadi»
 * (`GET campaigns/:id` har 3 s, kampaniya faol ekan), «Bekor qilish» (tasdiq bilan; yakunlangan — 409 → xabar va
 * yangilash), «Yangi xabar». Reklama tungi taqiqqa tushsa — qachon yuborilishi. «Kampaniyalar tarixi» havolasi — KM-3.
 *
 * Javob kelmasa — «Javob kelmadi» + «Qayta urinish» (ayni `Idempotency-Key`, ikkinchi kampaniya yaratilmaydi).
 */
export const CampaignProgressCard = (props: CampaignProgressCardProps) => {
  const { title, onNewMessage } = props;
  const { t, i18n } = useTranslation("notifications");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const num = (value: number) => formatNumberLocalized(value, { language });
  const confirm = useConfirm();
  const rootRef = useRef<HTMLElement>(null);
  const campaignId = props.kind === "created" ? props.created.campaign_id : null;
  const query = useCampaign(campaignId);
  const cancel = useCancelCampaign();

  useEffect(() => {
    // Skroll qiluvchi — shell'ning `<main>` i; karta sahifa sarlavhasi ostida — tepaga.
    rootRef.current?.closest("main")?.scrollTo?.({ top: 0, behavior: "smooth" });
  }, []);

  if (props.kind === "unknown") {
    return (
      <Card
        ref={rootRef}
        aria-live="polite"
        title={t("campaign.progress.title")}
        titleAddon={<DispatchStatusBadge status="unknown" />}
        bodyClassName="flex flex-col gap-4"
        data-testid="campaign-progress"
        footer={
          <div className="flex w-full flex-wrap items-center justify-end gap-2 max-md:flex-col-reverse max-md:items-stretch">
            <Button
              variant="ghost"
              leftIcon={Plus}
              disabled={props.retrying}
              onClick={onNewMessage}
              className="mr-auto max-md:mr-0 max-md:h-12"
            >
              {t("dispatch.newMessage")}
            </Button>
            <Button
              leftIcon={RefreshCw}
              loading={props.retrying}
              loadingText={t("campaign.progress.retrying")}
              onClick={props.onRetry}
              className="max-md:h-12"
            >
              {t("campaign.progress.retry")}
            </Button>
          </div>
        }
      >
        <NoticeAlert tone="warning" icon={Clock} title={t("campaign.progress.unknownTitle")}>
          {t("campaign.progress.unknownText")}
        </NoticeAlert>
        {props.retryError ? (
          <NoticeAlert tone="danger" title={t("campaign.progress.retryFailed")}>
            {props.retryError}
          </NoticeAlert>
        ) : null}
      </Card>
    );
  }

  const { created } = props;
  const campaign = query.data;
  const status = campaign?.status ?? created.status ?? "queued";
  const display = campaign
    ? campaignDisplayStatus(campaign)
    : // Yaratish javobida `scheduled_at` faqat kechiktirilganda bor (KM-2 da — reklama tungi taqiqqa surilganda).
      created.scheduled_at
      ? "scheduled"
      : "sending";
  const total = campaign?.total ?? created.total;
  const sent = campaign?.sent ?? 0;
  const failed = campaign?.failed ?? 0;
  const skipped = campaign?.skipped ?? 0;
  const pct = campaign?.progress_pct ?? 0;
  const active = isCampaignActive(status);
  const canCancel = campaign ? campaign.can_cancel : active;
  const scheduledAt = campaign?.scheduled_at ?? created.scheduled_at;

  const askCancel = async () => {
    if (!campaignId) return;
    const remaining = Math.max(0, total - sent - failed - skipped);
    const done = await confirm({
      title: t("campaign.progress.cancelTitle"),
      description: t("campaign.progress.cancelText"),
      confirmLabel: t("campaign.progress.cancelConfirm"),
      cancelLabel: t("campaign.progress.cancelClose"),
      tone: "danger",
      icon: Ban,
      details: remaining
        ? t("campaign.progress.cancelRemaining", { value: num(remaining) })
        : undefined,
      onConfirm: async () => {
        try {
          await cancel.mutateAsync(campaignId);
          notify.success(t("campaign.progress.cancelled"));
        } catch (error) {
          if (getErrorStatus(error) !== 409) throw error;
          // Allaqachon yakunlangan — xabar va yangi holat (oyna yopiladi).
          notify.error(t("campaign.progress.cancelConflict"));
          void query.refetch();
        }
      },
      errorMessage: () => t("campaign.progress.cancelFailed"),
    });
    void done;
  };

  const extra = [
    failed ? t("campaign.progress.failedCount", { value: num(failed) }) : null,
    skipped ? t("campaign.progress.skippedCount", { value: num(skipped) }) : null,
  ].filter(Boolean);

  return (
    <Card
      ref={rootRef}
      aria-live="polite"
      title={t("campaign.progress.title")}
      titleAddon={<CampaignStatusBadge status={display} />}
      bodyClassName="flex flex-col gap-3"
      data-testid="campaign-progress"
      data-status={display}
      footer={
        <div className="flex w-full flex-wrap items-center justify-end gap-2 max-md:flex-col-reverse max-md:items-stretch">
          <Button
            variant="ghost"
            leftIcon={Plus}
            onClick={onNewMessage}
            className="mr-auto max-md:mr-0 max-md:h-12"
          >
            {t("dispatch.newMessage")}
          </Button>
          {canCancel ? (
            <Button
              variant="danger-soft"
              leftIcon={Ban}
              aria-haspopup="dialog"
              onClick={() => void askCancel()}
              className="max-md:h-12"
            >
              {t("campaign.progress.cancel")}
            </Button>
          ) : null}
        </div>
      }
    >
      <span className="text-sm font-semibold text-text [overflow-wrap:anywhere]">
        {campaign?.title || title}
      </span>
      {created.duplicate ? (
        <NoticeAlert tone="info">{t("campaign.progress.duplicate")}</NoticeAlert>
      ) : null}
      {display === "scheduled" && scheduledAt ? (
        <NoticeAlert tone="warning" icon={Clock} role="status">
          {t(
            created.quiet_hours_shifted
              ? "campaign.progress.quietShifted"
              : "campaign.progress.scheduled",
            {
              time: formatDateTimeLocalized(scheduledAt, { language }),
            },
          )}
        </NoticeAlert>
      ) : null}
      <ProgressBar value={pct} label={t("campaign.progress.bar")} />
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-[13px] text-text" data-testid="campaign-counts">
          <Trans
            t={t}
            i18nKey="campaign.progress.counts"
            values={{ sent: num(sent), total: num(total) }}
            components={{ b: <span className="font-semibold" /> }}
          />
          {extra.length ? (
            <span className="text-text-muted">{` · ${extra.join(" · ")}`}</span>
          ) : null}
        </span>
        {active ? (
          <span className="text-xs text-text-muted">{t("campaign.progress.live")}</span>
        ) : null}
      </div>
      {query.isError ? (
        <p className="m-0 text-xs text-text-muted">{t("campaign.progress.loadError")}</p>
      ) : null}
    </Card>
  );
};
