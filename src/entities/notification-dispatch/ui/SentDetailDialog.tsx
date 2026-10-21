// dizayn-v2: superadmin-notifications-sent-detail-dialog, superadmin-notifications-sent-detail-states
import { useId, useState, type ReactNode } from "react";
import { CircleCheck, CircleQuestionMark, Send, ServerCrash } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { NoticeAlert } from "../../notification";
import { cx } from "../../../shared/lib/cx";
import { getErrorStatus } from "../../../shared/lib/errorKind";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import {
  Badge,
  Button,
  ButtonIcon,
  buttonClasses,
  Dialog,
  EmptyState,
  ErrorState,
  Pagination,
  Skeleton,
} from "../../../shared/ui/primitives";
import { useSentDetail } from "../api/useSentDetail";
import { externalChannels } from "../model/status";
import type { SentDetail } from "../model/types";
import { useAudienceText } from "../model/useAudienceText";
import { ChannelBreakdown } from "./ChannelBreakdown";
import { DispatchStatusBadge } from "./DispatchBadges";
import { UndeliveredList } from "./UndeliveredList";

/** «Yetkazilmaganlar» sahifasi (maket «1–10 / 33 ta»). */
export const SENT_DETAIL_PAGE_SIZE = 10;

export type SentDetailDialogProps = {
  /** Ochiq oynaning xabari (`dispatch_id` = yuborishdagi `client_request_id`); `null` — yopiq. */
  dispatchId: string | null;
  onClose: () => void;
  /**
   * Qayerdan ochildi — faqat «topilmadi» (404) matni uchun: `history` (sukut) — ro'yxat/havola; `unknown` — natija
   * noma'lum kartasi («Tarixdan tekshirish»): tarixda yo'q bo'lsa so'rov serverga yetmagan, kartada «Qayta urinish».
   */
  source?: "history" | "unknown";
  /**
   * «Xato bilan tugagan» holatida asosiy «Qayta yuborish» havolasi (maket `*-sent-detail-states`) — «Yuborilganlar»
   * sahifasidan `/notifications/send`. Yuborish sahifasining o'zida berilmaydi (forma shu yerda).
   */
  resendHref?: string;
};

type InfoRow = { key: string; label: ReactNode; value: ReactNode };

const InfoList = ({ rows, className }: { rows: InfoRow[]; className?: string }) => (
  <dl className={cx("m-0 flex min-w-0 flex-col rounded-xl bg-sunken px-4 py-1 text-sm", className)}>
    {rows.map((row, index) => (
      <div
        key={row.key}
        className={cx("flex flex-wrap justify-between gap-x-3 gap-y-1 py-2", index > 0 && "border-t border-border")}
      >
        <dt className="min-w-0 text-text-muted">{row.label}</dt>
        <dd className="m-0 ml-auto text-right font-semibold text-text [overflow-wrap:anywhere]">{row.value}</dd>
      </div>
    ))}
  </dl>
);

/**
 * YUBORILGAN XABAR TAFSILOTI (maket `*-notifications-sent-detail-dialog`, holatlar `*-sent-detail-states`):
 * sarlavha, sana va muallif; natija belgisi; «Kimga», qabul qiluvchilar, qutiga yozildi, o'chirganlar,
 * kategoriya · muhimlik, havola, yakunlandi; to'liq matn; «Kanallar bo'yicha» (JONLI — ish tugaguncha har 5 s,
 * `useSentDetail live`); «Yetkazilmaganlar» (10 tadan, sahifalab). Holatlar: yuklanish, topilmadi (404), xato
 * («Qayta urinish»), yuborilmoqda, xato bilan tugagan (tushunarli matn — backend `error` ko'rsatilmaydi).
 * Telefonda — pastki varaqa (`Dialog` o'zi).
 */
export const SentDetailDialog = ({ dispatchId, onClose, source = "history", resendHref }: SentDetailDialogProps) => {
  const { t, i18n } = useTranslation("notifications");
  const { roleLabel, audienceText } = useAudienceText();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const count = (value: number) => formatNumberLocalized(value, { language });
  const when = (value: string | null) => formatDateTimeLocalized(value, { language });

  // Yopilish harakati tugaguncha oxirgi xabar ko'rinib turadi.
  const [shownId, setShownId] = useState(dispatchId);
  const [page, setPage] = useState(1);
  // Har ochilishda (shu xabar qayta ochilsa ham) — birinchi sahifa.
  const [lastId, setLastId] = useState(dispatchId);
  if (dispatchId !== lastId) {
    setLastId(dispatchId);
    if (dispatchId) {
      setShownId(dispatchId);
      setPage(1);
    }
  }
  const open = Boolean(dispatchId);
  const query = useSentDetail(shownId, { page, limit: SENT_DETAIL_PAGE_SIZE }, { enabled: open, live: true });
  const detail = query.data;

  const closeFooter = (
    <Button variant="secondary" onClick={onClose}>
      {t("dispatch.detail.close")}
    </Button>
  );

  let title: ReactNode = t("dispatch.detail.fallbackTitle");
  let description: ReactNode = t("dispatch.detail.fallbackSubtitle");
  let footer: ReactNode = closeFooter;
  let body: ReactNode;

  if (detail) {
    title = detail.title || t("dispatch.detail.fallbackTitle");
    const author = detail.created_by
      ? [detail.created_by.name, roleLabel(detail.created_by.role)].filter(Boolean).join(", ")
      : "";
    description = [when(detail.created_at), author].filter(Boolean).join(" · ");
    if (detail.status === "failed" && resendHref) {
      footer = (
        <>
          {closeFooter}
          <Link to={resendHref} className={buttonClasses({ variant: "primary" })} onClick={onClose}>
            <ButtonIcon icon={Send} px={18} />
            {t("dispatch.detail.resend")}
          </Link>
        </>
      );
    }
    body = (
      <DetailBody
        detail={detail}
        audience={audienceText(detail.audience) ?? "—"}
        page={page}
        onPageChange={setPage}
        busy={query.isPlaceholderData}
        count={count}
        when={when}
      />
    );
  } else if (query.isError) {
    if (getErrorStatus(query.error) === 404) {
      body = (
        <EmptyState
          icon={CircleQuestionMark}
          title={t("dispatch.detail.notFoundTitle")}
          description={t(source === "unknown" ? "dispatch.detail.notFoundUnknownText" : "dispatch.detail.notFoundText")}
          className="py-6"
        />
      );
    } else {
      footer = null;
      body = (
        <ErrorState
          kind="server"
          icon={ServerCrash}
          title={t("dispatch.detail.errorTitle")}
          description={t("dispatch.detail.errorText")}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
          className="py-6"
        />
      );
    }
  } else {
    footer = null;
    body = (
      <div className="flex min-w-0 flex-col gap-3" data-testid="sent-detail-loading">
        <span role="status" className="sr-only">
          {t("dispatch.detail.loading")}
        </span>
        <div aria-hidden="true" className="flex min-w-0 flex-col gap-3">
          <Skeleton width={112} height={24} />
          <Skeleton shape="block" height={168} />
          <Skeleton width="40%" height={14} />
          <Skeleton />
          <Skeleton />
          <Skeleton />
        </div>
      </div>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      icon={Send}
      size="xl"
      className="md:max-w-[760px]"
      footer={footer}
      initialFocus="panel"
    >
      <div className="flex min-w-0 flex-col gap-4" data-testid="sent-detail">
        {body}
      </div>
    </Dialog>
  );
};

type DetailBodyProps = {
  detail: SentDetail;
  audience: string;
  page: number;
  onPageChange: (page: number) => void;
  busy: boolean;
  count: (value: number) => string;
  when: (value: string | null) => string;
};

const DetailBody = ({ detail, audience, page, onPageChange, busy, count, when }: DetailBodyProps) => {
  const { t } = useTranslation("notifications");
  const headingId = useId();
  const running = detail.status === "running";
  const failed = detail.status === "failed";
  const total = detail.undelivered.total;
  const recipients = detail.dispatched + detail.skipped_by_preference;
  const live = externalChannels(detail.channels, detail.channel_status).filter(
    (channel) => channel !== "realtime",
  );
  const liveChannels = live.map((channel) => t(`dispatch.channel.${channel}`));
  const joined =
    liveChannels.length > 1
      ? `${liveChannels.slice(0, -1).join(", ")} ${t("dispatch.breakdown.and")} ${liveChannels.at(-1)}`
      : (liveChannels[0] ?? "");

  const summary = running
    ? t("dispatch.detail.runningSummary")
    : failed
      ? t("dispatch.detail.failedSummary")
      : total > 0
        ? t("dispatch.detail.undeliveredSummary", { count: total, value: count(total) })
        : null;

  const subtle = (text: string) => <span className="font-normal text-text-subtle">{text}</span>;
  const finished = detail.finished_at ? when(detail.finished_at) : subtle(t("dispatch.detail.notFinished"));
  const category = [
    detail.category ? t(`category.${detail.category}`, { defaultValue: detail.category }) : null,
    detail.priority ? t(`priority.${detail.priority}`, { defaultValue: detail.priority }) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const rows: InfoRow[] = running
    ? [
        { key: "to", label: t("dispatch.detail.rowTo"), value: audience },
        { key: "recipients", label: t("dispatch.detail.rowRecipients"), value: recipients ? t("dispatch.detail.countValue", { value: count(recipients) }) : subtle("—") },
        { key: "started", label: t("dispatch.detail.rowStarted"), value: when(detail.created_at) },
        { key: "finished", label: t("dispatch.detail.rowFinished"), value: finished },
      ]
    : failed
      ? [
          { key: "to", label: t("dispatch.detail.rowTo"), value: audience },
          { key: "recipients", label: t("dispatch.detail.rowRecipients"), value: subtle("—") },
          { key: "finished", label: t("dispatch.detail.rowFinished"), value: finished },
        ]
      : [
          { key: "to", label: t("dispatch.detail.rowTo"), value: audience },
          { key: "recipients", label: t("dispatch.detail.rowRecipients"), value: t("dispatch.detail.countValue", { value: count(recipients) }) },
          { key: "inbox", label: t("dispatch.detail.rowInbox"), value: t("dispatch.detail.countValue", { value: count(detail.dispatched) }) },
          { key: "muted", label: t("dispatch.detail.rowMuted"), value: count(detail.skipped_by_preference) },
          ...(category ? [{ key: "category", label: t("dispatch.detail.rowCategory"), value: category }] : []),
          { key: "link", label: t("dispatch.detail.rowLink"), value: detail.link ? <span className="break-all">{detail.link}</span> : subtle(t("dispatch.detail.rowLinkNone")) },
          { key: "finished", label: t("dispatch.detail.rowFinished"), value: finished },
        ];

  return (
    <>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <DispatchStatusBadge status={detail.status} />
        {summary ? <span className="text-[13px] text-text-muted">{summary}</span> : null}
      </div>

      {failed ? (
        <NoticeAlert tone="danger" role="note" title={t("dispatch.detail.failedTitle")}>
          {t("dispatch.detail.failedText")}
        </NoticeAlert>
      ) : null}

      {running || failed ? (
        <InfoList rows={rows} />
      ) : (
        <div className="flex min-w-0 flex-wrap items-stretch gap-4">
          <InfoList rows={rows} className="flex-[1_1_300px]" />
          <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-2">
            <span className="text-[13px] font-semibold text-text">{t("dispatch.detail.message")}</span>
            <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-xl bg-sunken px-4 py-3">
              <p className="m-0 font-semibold text-text [overflow-wrap:anywhere]">{detail.title}</p>
              {detail.body ? (
                <p className="m-0 whitespace-pre-wrap text-[13px] text-text-muted [overflow-wrap:anywhere]">{detail.body}</p>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {!failed ? (
        <section className="flex min-w-0 flex-col gap-1" aria-labelledby={`${headingId}-channels`}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 id={`${headingId}-channels`} className="m-0 text-sm font-semibold text-text">
              {t("dispatch.breakdown.title")}
            </h3>
            {joined ? <span className="text-xs text-text-muted">{t("dispatch.breakdown.live", { channels: joined })}</span> : null}
          </div>
          <ChannelBreakdown
            variant="detail"
            channels={detail.channels}
            channelStatus={detail.channel_status}
            byChannel={detail.by_channel}
            noProvider={detail.no_provider}
            dispatched={detail.dispatched}
          />
        </section>
      ) : null}

      {!running && !failed ? (
        <section
          className="flex min-w-0 flex-col gap-2 border-t border-border pt-4"
          aria-labelledby={`${headingId}-undelivered`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <h3 id={`${headingId}-undelivered`} className="m-0 text-sm font-semibold text-text">
              {t("dispatch.undelivered.title")}
            </h3>
            {total > 0 ? <Badge>{t("dispatch.detail.countValue", { value: count(total) })}</Badge> : null}
          </div>
          {total > 0 ? (
            <>
              <UndeliveredList items={detail.undelivered.items} busy={busy} />
              {total > detail.undelivered.limit ? (
                <Pagination
                  page={page}
                  pageSize={detail.undelivered.limit}
                  total={total}
                  onPageChange={onPageChange}
                  disabled={busy}
                  label={t("dispatch.undelivered.pages")}
                  summary={(range) => t("dispatch.undelivered.summary", range)}
                />
              ) : null}
            </>
          ) : (
            <p className="m-0 flex items-center gap-2 text-[13px] text-text-muted">
              <CircleCheck size={16} aria-hidden="true" className="shrink-0 text-success-fg" />
              {t("dispatch.undelivered.none")}
            </p>
          )}
        </section>
      ) : null}
    </>
  );
};
