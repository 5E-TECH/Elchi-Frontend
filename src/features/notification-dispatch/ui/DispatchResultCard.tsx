// dizayn-v2: superadmin-notifications-send-result
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, ChevronRight, ChevronUp, CircleCheck, History, Plus, RefreshCw, Users } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  ChannelBreakdown,
  DispatchStatusBadge,
  UndeliveredList,
  bucketCounts,
  externalChannels,
  useSentDetail,
  type DispatchHistoryStatus,
} from "../../../entities/notification-dispatch";
import { NoticeAlert } from "../../../entities/notification";
import { cx } from "../../../shared/lib/cx";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { Badge, Button, ButtonIcon, Card, Pressable, Skeleton, buttonClasses } from "../../../shared/ui/primitives";
import { useIsPhone } from "../../../shared/ui/primitives/date/useIsPhone";
import type { DispatchResult } from "../api/useDispatchNotification";
import type { DispatchPayload } from "../model/schema";

/** Natija kartasidagi «Yetkazilmaganlar» — darhol, birinchi 5 tasi (ega S1); qolgani tafsilot oynasida. */
export const RESULT_UNDELIVERED_LIMIT = 5;

export type DispatchResultCardProps = {
  result: DispatchResult;
  status: DispatchHistoryStatus;
  /** Yuborilgan so'rov (Telegram nishoni — shaxsiy chat yoki market guruhi). */
  payload: DispatchPayload;
  /** Tarix id'si (`client_request_id`). */
  dispatchId: string;
  sentAt: string;
  onNewMessage: () => void;
  onOpenDetail: () => void;
};

/** Yetkazilmaganlar bor-yo'qligi — kanal kesimidan (ro'yxat so'rovi kelguncha ham). */
const hasUndelivered = (result: DispatchResult) =>
  externalChannels(result.channels, result.channel_status).some((channel) => {
    const buckets = bucketCounts(result.channel_status?.[channel]);
    return buckets.failed + buckets.skipped + buckets.no_provider > 0;
  }) || result.no_provider.length > 0;

/**
 * YUBORISH NATIJASI (maket `*-notifications-send-result`): sarlavha + natija belgisi + vaqt; bir jumlalik xulosa;
 * qabul qiluvchilar · qutiga yozildi · o'chirganlar (`dispatched + skipped_by_preference`); «Kanallar bo'yicha»;
 * «Yetkazilmaganlar» — darhol qo'shimcha so'rov `GET /notifications/sent/:id?limit=5` (yuklanish, xato, bo'sh),
 * «Barcha N tasini ko'rish» → tafsilot oynasi; pastda «Forma qulflandi» + «Yangi xabar».
 * Takror (`duplicate`) — «Avval yuborilgan» xabari va «Tarixdan tekshirish».
 */
export const DispatchResultCard = ({
  result,
  status,
  payload,
  dispatchId,
  sentAt,
  onNewMessage,
  onOpenDetail,
}: DispatchResultCardProps) => {
  const { t, i18n } = useTranslation("notifications");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const count = (value: number) => formatNumberLocalized(value, { language });
  const rootRef = useRef<HTMLElement>(null);
  const listId = useId();
  const [expanded, setExpanded] = useState(true);
  const isPhone = useIsPhone();

  // Jonli: navbatdagi kanallar (Telegram, SMS, push) yakunlanguncha ro'yxat yangilanib turadi — keyingi xatolar ham
  // kartada chiqadi (tafsilot oynasi bilan bir xil, `useSentDetail live`).
  const undelivered = useSentDetail(dispatchId, { page: 1, limit: RESULT_UNDELIVERED_LIMIT }, { live: true });
  const total = undelivered.data?.undelivered.total ?? 0;

  // Karta formadan yuqorida chiqadi (tasdiq tugmasi esa pastda edi) — ko'rinadigan joyga suriladi.
  useEffect(() => {
    // Skroll qiluvchi — shell'ning `<main>` i (oyna aylanmaydi); karta sahifa sarlavhasi ostida — tepaga.
    rootRef.current?.closest("main")?.scrollTo?.({ top: 0, behavior: "smooth" });
  }, []);

  const time = (
    <span className="whitespace-nowrap text-[13px] text-text-muted" data-testid="dispatch-time">
      {formatDateTimeLocalized(sentAt, { language })}
    </span>
  );
  const recipients = result.dispatched + result.skipped_by_preference;
  const queued = externalChannels(result.channels, result.channel_status)
    .filter((channel) => bucketCounts(result.channel_status?.[channel]).queued > 0)
    .map((channel) => t(`dispatch.channel.${channel}`));
  const queuedText =
    queued.length > 1 ? `${queued.slice(0, -1).join(", ")} ${t("dispatch.breakdown.and")} ${queued.at(-1)}` : (queued[0] ?? "");
  const someUndelivered = hasUndelivered(result) || total > 0;

  const summary = (() => {
    if (status === "skipped") return t("dispatch.result.summarySkipped");
    if (status === "inbox_only") return t("dispatch.result.summaryInboxOnly");
    if (queuedText && !someUndelivered) {
      // Maket «Hammasi navbatga qo'yildi — hech kim tushib qolmadi».
      return (
        <Trans
          t={t}
          i18nKey="dispatch.result.summaryInboxQueued"
          count={result.dispatched}
          values={{ value: count(result.dispatched), channels: queuedText }}
          components={{ b: <span className="font-semibold text-text" /> }}
        />
      );
    }
    const tail = queuedText
      ? someUndelivered
        ? t("dispatch.result.tailQueuedUndelivered", { channels: queuedText })
        : t("dispatch.result.tailQueued", { channels: queuedText })
      : someUndelivered
        ? t("dispatch.result.tailUndelivered")
        : "";
    return (
      <>
        <Trans
          t={t}
          i18nKey="dispatch.result.summaryInbox"
          count={result.dispatched}
          values={{ value: count(result.dispatched) }}
          components={{ b: <span className="font-semibold text-text" /> }}
        />
        {tail ? ` ${tail}` : null}
      </>
    );
  })();

  const stats = [
    { key: "recipients", label: t("dispatch.result.statRecipients"), short: null, value: recipients },
    {
      key: "inbox",
      label: t("dispatch.result.statInbox"),
      short: t("dispatch.result.statInboxShort"),
      value: result.dispatched,
    },
    { key: "muted", label: t("dispatch.result.statMuted"), short: null, value: result.skipped_by_preference },
  ];

  const undeliveredSection = (() => {
    if (undelivered.isError && !undelivered.data) {
      return (
        <div className="border-t border-border">
          <div className="flex min-h-14 items-center gap-2.5 border-b border-border px-5 py-3 max-md:px-4">
            <Users size={18} aria-hidden="true" className="shrink-0 text-text-muted" />
            <span className="text-sm font-semibold text-text">{t("dispatch.undelivered.title")}</span>
          </div>
          <div className="p-5 max-md:p-4">
            <NoticeAlert
              tone="danger"
              title={t("dispatch.undelivered.errorTitle")}
              action={
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={RefreshCw}
                    loading={undelivered.isFetching}
                    onClick={() => void undelivered.refetch()}
                  >
                    {t("dispatch.undelivered.retry")}
                  </Button>
                  <Link to="/notifications/sent" className={buttonClasses({ variant: "ghost", size: "sm" })}>
                    <ButtonIcon icon={History} px={16} />
                    {t("dispatch.historyLink")}
                  </Link>
                </div>
              }
            >
              {t("dispatch.undelivered.errorText")}
            </NoticeAlert>
          </div>
        </div>
      );
    }
    if (!undelivered.data) {
      return (
        <div className="border-t border-border" data-testid="undelivered-loading">
          <div className="flex min-h-14 items-center gap-2.5 border-b border-border px-5 py-3 max-md:px-4">
            <Users size={18} aria-hidden="true" className="shrink-0 text-text-muted" />
            <span className="text-sm font-semibold text-text">{t("dispatch.undelivered.title")}</span>
          </div>
          <span role="status" className="sr-only">
            {t("dispatch.undelivered.loading")}
          </span>
          <div aria-hidden="true">
            {[140, 112, 128].map((width, index) => (
              <div
                key={width}
                className={cx(
                  "flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 max-md:px-4",
                  index > 0 && "border-t border-border",
                )}
              >
                <Skeleton width={width} height={14} />
                <Skeleton width={64} height={24} />
                <Skeleton width={120} />
              </div>
            ))}
          </div>
        </div>
      );
    }
    if (total === 0) return null;
    const items = undelivered.data.undelivered.items;
    return (
      <div className="border-t border-border">
        <Pressable
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={() => setExpanded((value) => !value)}
          className="flex min-h-14 w-full items-center justify-between gap-3 px-5 py-3 text-left hover:bg-row-hover max-md:px-4"
        >
          <span className="flex min-w-0 items-center gap-2.5 text-text">
            <Users size={18} aria-hidden="true" className="shrink-0 text-text-muted" />
            <span className="text-sm font-semibold">{t("dispatch.undelivered.title")}</span>
            <Badge>{t("dispatch.detail.countValue", { value: count(total) })}</Badge>
          </span>
          {expanded ? (
            <ChevronUp size={18} aria-hidden="true" className="shrink-0 text-text-muted" />
          ) : (
            <ChevronDown size={18} aria-hidden="true" className="shrink-0 text-text-muted" />
          )}
        </Pressable>
        <div id={listId} hidden={!expanded} className="flex min-w-0 flex-col">
          <p className="m-0 px-5 pb-3 text-xs text-text-muted max-md:px-4">{t("dispatch.undelivered.hint")}</p>
          <UndeliveredList items={items} inset="card" className="md:[&_td:first-child]:pl-5 md:[&_th:first-child]:pl-5" />
          {total > items.length ? (
            <Pressable
              onClick={onOpenDetail}
              className="flex min-h-12 w-full items-center justify-between gap-3 border-t border-border px-5 py-3 text-left text-sm font-semibold text-action-fg hover:bg-row-hover max-md:px-4"
            >
              {t("dispatch.undelivered.viewAll", { value: count(total) })}
              <ChevronRight size={18} aria-hidden="true" className="shrink-0" />
            </Pressable>
          ) : null}
        </div>
      </div>
    );
  })();

  return (
    <Card
      ref={rootRef}
      tabIndex={-1}
      aria-live="polite"
      padding="none"
      className="overflow-hidden scroll-mt-4 focus-visible:outline-none"
      title={t("dispatch.result.title")}
      titleAddon={<DispatchStatusBadge status={status} />}
      // Telefonda (maket phone-light-1) sarlavha va belgi bir qatorda, vaqt — ostida alohida qatorda.
      description={isPhone ? time : undefined}
      actions={isPhone ? undefined : time}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <span className="text-[13px] text-text-muted max-md:hidden">{t("dispatch.result.locked")}</span>
          <Button leftIcon={Plus} onClick={onNewMessage} className="max-md:h-12 max-md:w-full">
            {t("dispatch.newMessage")}
          </Button>
        </div>
      }
      data-testid="dispatch-result"
    >
      <div className="flex min-w-0 flex-col gap-5 p-5 max-md:p-4">
        {result.duplicate ? (
          <NoticeAlert
            tone="success"
            title={t("dispatch.result.duplicateTitle")}
            action={
              <Button variant="secondary" size="sm" leftIcon={History} onClick={onOpenDetail}>
                {t("dispatch.checkHistory")}
              </Button>
            }
          >
            {t("dispatch.result.duplicateText")}
          </NoticeAlert>
        ) : null}

        <p className="m-0 text-[13px] text-text">{summary}</p>

        <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(min(160px,100%),1fr))] gap-x-4 gap-y-3 max-md:flex max-md:flex-col max-md:gap-0 max-md:rounded-xl max-md:bg-sunken max-md:px-4 max-md:py-1">
          {stats.map((stat) => (
            <div
              key={stat.key}
              className="flex min-w-0 flex-col gap-0.5 max-md:flex-row max-md:items-center max-md:justify-between max-md:gap-2 max-md:border-t max-md:border-border max-md:py-2 max-md:first:border-t-0"
            >
              <dt className="text-xs text-text-muted max-md:text-[13px]">
                {stat.short ? (
                  <>
                    <span className="max-md:hidden">{stat.label}</span>
                    <span className="hidden max-md:inline">{stat.short}</span>
                  </>
                ) : (
                  stat.label
                )}
              </dt>
              <dd className="m-0 text-base font-bold text-text max-md:text-sm max-md:font-semibold">
                {stat.value > 0 ? (
                  t("dispatch.detail.countValue", { value: count(stat.value) })
                ) : (
                  <span className="text-text-subtle">{count(0)}</span>
                )}
              </dd>
            </div>
          ))}
        </dl>

        {externalChannels(result.channels, result.channel_status).length ? (
          <section className="flex min-w-0 flex-col gap-1" aria-labelledby={`${listId}-channels`}>
            <h3 id={`${listId}-channels`} className="m-0 text-sm font-semibold text-text">
              {t("dispatch.breakdown.title")}
            </h3>
            <ChannelBreakdown
              variant="result"
              channels={result.channels}
              channelStatus={result.channel_status}
              byChannel={result.by_channel}
              noProvider={result.no_provider}
              dispatched={result.dispatched}
              telegramDm={!payload.telegram}
            />
          </section>
        ) : null}

        {undelivered.data && total === 0 ? (
          <p className="m-0 flex items-center gap-2 text-[13px] text-text">
            <CircleCheck size={16} aria-hidden="true" className="shrink-0 text-success-fg" />
            {t("dispatch.undelivered.noneYet")}
          </p>
        ) : null}
      </div>
      {undeliveredSection}
    </Card>
  );
};
