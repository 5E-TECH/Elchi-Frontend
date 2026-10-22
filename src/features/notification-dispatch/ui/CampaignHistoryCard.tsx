// dizayn-v2: superadmin-notifications-send-schedule, superadmin-notifications-campaign-cancel-dialog
import { useMemo, useState } from "react";
import { FileText, ListX, Send, ServerCrash } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  CAMPAIGN_DISPLAY_STATUSES,
  CAMPAIGN_PROGRESS_INTERVAL_MS,
  CampaignStatusBadge,
  campaignBarPct,
  campaignDisplayStatus,
  campaignEffectiveAt,
  campaignListRefetchInterval,
  draftFromSavedAudience,
  isCampaignPaused,
  useAudienceDescription,
  useCampaignTime,
  useCampaigns,
  useClock,
  type Campaign,
  type CampaignDisplayStatus,
} from "../../../entities/notification-campaign";
import { cx } from "../../../shared/lib/cx";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Pagination,
  QueryBoundary,
  SkeletonTable,
  Tabs,
  type DataTableColumn,
} from "../../../shared/ui/primitives";
import { CampaignProgressBar } from "./CampaignProgressBar";
import { CampaignReportDialog } from "./CampaignReportDialog";
import { CAMPAIGN_HISTORY_ID } from "./campaignHistoryAnchor";
import { useCampaignCancel } from "./useCampaignCancel";

/** Bir sahifada nechta kampaniya. */
export const CAMPAIGN_HISTORY_PAGE_SIZE = 10;

type HistoryFilter = "all" | CampaignDisplayStatus;
const FILTERS: readonly HistoryFilter[] = ["all", ...CAMPAIGN_DISPLAY_STATUSES];

const SUB = "text-[13px] text-text-muted";

/** Auditoriya sharti matni: «Mijoz, Market, Menejer, Logist · Toshkent sh.», «Xodim: Kuryer», «Mijoz · 3–10 buyurtma». */
const useAudienceLine = (audience: Record<string, unknown> | null) => {
  const { t } = useTranslation("notifications");
  const draft = useMemo(() => draftFromSavedAudience(audience ?? {}), [audience]);
  const description = useAudienceDescription(draft, { enabled: Boolean(audience) });
  if (!audience || !draft.kinds.length) return null;
  const staff = draft.kinds.includes("staff");
  const kinds =
    staff && draft.kinds.length === 1 && description.staffRoles
      ? t("campaign.who.staff", { roles: description.staffRoles })
      : [
          draft.kinds.includes("customer") ? t("campaign.kind.customer") : null,
          draft.kinds.includes("market") ? t("campaign.kind.market") : null,
          staff ? (description.staffRoles ?? t("campaign.kind.staff")) : null,
        ]
          .filter(Boolean)
          .join(", ");
  const all = t("campaign.saveDialog.all");
  const filters = [
    description.area !== all ? description.area : null,
    description.orders !== all ? t("campaign.history.orders", { range: description.orders }) : null,
  ].filter(Boolean);
  return [kinds, ...filters].join(" · ");
};

const AudienceLine = ({ campaign, className }: { campaign: Campaign; className?: string }) => {
  const line = useAudienceLine(campaign.audience);
  return line ? <span className={className}>{line}</span> : null;
};

/**
 * «KAMPANIYALAR TARIXI» (KM-3, maket `superadmin-notifications-send-schedule` pastki karta; `/notifications/send`):
 * holat tablari (Barchasi · Rejalashtirilgan · Yuborilmoqda · Yuborilgan · Xato · Bekor qilingan — backend `state`),
 * jadval Vaqt · Xabar · Auditoriya · Holat · Yuborildi · amal. Planshetda (< 1024) Auditoriya va Yuborildi ustunlari
 * yashirin — ularning qisqasi Xabar va Holat ostida; telefonda — kartalar. Amal: yuborilmaguncha (`can_cancel`) —
 * «Bekor qilish» (tasdiq oynasi), qolganida — «Hisobot» (oyna). Vaqt — Toshkent vaqti («Ertaga, 10:00»). Yuborilayotgan
 * kampaniya bo'lsa ro'yxat har 3 s yangilanadi.
 */
export const CampaignHistoryCard = () => {
  const { t, i18n } = useTranslation("notifications");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const num = (value: number) => formatNumberLocalized(value, { language });
  const time = useCampaignTime();
  // Nisbiy kun («Bugun» / «Ertaga») Toshkent yarim tunida o'zi almashadi — render toza, soat bitta.
  const now = useClock();
  const askCancel = useCampaignCancel();
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [page, setPage] = useState(1);
  const [reportOf, setReportOf] = useState<Campaign | null>(null);

  const listQuery = useCampaigns({
    page,
    limit: CAMPAIGN_HISTORY_PAGE_SIZE,
    ...(filter === "all" ? {} : { state: filter }),
  });
  const data = listQuery.data;

  // Oxirgi sahifadan tashqarida (bekor qilingandan keyin qatorlar kamaydi) — mavjud oxirgi sahifaga.
  const outOfRange = Boolean(data && !data.items.length && data.meta.total > 0 && page > data.meta.totalPages);
  const lastPage = data?.meta.totalPages ?? 1;
  // Render paytida tuzatiladi (oldingi javobdan kelib chiqqan holat — React tavsiya qilgan naqsh, effektsiz).
  if (outOfRange && page !== lastPage) setPage(lastPage);
  const settling = listQuery.isPlaceholderData && !data?.items.length;
  const pending = outOfRange || settling;

  const query = {
    data: (listQuery.isError && !data) || pending ? undefined : data?.items,
    isLoading: listQuery.isLoading || pending,
    // Oflayn (so'rov kutib turibdi) — «Internet aloqasi yo'q», «Hali kampaniya yo'q» emas.
    isPaused: listQuery.isPaused,
    isFetching: listQuery.isFetching,
    isError: listQuery.isError && !data,
    error: listQuery.error,
    refetch: () => void listQuery.refetch(),
  };
  /** «Holat har 3 soniyada yangilanadi» — faqat sahifada yuborilayotgan kampaniya bo'lsa (ro'yxat shunda so'raladi). */
  const live = campaignListRefetchInterval(data, now) === CAMPAIGN_PROGRESS_INTERVAL_MS;

  const channelLabel = (channel: string) =>
    channel === "realtime" ? t("campaign.channel.realtime") : t(`dispatch.channel.${channel}`);
  const meta = (campaign: Campaign) =>
    [
      campaign.category ? t(`category.${campaign.category}`, { defaultValue: campaign.category }) : null,
      campaign.channels.map(channelLabel).join(", "),
    ]
      .filter(Boolean)
      .join(" · ");
  /**
   * Vaqt: rejalashtirilgan — haqiqiy yuborish lahzasi (navbatdagi reklama tungi taqiqqa surilgan bo'lsa —
   * `paused_until`), qolganida — boshlangan vaqt.
   */
  const when = (campaign: Campaign) =>
    time.format(
      (campaignDisplayStatus(campaign) === "scheduled" ? campaignEffectiveAt(campaign) : campaign.scheduled_at) ??
        campaign.created_at,
      now,
    ) ?? "—";
  /** Vaqt ostidagi izoh: reklama tungi taqiqda — surilgan (hali boshlanmagan) yoki qachon davom etadi. */
  const whenNote = (campaign: Campaign) => {
    if (!isCampaignPaused(campaign, now)) return null;
    const display = campaignDisplayStatus(campaign);
    if (display === "scheduled")
      return campaignEffectiveAt(campaign) === campaign.paused_until ? t("campaign.history.quietShifted") : null;
    return display === "sending"
      ? t("campaign.history.paused", { time: time.inline(campaign.paused_until, now) ?? "" })
      : null;
  };
  const recipients = (campaign: Campaign) => t("campaign.confirm.count", { value: num(campaign.total) });
  const progressText = (campaign: Campaign) => {
    if (campaignDisplayStatus(campaign) === "sent") {
      return campaign.failed
        ? t("campaign.history.sentWithFailed", { sent: num(campaign.sent), failed: num(campaign.failed) })
        : t("campaign.history.sent", { sent: num(campaign.sent) });
    }
    return t("campaign.history.progress", { done: num(campaign.sent), total: num(campaign.total) });
  };
  const title = (campaign: Campaign) => campaign.title || t("campaign.history.untitled");

  const onCancel = (campaign: Campaign) =>
    void askCancel(
      {
        id: campaign.id,
        title: title(campaign),
        display: campaignDisplayStatus(campaign),
        total: campaign.total,
        sent: campaign.sent,
        failed: campaign.failed,
        skipped: campaign.skipped,
        progressPct: campaignBarPct(campaign),
      },
      { onConflict: () => void listQuery.refetch() },
    );

  const action = (campaign: Campaign, block = false) =>
    campaign.can_cancel ? (
      <Button
        size={block ? "md" : "sm"}
        variant="danger-soft"
        fullWidth={block}
        aria-haspopup="dialog"
        aria-label={t("campaign.history.cancelLabel", { title: title(campaign) })}
        onClick={() => onCancel(campaign)}
        className={block ? "max-md:h-12" : undefined}
      >
        {t("campaign.progress.cancel")}
      </Button>
    ) : campaignDisplayStatus(campaign) === "scheduled" ? null : (
      <Button
        size={block ? "md" : "sm"}
        variant="secondary"
        fullWidth={block}
        leftIcon={FileText}
        aria-haspopup="dialog"
        aria-label={t("campaign.history.reportLabel", { title: title(campaign) })}
        onClick={() => setReportOf(campaign)}
        className={block ? "max-md:h-12" : undefined}
      >
        {t("campaign.history.report")}
      </Button>
    );

  const progress = (campaign: Campaign) =>
    campaignDisplayStatus(campaign) === "scheduled" ? (
      <span className="text-text-subtle">—</span>
    ) : (
      <div className="flex w-[132px] flex-col gap-1.5">
        <CampaignProgressBar
          value={campaignBarPct(campaign)}
          label={t("campaign.history.progressLabel", { title: title(campaign) })}
        />
        <span className="text-xs text-text-muted tabular-nums">{progressText(campaign)}</span>
      </div>
    );

  const columns: DataTableColumn<Campaign>[] = [
    {
      id: "time",
      header: t("campaign.history.columns.time"),
      className: "min-w-[132px]",
      cell: (campaign) => (
        <>
          <div className="whitespace-nowrap text-text">{when(campaign)}</div>
          {whenNote(campaign) ? <div className={cx(SUB, "max-w-[180px]")}>{whenNote(campaign)}</div> : null}
        </>
      ),
    },
    {
      id: "message",
      header: t("campaign.history.columns.message"),
      cell: (campaign) => (
        <div className="flex min-w-[180px] max-w-[300px] flex-col gap-0.5">
          <span className="font-semibold text-text [overflow-wrap:anywhere]">{title(campaign)}</span>
          <span className={SUB}>{meta(campaign)}</span>
          {/* Planshetda «Auditoriya» ustuni yashirin — qisqasi shu yerda. */}
          <span className={cx(SUB, "lg:hidden")}>
            {recipients(campaign)}
            <AudienceLine campaign={campaign} className="before:content-['_·_']" />
          </span>
        </div>
      ),
    },
    {
      id: "audience",
      header: t("campaign.history.columns.audience"),
      hideBelow: "lg",
      className: "min-w-[140px] max-w-[240px]",
      cell: (campaign) => (
        <>
          <div className="font-semibold text-text">{recipients(campaign)}</div>
          <AudienceLine campaign={campaign} className={SUB} />
        </>
      ),
    },
    {
      id: "status",
      header: t("campaign.history.columns.status"),
      cell: (campaign) => (
        <div className="flex flex-col items-start gap-1">
          <CampaignStatusBadge status={campaignDisplayStatus(campaign)} />
          {campaignDisplayStatus(campaign) === "scheduled" ? null : (
            <span className="text-xs text-text-muted tabular-nums lg:hidden">{progressText(campaign)}</span>
          )}
        </div>
      ),
    },
    {
      id: "sent",
      header: t("campaign.history.columns.sent"),
      hideBelow: "lg",
      cell: progress,
    },
    {
      id: "action",
      header: <span className="sr-only">{t("campaign.history.columns.action")}</span>,
      className: "text-right",
      cell: (campaign) => action(campaign),
    },
  ];

  const renderCard = (campaign: Campaign) => (
    <div className="flex min-w-0 flex-col gap-2 px-4 py-3.5 text-sm text-text">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <CampaignStatusBadge status={campaignDisplayStatus(campaign)} />
        <span className={cx(SUB, "whitespace-nowrap")}>{when(campaign)}</span>
      </div>
      <span className="font-semibold [overflow-wrap:anywhere]">{title(campaign)}</span>
      <span className="text-xs text-text-muted">
        <span className="mr-2 text-[13px] font-semibold text-text">{recipients(campaign)}</span>
        <AudienceLine campaign={campaign} />
      </span>
      <span className="text-xs text-text-muted">{meta(campaign)}</span>
      {whenNote(campaign) ? <span className="text-xs text-text-muted">{whenNote(campaign)}</span> : null}
      {campaignDisplayStatus(campaign) === "scheduled" ? null : (
        <div className="flex min-w-0 items-center gap-3">
          <CampaignProgressBar
            value={campaignBarPct(campaign)}
            label={t("campaign.history.progressLabel", { title: title(campaign) })}
            className="flex-1"
          />
          <span className="shrink-0 text-xs text-text-muted tabular-nums">{progressText(campaign)}</span>
        </div>
      )}
      {action(campaign, true)}
    </div>
  );

  return (
    <>
      <Card
        id={CAMPAIGN_HISTORY_ID}
        tabIndex={-1}
        padding="none"
        title={t("campaign.history.title")}
        actions={<span className="text-[13px] text-text-muted max-md:hidden">{t("campaign.history.subtitle")}</span>}
        className="overflow-hidden outline-none"
        data-testid="campaign-history"
        footer={
          data && data.meta.total > 0 && data.items.length > 0 ? (
            <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <Pagination
                page={data.meta.page}
                pageSize={data.meta.limit}
                total={data.meta.total}
                onPageChange={setPage}
                disabled={listQuery.isPlaceholderData}
                summary={(range) => t("campaign.history.summary", { ...range, count: data.meta.total })}
                className="min-w-0 flex-1"
              />
              {live ? (
                <span className="text-[13px] text-text-muted max-md:hidden">{t("campaign.history.live")}</span>
              ) : null}
            </div>
          ) : undefined
        }
      >
        <Tabs
          items={FILTERS.map((value) => ({
            value,
            label: value === "all" ? t("campaign.history.all") : t(`campaign.status.${value}`),
          }))}
          value={filter}
          onValueChange={(next) => {
            setFilter(next);
            setPage(1);
          }}
          ariaLabel={t("campaign.history.filterLabel")}
          listClassName="px-3"
        />
        <QueryBoundary
          query={query}
          keepPreviousData={false}
          loadingLabel={t("campaign.history.loading")}
          loading={
            <SkeletonTable
              framed={false}
              rows={4}
              columns={[
                t("campaign.history.columns.time"),
                t("campaign.history.columns.message"),
                t("campaign.history.columns.audience"),
                t("campaign.history.columns.status"),
                t("campaign.history.columns.sent"),
              ]}
            />
          }
          error={(_, retry) => (
            <ErrorState
              kind="server"
              icon={ServerCrash}
              title={t("campaign.history.error.title")}
              description={t("campaign.history.error.text")}
              onRetry={retry}
              retrying={listQuery.isFetching}
            />
          )}
          empty={
            filter === "all" ? (
              <EmptyState
                icon={Send}
                title={t("campaign.history.empty.title")}
                description={t("campaign.history.empty.text")}
              />
            ) : (
              <EmptyState
                icon={ListX}
                title={t("campaign.history.emptyFiltered.title", {
                  status: t(`campaign.status.${filter}`),
                })}
                description={t("campaign.history.emptyFiltered.text")}
                action={
                  <Button
                    variant="secondary"
                    leftIcon={ListX}
                    onClick={() => {
                      setFilter("all");
                      setPage(1);
                    }}
                  >
                    {t("campaign.history.showAll")}
                  </Button>
                }
              />
            )
          }
        >
          {(rows: Campaign[]) => (
            <DataTable
              rows={rows}
              columns={columns}
              getRowKey={(campaign) => campaign.id}
              label={t("campaign.history.title")}
              cardsLabel={t("campaign.history.title")}
              renderCard={renderCard}
              busy={listQuery.isPlaceholderData}
            />
          )}
        </QueryBoundary>
      </Card>

      <CampaignReportDialog campaign={reportOf} onClose={() => setReportOf(null)} />
    </>
  );
};
