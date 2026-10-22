// dizayn-v2: superadmin-notifications-send-states
import { useEffect, useRef } from "react";
import { CalendarClock, CircleX, Clock, History, Plus, RefreshCw } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import {
  CAMPAIGN_STATUS_META,
  CampaignStatusBadge,
  campaignDisplayStatus,
  isCampaignActive,
  useCampaign,
  useCampaignTime,
  type CampaignCreated,
} from "../../../entities/notification-campaign";
import { DispatchStatusBadge } from "../../../entities/notification-dispatch";
import { NoticeAlert } from "../../../entities/notification";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { Button, Card } from "../../../shared/ui/primitives";
import { CampaignProgressBar } from "./CampaignProgressBar";
import { scrollToCampaignHistory } from "./campaignHistoryAnchor";
import { useCampaignCancel } from "./useCampaignCancel";

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

/**
 * KAMPANIYA PROGRESSI (maket `superadmin-notifications-send-states` «"Yuborish" bosildi — navbatga qo'yildi»):
 * sarlavha + holat belgisi, progress chizig'i, «654 / 1 308 yuborildi», «Har 2–3 soniyada yangilanadi»
 * (`GET campaigns/:id` har 3 s, kampaniya faol ekan), «Kampaniyalar tarixi» (sahifadagi tarix kartasiga), «Bekor
 * qilish» (tasdiq oynasi `useCampaignCancel`; yakunlangan — 409 → xabar va yangilash), «Yangi xabar». Rejalashtirilgan
 * (KM-3) yoki reklama tungi taqiqqa surilgan bo'lsa — qachon yuborilishi (Toshkent vaqti).
 *
 * Javob kelmasa — «Javob kelmadi» + «Qayta urinish» (ayni `Idempotency-Key`, ikkinchi kampaniya yaratilmaydi).
 */
export const CampaignProgressCard = (props: CampaignProgressCardProps) => {
  const { title, onNewMessage } = props;
  const { t, i18n } = useTranslation("notifications");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const num = (value: number) => formatNumberLocalized(value, { language });
  const campaignTime = useCampaignTime();
  const askCancel = useCampaignCancel();
  const rootRef = useRef<HTMLElement>(null);
  const campaignId = props.kind === "created" ? props.created.campaign_id : null;
  const query = useCampaign(campaignId);

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
    : // Yaratish javobida `scheduled_at` faqat kechiktirilganda bor (rejalashtirilgan yoki tungi taqiqqa surilgan).
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

  const onCancel = () => {
    if (!campaignId) return;
    void askCancel(
      {
        id: campaignId,
        title: campaign?.title || title,
        display,
        total,
        sent,
        failed,
        skipped,
        progressPct: pct,
      },
      { onConflict: () => void query.refetch() },
    );
  };

  const extra = [
    failed ? t("campaign.progress.failedCount", { value: num(failed) }) : null,
    skipped ? t("campaign.progress.skippedCount", { value: num(skipped) }) : null,
  ].filter(Boolean);

  return (
    // Karta jonli hudud EMAS: son har 3 s yangilanadi — o'qigich har safar o'qimasin (progressbar qiymati so'ralganda
    // bor). Faqat holat almashuvi (yuborilmoqda → yuborilgan / bekor) alohida doimiy `role="status"` orqali.
    <Card
      ref={rootRef}
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
          <Button
            variant="secondary"
            leftIcon={History}
            onClick={scrollToCampaignHistory}
            className="max-md:h-12"
          >
            {t("campaign.history.title")}
          </Button>
          {canCancel ? (
            <Button
              variant="danger-soft"
              leftIcon={CircleX}
              aria-haspopup="dialog"
              onClick={onCancel}
              className="max-md:h-12"
            >
              {t("campaign.progress.cancel")}
            </Button>
          ) : null}
        </div>
      }
    >
      <span className="sr-only" role="status" data-testid="campaign-status-live">
        {t("campaign.progress.statusLive", { status: t(CAMPAIGN_STATUS_META[display].labelKey) })}
      </span>
      <span className="text-sm font-semibold text-text [overflow-wrap:anywhere]">
        {campaign?.title || title}
      </span>
      {created.duplicate ? (
        <NoticeAlert tone="info">{t("campaign.progress.duplicate")}</NoticeAlert>
      ) : null}
      {display === "scheduled" && scheduledAt ? (
        // Rejalashtirilgan — ko'k (maket `-send-schedule`), tungi taqiq tufayli surilgan — sariq (`-send-states`).
        <NoticeAlert
          tone={created.quiet_hours_shifted ? "warning" : "info"}
          icon={created.quiet_hours_shifted ? Clock : CalendarClock}
          role="status"
        >
          {t(
            created.quiet_hours_shifted
              ? "campaign.progress.quietShifted"
              : "campaign.progress.scheduled",
            { time: campaignTime.format(scheduledAt) ?? "" },
          )}
        </NoticeAlert>
      ) : null}
      <CampaignProgressBar value={pct} label={t("campaign.progress.bar")} />
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
