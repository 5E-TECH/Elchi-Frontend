// dizayn-v2: superadmin-notifications-campaign-report-dialog
import { useMemo, useState, type ReactNode } from "react";
import { CircleCheck, Download, FileText, ServerCrash } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  CampaignStatusBadge,
  campaignDisplayStatus,
  campaignReportKey,
  draftFromSavedAudience,
  useAudienceDescription,
  useCampaignReport,
  useCampaignTime,
  useCampaignUndelivered,
  useClock,
  useExportCampaignUndelivered,
  sumReportBucket,
  type Campaign,
  type CampaignReport,
  type CampaignReportChannel,
  type CampaignReportKind,
  type CampaignReportSms,
  type CampaignUndeliveredFailure,
  type CampaignUndeliveredItem,
} from "../../../entities/notification-campaign";
import { deliveryBucket, failureReasonKey, SMS_DLR_FAILED_STATUSES } from "../../../entities/notification-dispatch";
import { getUserRoleLabelKey } from "../../../entities/user/lib/role";
import { cx } from "../../../shared/lib/cx";
import { saveBlob } from "../../../shared/lib/exportFile";
import {
  CURRENCY_LABEL,
  formatCompactMoneyLocalized,
  formatMoneyLocalized,
  formatNumberLocalized,
  resolveMoneyLanguage,
} from "../../../shared/lib/formatMoney";
import { notify } from "../../../shared/lib/notify";
import {
  Badge,
  Button,
  DataTable,
  Dialog,
  EmptyState,
  ErrorState,
  Pagination,
  QueryBoundary,
  SkeletonLines,
  SkeletonList,
  StatCard,
  type DataTableColumn,
} from "../../../shared/ui/primitives";

/** «Yetkazilmaganlar» bir sahifada. */
export const CAMPAIGN_UNDELIVERED_PAGE_SIZE = 10;

/**
 * SMS kampaniyasi (`/notifications/sms` → «Kampaniyalar tarixi», H7kpCman) — hisobot
 * `GET /notifications/sms/campaigns/:id/report` (javob shakli bir xil, `kind: 'sms'`).
 */
export type SmsCampaignReportTarget = { kind: "sms"; id: string; text: string; created_at: string | null };

export type CampaignReportDialogProps = {
  /** Tarix qatori (auditoriya sharti va sarlavha uchun) yoki SMS kampaniyasi; `null` — oyna yopiq. */
  campaign: Campaign | SmsCampaignReportTarget | null;
  onClose: () => void;
};

const isSmsTarget = (campaign: Campaign | SmsCampaignReportTarget): campaign is SmsCampaignReportTarget =>
  "kind" in campaign && campaign.kind === "sms";

const BOX = "overflow-hidden rounded-xl border border-border";

/** Telefon faqat maska bilan (`***7434`): backend maskalaydi; to'liq raqam kelib qolsa ham oxirgi 4 raqam. */
const maskedPhone = (phone: string | null) => {
  if (!phone) return null;
  if (/^\*+\d{0,4}$/.test(phone.trim())) return phone.trim();
  const digits = phone.replace(/\D/g, "");
  return digits ? `***${digits.slice(-4)}` : null;
};

/** Xato guruhi: `failed` yoki SMS operator hisobotining yakuniy xatosi (`rejected`, `expired`, `not_delivered`). */
const isFailedStatus = (status: string) =>
  deliveryBucket(status) === "failed" || SMS_DLR_FAILED_STATUSES.includes(status);

/**
 * KAMPANIYA HISOBOTI (KM-3, maket `superadmin-notifications-campaign-report-dialog`, ega KM-S1 — sahifa emas, oyna):
 * sarlavha «Kampaniya hisoboti» + «Nom · vaqt», holat belgisi va «Kategoriya · kanallar · auditoriya»; 6 ta `StatCard`
 * (H7kpCman TC) — Auditoriya · Yuborildi · Yetkazildi · Xato · O'tkazib yuborildi · Narx (Xato va O'tkazildi — kanal
 * kesimi yig'indisi, izohida qaysi kanal / sabab; «Yetkazildi» — DLR o'lchanmagan bo'lsa «—», HECH QACHON 0; narx
 * yonida «taxminiy»); «Kanallar bo'yicha» jadvali (telefonda — ro'yxat); SMS bloki (bo'laklar, kodlash, operator
 * hisoboti, tarif) — FAQAT `sms !== null`; «Yetkazilmaganlar» (ism, rol, maskalangan telefon — N9, «Push — xato» + sabab
 * `reason_code` xaritasidan; sahifalab); «Yopish» · «CSV yuklab olish» (faqat `can_export` — superadmin; katta eksport
 * fonda tayyorlanadi). SMS kampaniyasi (`kind: 'sms'`) ham shu oynada. Yuborilayotgan kampaniyada hisobot har 3 s
 * yangilanadi. 390px: kataklar 2 ustun, jadval — kartalar.
 */
export const CampaignReportDialog = ({ campaign: openCampaign, onClose }: CampaignReportDialogProps) => {
  const { t, i18n } = useTranslation("notifications");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const num = (value: number) => formatNumberLocalized(value, { language });
  const time = useCampaignTime();
  const now = useClock();
  const open = Boolean(openCampaign);
  // Yopilish animatsiyasida oxirgi kampaniya ko'rinib turadi («Sarlavhasiz» + skeletga sakramaydi; effektsiz).
  const [lastCampaign, setLastCampaign] = useState<Campaign | SmsCampaignReportTarget | null>(openCampaign);
  if (openCampaign && openCampaign !== lastCampaign) setLastCampaign(openCampaign);
  const target = openCampaign ?? lastCampaign;
  const smsTarget = target && isSmsTarget(target) ? target : null;
  /** Bildirishnoma kampaniyasi (tarix qatori) — SMS kampaniyasida `null`. */
  const campaign = target && !isSmsTarget(target) ? target : null;
  const kind: CampaignReportKind = smsTarget ? "sms" : "notification";
  const id = target?.id ?? null;
  const refKey = id ? campaignReportKey({ id, kind }) : null;
  // Sahifa kampaniyaga bog'langan: boshqa kampaniya ochilsa — yana 1-sahifa (effektsiz).
  const [pageOf, setPageOf] = useState<{ key: string | null; page: number }>({ key: null, page: 1 });
  const page = pageOf.key === refKey ? pageOf.page : 1;
  const setPage = (next: number) => setPageOf({ key: refKey, page: next });

  // Oyna yopiq — so'rov va 3 s yangilanish yo'q (kesh yopilish animatsiyasi uchun qoladi).
  const report = useCampaignReport(id, open, kind);
  const undelivered = useCampaignUndelivered(id, { page, limit: CAMPAIGN_UNDELIVERED_PAGE_SIZE }, open, kind);
  // Natija xabari mutatsiya darajasida — oyna yopilgan yoki boshqa kampaniya ochilgan bo'lsa ham chiqadi.
  const exporter = useExportCampaignUndelivered(saveBlob, {
    onOutcome: (outcome) => {
      if (outcome.kind === "saved") notify.success(t("campaign.report.exportSaved"));
      else if (outcome.kind === "timeout") notify.info(t("campaign.report.exportTimeout"));
      else notify.error(t("campaign.report.exportFailed"));
    },
    onError: () => notify.error(t("campaign.report.exportFailed")),
  });
  /** Eksport bitta (kuzatuvchi umumiy) — «tayyorlanmoqda» faqat o'sha kampaniyada. */
  const exportingVariables = exporter.variables;
  const exporting =
    exporter.isPending &&
    exportingVariables !== undefined &&
    campaignReportKey(
      typeof exportingVariables === "string" ? { id: exportingVariables, kind: "notification" } : exportingVariables,
    ) === refKey;

  const draft = useMemo(() => draftFromSavedAudience(campaign?.audience ?? {}), [campaign?.audience]);
  const audience = useAudienceDescription(draft, { enabled: Boolean(campaign?.audience) });

  const channelLabel = (channel: string) =>
    channel === "realtime" ? t("campaign.channel.realtime") : t(`dispatch.channel.${channel}`);

  const data = report.data;
  const title =
    campaign?.title ||
    data?.campaign.title ||
    (smsTarget ? t("campaign.report.smsCampaign") : t("campaign.history.untitled"));
  const when = time.format(
    campaign?.scheduled_at ?? campaign?.created_at ?? smsTarget?.created_at ?? data?.campaign.created_at,
    now,
  );
  const display = campaign ? campaignDisplayStatus(campaign) : smsTarget ? null : (data?.campaign.display_status ?? null);
  const metaLine = [
    campaign?.category ? t(`category.${campaign.category}`, { defaultValue: campaign.category }) : null,
    (campaign?.channels ?? data?.campaign.channels ?? []).map(channelLabel).join(", "),
    campaign?.audience && draft.kinds.length ? audience.who : null,
  ]
    .filter(Boolean)
    .join(" · ");
  /** SMS kampaniyasida sarlavha yo'q — xabar matni (2 qator). */
  const smsText = smsTarget?.text || data?.campaign.text || null;

  const exportFile = () => {
    if (!id || exporting) return;
    exporter.mutate(kind === "sms" ? { id, kind } : id);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("campaign.report.title")}
      description={[title, when].filter(Boolean).join(" · ")}
      icon={FileText}
      size="xl"
      closable
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("campaign.report.close")}
          </Button>
          {data?.canExport && data.stats.undelivered > 0 ? (
            <Button
              variant="secondary"
              leftIcon={Download}
              loading={exporting}
              loadingText={t("campaign.report.exporting")}
              onClick={exportFile}
            >
              {t("campaign.report.export")}
            </Button>
          ) : null}
        </>
      }
    >
      <div className="flex min-w-0 flex-col gap-4" data-testid="campaign-report">
        {display || metaLine ? (
          <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5">
            {display ? <CampaignStatusBadge status={display} /> : null}
            {metaLine ? <span className="min-w-0 text-xs text-text-muted">{metaLine}</span> : null}
          </div>
        ) : null}
        {smsText ? (
          <p className="m-0 line-clamp-2 text-[13px] text-text [overflow-wrap:anywhere]">{smsText}</p>
        ) : null}

        <QueryBoundary
          query={report}
          // Boshqa kampaniya ochilganda oldingisining hisoboti ko'rinmaydi.
          keepPreviousData={false}
          isEmpty={() => false}
          size="inline"
          // O'ram bo'limlar oralig'ini saqlaydi (kataklar · kanallar · yetkazilmaganlar).
          className="flex min-w-0 flex-col gap-4"
          loadingLabel={t("campaign.report.loading")}
          loading={<SkeletonLines lines={6} />}
          error={(_, retry) => (
            <ErrorState
              kind="server"
              size="inline"
              icon={ServerCrash}
              title={t("campaign.report.error.title")}
              description={t("campaign.report.error.text")}
              onRetry={retry}
              retrying={report.isFetching}
            />
          )}
        >
          {(loaded: CampaignReport) => (
            <ReportBody
              report={loaded}
              channelLabel={channelLabel}
              num={num}
              language={language}
              undelivered={
                <UndeliveredSection
                  query={undelivered}
                  page={page}
                  onPageChange={setPage}
                  channelLabel={channelLabel}
                  num={num}
                />
              }
            />
          )}
        </QueryBoundary>
      </div>
    </Dialog>
  );
};

type ReportBodyProps = {
  report: CampaignReport;
  channelLabel: (channel: string) => string;
  num: (value: number) => string;
  language: string;
  undelivered: ReactNode;
};

const ReportBody = ({ report, channelLabel, num, language, undelivered }: ReportBodyProps) => {
  const { t } = useTranslation("notifications");
  const rows = report.byChannel;
  const { delivered } = report.stats;
  const cost = report.cost.estimated;

  /** «Yetkazildi» izohi: DLR kelgan — operator hisobotiga ko'ra; kutilmoqda; kanalda DLR yo'q. */
  const deliveredCaption =
    delivered !== null
      ? t("campaign.report.deliveredByDlr")
      : report.dlr.supported
        ? t("campaign.report.deliveredAwaiting")
        : t("campaign.report.deliveredNoDlr");
  /** Narx doim TAXMIN: bepul kanallar · tarif sozlanmagan · tarif × bo'laklar. */
  const costCaption = !report.cost.paidChannels.length
    ? t("campaign.report.costFree")
    : cost === null
      ? t("campaign.report.costNoTariff")
      : t("campaign.report.costEstimate");
  const failed = sumReportBucket(rows, "failed");
  const skipped = sumReportBucket(rows, "skipped");

  /** Izoh: bitta kanalda — «Push kanalida», bir nechtasida — «2 ta kanalda», yo'q — «yo'q». */
  const channelCaption = (bucket: "failed" | "skipped") => {
    const hit = rows.filter((row) => row[bucket] > 0);
    if (!hit.length) return t("campaign.report.none");
    if (hit.length > 1) return t("campaign.report.inChannels", { value: num(hit.length) });
    // O'tkazilganlar bitta sababdan bo'lsa — sababning o'zi («Push obunasi yo'q»).
    if (bucket === "skipped") {
      const statuses = Object.entries(hit[0].statuses).filter(
        ([status, n]) => n > 0 && deliveryBucket(status) === "skipped",
      );
      const key = statuses.length === 1 ? failureReasonKey(hit[0].channel, statuses[0][0], null) : null;
      if (key) return t(key);
    }
    return t("campaign.report.inChannel", { channel: channelLabel(hit[0].channel) });
  };

  const cell = (value: number) => (
    <span className={value ? "text-text" : "text-text-subtle"}>{num(value)}</span>
  );
  const columns: DataTableColumn<CampaignReportChannel>[] = [
    { id: "channel", header: t("campaign.report.channel"), cell: (row) => channelLabel(row.channel) },
    ...(["sent", "failed", "skipped", "pending"] as const).map(
      (bucket): DataTableColumn<CampaignReportChannel> => ({
        id: bucket,
        header: t(`campaign.report.col.${bucket}`),
        align: "end",
        cell: (row) => cell(row[bucket]),
      }),
    ),
  ];

  return (
    <>
      <div className="grid grid-cols-3 gap-2 max-md:grid-cols-2" data-testid="campaign-report-stats">
        <StatCard
          label={t("campaign.report.audience")}
          value={num(report.stats.audience)}
          hint={t("campaign.report.audienceCaption")}
        />
        <StatCard
          label={t("campaign.report.sent")}
          value={num(report.stats.sent)}
          hint={
            report.stats.pending
              ? t("campaign.report.pendingCaption", { value: num(report.stats.pending) })
              : t("campaign.report.sentCaption")
          }
        />
        <StatCard
          label={t("campaign.report.delivered")}
          // DLR hali kelmagan / kanalda yo'q — «—» (0 = «hammasi yiqildi» degan yolg'on signal).
          value={delivered === null ? "—" : num(delivered)}
          hint={deliveredCaption}
        />
        <StatCard label={t("campaign.report.failed")} value={num(failed)} hint={channelCaption("failed")} />
        <StatCard label={t("campaign.report.skipped")} value={num(skipped)} hint={channelCaption("skipped")} />
        <StatCard
          label={t("campaign.report.cost")}
          value={cost === null ? "—" : formatCompactMoneyLocalized(cost, { language, withCurrency: false })}
          unit={cost === null ? undefined : CURRENCY_LABEL[resolveMoneyLanguage(language)]}
          hint={costCaption}
        />
      </div>

      {rows.length ? (
        <section className="flex min-w-0 flex-col gap-2" aria-labelledby="campaign-report-channels">
          <span id="campaign-report-channels" className="text-[13px] font-semibold text-text">
            {t("campaign.report.byChannel")}
          </span>
          <DataTable
            rows={rows}
            columns={columns}
            getRowKey={(row) => row.channel}
            density="compact"
            label={t("campaign.report.byChannel")}
            cardsLabel={t("campaign.report.byChannel")}
            className={BOX}
            renderCard={(row) => (
              <div className="flex min-w-0 flex-col gap-0.5 px-3 py-2.5">
                <span className="text-sm font-semibold text-text">{channelLabel(row.channel)}</span>
                <span className="text-xs text-text-muted">
                  {t("campaign.report.channelLine", {
                    sent: num(row.sent),
                    failed: num(row.failed),
                    skipped: num(row.skipped),
                    pending: num(row.pending),
                  })}
                </span>
              </div>
            )}
          />
        </section>
      ) : null}

      {report.sms ? <SmsBlock sms={report.sms} num={num} language={language} /> : null}

      {undelivered}
    </>
  );
};

/**
 * SMS bloki (H7kpCman): xabarlar, bo'laklar (bitta xabarda min–max), kodlash (GSM-7 / UCS-2 — SMS kampaniyasida),
 * operator hisoboti (DLR: kelmagan bo'lsa — «hali kelmagan», 0 emas), bir bo'lak narxi va yuborilganlar narxi — doim
 * TAXMIN. Bildirishnoma kanallarida (`sms: null`) blok umuman chizilmaydi.
 */
const SmsBlock = ({ sms, num, language }: { sms: CampaignReportSms; num: (value: number) => string; language: string }) => {
  const { t } = useTranslation("notifications");
  const money = (value: number | null) => (value === null ? null : formatMoneyLocalized(value, { language }));
  const range = sms.partsPerMessage
    ? sms.partsPerMessage.min === sms.partsPerMessage.max
      ? num(sms.partsPerMessage.min)
      : `${num(sms.partsPerMessage.min)}–${num(sms.partsPerMessage.max)}`
    : null;
  const dlr = sms.dlr;
  const items: Array<[string, string]> = [
    [t("campaign.report.sms.messages"), t("campaign.confirm.count", { value: num(sms.messages) })],
    [
      t("campaign.report.sms.parts"),
      range
        ? t("campaign.report.sms.partsValue", { total: num(sms.partsTotal), range })
        : t("campaign.confirm.count", { value: num(sms.partsTotal) }),
    ],
    ...(sms.encoding
      ? ([
          [
            t("campaign.report.sms.encoding"),
            sms.encoding === "mixed" ? t("campaign.report.sms.encodingMixed") : sms.encoding,
          ],
        ] as Array<[string, string]>)
      : []),
    [
      t("campaign.report.sms.dlr"),
      dlr && dlr.final > 0
        ? t("campaign.report.sms.dlrValue", {
            delivered: num(dlr.delivered),
            failed: num(dlr.failed),
            awaiting: num(dlr.awaiting),
          })
        : t("campaign.report.sms.dlrNone", { value: num(dlr?.awaiting ?? 0) }),
    ],
    [t("campaign.report.sms.tariff"), money(sms.tariffPerPart) ?? t("campaign.report.sms.noTariff")],
    [t("campaign.report.sms.costOfSent"), money(sms.costOfSent) ?? "—"],
  ];

  return (
    <section className="flex min-w-0 flex-col gap-2" aria-labelledby="campaign-report-sms" data-testid="campaign-report-sms">
      <span id="campaign-report-sms" className="text-[13px] font-semibold text-text">
        {t("campaign.report.sms.title")}
      </span>
      <dl className={cx(BOX, "m-0 flex flex-col")}>
        {items.map(([label, value]) => (
          <div
            key={label}
            className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-t border-border px-3 py-2.5 first:border-t-0"
          >
            <dt className="text-[13px] text-text-muted">{label}</dt>
            <dd className="m-0 text-right text-[13px] font-semibold text-text tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="m-0 text-xs text-text-muted">{t("campaign.report.sms.costNote")}</p>
    </section>
  );
};

type UndeliveredSectionProps = {
  query: ReturnType<typeof useCampaignUndelivered>;
  page: number;
  onPageChange: (page: number) => void;
  channelLabel: (channel: string) => string;
  num: (value: number) => string;
};

const UndeliveredSection = ({ query, page, onPageChange, channelLabel, num }: UndeliveredSectionProps) => {
  const { t } = useTranslation("notifications");
  const { t: tUsers } = useTranslation("users");
  const data = query.data;
  const items = data?.items ?? [];
  const masked = items.some((item) => maskedPhone(item.phone));

  const failureLabel = (failure: CampaignUndeliveredFailure) =>
    t(isFailedStatus(failure.status) ? "campaign.report.failureFailed" : "campaign.report.failureSkipped", {
      channel: channelLabel(failure.channel),
    });

  const person = (item: CampaignUndeliveredItem) =>
    [
      item.role ? tUsers(getUserRoleLabelKey(item.role.split(",")[0]?.trim())) : null,
      // N9 (lkQiuyQu): telefon faqat maskalangan (`***7434`).
      maskedPhone(item.phone),
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <section className="flex min-w-0 flex-col gap-2" aria-labelledby="campaign-report-undelivered">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span id="campaign-report-undelivered" className="text-[13px] font-semibold text-text">
          {t("campaign.report.undelivered")}
        </span>
        {data && data.meta.total > 0 ? (
          <span className="text-xs text-text-muted">
            {t(masked ? "campaign.report.undeliveredRangeMasked" : "campaign.report.undeliveredRange", {
              total: num(data.meta.total),
              from: num((data.meta.page - 1) * data.meta.limit + 1),
              to: num((data.meta.page - 1) * data.meta.limit + items.length),
            })}
          </span>
        ) : null}
      </div>

      <QueryBoundary
        query={query}
        // Oldingi sahifa (shu kampaniya ichida) — `placeholderData`; boshqa kampaniyaniki ko'rinmaydi.
        keepPreviousData={false}
        isEmpty={(loaded) => loaded.items.length === 0}
        size="inline"
        loadingLabel={t("campaign.report.undeliveredLoading")}
        loading={<SkeletonList rows={3} />}
        error={(_, retry) => (
          <ErrorState
            kind="server"
            size="inline"
            title={t("campaign.report.undeliveredError")}
            onRetry={retry}
            retrying={query.isFetching}
          />
        )}
        empty={<EmptyState size="inline" icon={CircleCheck} title={t("campaign.report.undeliveredNone")} />}
      >
        {() => (
          <ul
            className={cx(BOX, "m-0 flex list-none flex-col p-0", query.isPlaceholderData && "opacity-60")}
            aria-busy={query.isPlaceholderData || undefined}
          >
            {items.map((item) => (
              <li
                key={item.ref_id || item.recipient_id}
                className="flex min-w-0 items-start gap-3 border-t border-border px-3 py-2.5 first:border-t-0"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-semibold text-text [overflow-wrap:anywhere]">
                    {item.name?.trim() || t("dispatch.undelivered.noName", { id: item.recipient_id ?? "—" })}
                  </span>
                  {person(item) ? <span className="text-xs text-text-muted">{person(item)}</span> : null}
                </div>
                <div className="flex min-w-0 flex-col items-end gap-1 text-right">
                  {item.failures.map((failure) => {
                    // N9: sabab — `reason_code` xaritasidan (xom provayder matni hech qachon ko'rsatilmaydi).
                    const reasonKey = failureReasonKey(
                      failure.channel,
                      failure.status,
                      failure.reason_code ?? failure.reason,
                    );
                    return (
                      <span key={`${failure.channel}-${failure.status}`} className="flex flex-col items-end gap-0.5">
                        <Badge tone={isFailedStatus(failure.status) ? "danger" : "neutral"}>
                          {failureLabel(failure)}
                        </Badge>
                        {reasonKey ? <span className="text-xs text-text-muted">{t(reasonKey)}</span> : null}
                      </span>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </QueryBoundary>

      {data && data.unlistedFailed > 0 ? (
        <p className="m-0 text-xs text-text-muted">
          {t("campaign.report.unlisted", { value: num(data.unlistedFailed), count: data.unlistedFailed })}
        </p>
      ) : null}

      {data && data.meta.totalPages > 1 ? (
        <Pagination
          page={page}
          pageSize={data.meta.limit}
          total={data.meta.total}
          onPageChange={onPageChange}
          disabled={query.isPlaceholderData}
          label={t("campaign.report.undeliveredPages")}
          // Oraliq sarlavhada bor («72 tadan 1–10») — takrorlanmaydi.
          summary={() => null}
        />
      ) : null}
    </section>
  );
};
