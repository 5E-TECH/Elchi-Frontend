// dizayn-v2: superadmin-integrations-panel-events, admin-integrations-conn-log
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  History,
  ChartColumn,
  CircleCheck,
  CircleX,
  Clock,
  Inbox,
  List,
  RefreshCw,
  Send,
  ShieldAlert,
  Wallet,
} from "lucide-react";
import { usePartnerActions, usePartnerWebhooks, type PartnerWebhookRow } from "../../../entities/partners";
import { useSyncHistory, type SyncHistoryRow } from "../../../entities/integrations/syncHistory";
import {
  INVALID_SIGNATURE_FILTER,
  useWebhookLogs,
  webhookOutcome,
  type WebhookLogRow,
} from "../../../entities/integrations/webhookLogs";
import { paymentOutcome, usePayments, type PaymentRow } from "../../../entities/integrations/payments";
import type { ConnectionMetrics } from "../../../entities/integrations/metrics";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { cx } from "../../../shared/lib/cx";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { CURRENCY_LABEL, formatMoneyLocalized, formatNumberLocalized, formatPercentLocalized } from "../../../shared/lib/formatMoney";
import { notify } from "../../../shared/lib/notify";
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  IconButton,
  Pagination,
  QueryBoundary,
  SegmentedControl,
  SkeletonTable,
  StatusBadge,
  type DataTableColumn,
  type Tone,
} from "../../../shared/ui/primitives";
import { useStatusLabel } from "../statusLabel";
import { ChartBlock, ColumnGrid, FilterChips, InlineAlert, LegendList, PanelSection, SectionHead, SegBar, SuccessGauge } from "../ui";
import type { Connection } from "../useConnections";

/**
 * HODISALAR — ulanish bo'yicha yetkazish tarixi (maket `*-panel-events`).
 *
 * IKKI MANBA — IKKI KO'RINISH, bitta jadval emas. Maydonlari umuman boshqa:
 *   inbound  (`partner`)     — BIZ yuborgan webhooklar: yetdimi, necha urinish, nega yiqildi
 *   outbound (`integration`) — onlayn to'lovlar / ular yuborgan webhooklar / biz tortgan sinxronlar
 *
 * ⚠️ BITTA VAQTDA BITTA JADVAL: tashqi tizimda ko'rinish almashtirgichi (`SegmentedControl`), faqat
 * tanlangan ro'yxat MOUNT bo'ladi — ekranda bitta «Yangilash» va bitta filtr qatori.
 *
 * «Soatlar bo'yicha» va «O'rtacha javob vaqti» trendi — «Taklif» (soatlik seriya API'da yo'q), chizilmaydi.
 */

/** YETKAZISH HOLATI — YAGONA MANBA: chip va jadval badge'i shu xaritadan (bir holat — bir yozuv). */
const STATUS_TAG: Record<string, { tone: Tone; labelKey: string }> = {
  completed: { tone: "success", labelKey: "deliveryDelivered" },
  pending: { tone: "warning", labelKey: "deliveryQueued" },
  processing: { tone: "warning", labelKey: "deliverySending" },
  awaiting_config: { tone: "info", labelKey: "deliveryAwaitingConfig" },
  permanently_failed: { tone: "danger", labelKey: "deliveryFailed" },
};

/** Eski antd rang nomi (`paymentOutcome` / `webhookOutcome`) → v2 ton. */
const toneOf = (color: string): Tone =>
  color === "green" ? "success" : color === "red" ? "danger" : color === "orange" || color === "gold" ? "warning" : color === "blue" ? "info" : "neutral";

const PAGE_SIZE = 20;

type LogView = "payments" | "inbound" | "outbound";

const ConnectionLog = ({ connection, metrics }: { connection: Connection; metrics?: ConnectionMetrics }) => {
  /** Hamkorda YAGONA ko'rinish bor (biz yuborgan hodisalar) — almashtirgich ko'rsatish shovqin bo'lardi. */
  if (connection.kind === "partner") return <InboundLog connection={connection} metrics={metrics} />;
  return <OutboundViews connection={connection} />;
};

/** Sahifalash qatori (panel ichida, chiziq bilan ajralgan). */
const PagerRow = ({
  page,
  pageSize,
  total,
  onPageChange,
  summaryKey,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  summaryKey: string;
}) => {
  const { t } = useTranslation("integrations");
  if (total <= 0) return null;
  return (
    <div className="border-t border-border px-5 py-3 max-md:px-4">
      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={onPageChange} summary={(range) => t(summaryKey, range)} />
    </div>
  );
};

const RefreshButton = ({ loading, onClick }: { loading: boolean; onClick: () => void }) => {
  const { t } = useTranslation("integrations");
  return (
    <>
      <Button variant="secondary" size="sm" leftIcon={RefreshCw} loading={loading} onClick={onClick} className="max-md:hidden">
        {t("refresh")}
      </Button>
      <IconButton variant="secondary" icon={RefreshCw} label={t("refresh")} loading={loading} onClick={onClick} className="md:hidden" />
    </>
  );
};

const OutboundViews = ({ connection }: { connection: Connection }) => {
  const { t } = useTranslation("integrations");
  const isPayment = connection.role === "payment";

  /**
   * Tartib ATAYLAB: to'lov tizimida operatorning birinchi savoli «qaysi to'lov keldi va nima bo'ldi?» —
   * shu bois pul ro'yxati birinchi.
   */
  const views = [
    ...(isPayment ? [{ value: "payments" as LogView, label: t("viewPayments"), icon: Wallet }] : []),
    { value: "inbound" as LogView, label: t("viewIncoming"), icon: Inbox },
    { value: "outbound" as LogView, label: t("viewSyncHistory"), icon: History },
  ];

  const [view, setView] = useState<LogView>(views[0].value);

  const switcher = (
    <SegmentedControl options={views} value={view} onValueChange={setView} ariaLabel={t("console.logViewAria")} fullWidth="phone" />
  );

  return (
    <div className="flex min-w-0 flex-col">
      {view === "payments" ? <PaymentLog connection={connection} switcher={switcher} /> : null}
      {view === "inbound" ? <IncomingWebhookLog connection={connection} switcher={switcher} /> : null}
      {view === "outbound" ? <OutboundLog connection={connection} switcher={switcher} /> : null}
    </div>
  );
};

/**
 * ONLAYN TO'LOVLAR (`payment_transactions`). ⚠️ PUL KASSAGA YOZILMAYDI (foydalanuvchi qarori,
 * 2026-09-13) — banner shuni aytadi, aks holda operator summani kompaniya balansida izlardi.
 */
/** So'mning ISO kodi (inglizcha valyuta yorlig'i bilan bir xil) — boshqa valyutadagi to'lov kodi bilan ko'rsatiladi. */
const BASE_CURRENCY_CODE = CURRENCY_LABEL.en;

const PaymentLog = ({ connection, switcher }: { connection: Connection; switcher: ReactNode }) => {
  const { t, i18n } = useTranslation("integrations");
  const language = i18n.language;
  const [unapplied, setUnapplied] = useState<"all" | "unapplied">("all");
  const [page, setPage] = useState(1);

  const payments = usePayments({ integrationId: connection.id, unappliedOnly: unapplied === "unapplied", page, limit: PAGE_SIZE }, { silentError: true });
  const rows = payments.data?.items ?? [];
  const meta = payments.data?.meta;

  const orderCell = (r: PaymentRow) =>
    r.order_id ? (
      <span className="font-semibold">№{r.order_id}</span>
    ) : (
      /* Bog'lanmagan to'lov — havola nima kelganini ko'rsatamiz, aks holda qaysi to'lov ekani topilmaydi. */
      <span className="text-danger-fg">{r.order_ref ? `? ${r.order_ref}` : t("console.unlinked")}</span>
    );
  const outcomeBadge = (r: PaymentRow) => {
    const outcome = paymentOutcome(r);
    return <StatusBadge tone={toneOf(outcome.color)} label={t(outcome.labelKey)} />;
  };
  const txText = (r: PaymentRow) => `${r.provider_transaction_id}${r.provider_status ? ` · ${r.provider_status}` : ""}`;

  const columns: DataTableColumn<PaymentRow>[] = [
    { id: "time", header: t("colTime"), cell: (r) => <span className="whitespace-nowrap">{formatDateTimeLocalized(r.createdAt, { language })}</span> },
    {
      id: "amount",
      header: t("colAmount"),
      align: "end",
      cell: (r) => (
        <span className="font-semibold">
          {r.currency && r.currency !== BASE_CURRENCY_CODE
            ? `${formatNumberLocalized(r.amount, { language })} ${r.currency}`
            : formatMoneyLocalized(r.amount, { language })}
        </span>
      ),
    },
    { id: "order", header: t("colOrder"), cell: orderCell },
    { id: "outcome", header: t("colOutcome"), cell: outcomeBadge },
    { id: "tx", header: t("colTransaction"), hideBelow: "lg", cell: (r) => <span className="break-all font-mono text-xs text-text-muted">{txText(r)}</span> },
  ];

  return (
    <>
      <PanelSection>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {switcher}
          <RefreshButton loading={payments.isFetching} onClick={() => void payments.refetch()} />
        </div>
        <InlineAlert tone="warning">{t("console.paymentsNotCashbox")}</InlineAlert>
        <FilterChips
          ariaLabel={t("console.outcomeFilterAria")}
          value={unapplied}
          onChange={(v) => {
            setUnapplied(v);
            setPage(1);
          }}
          options={[
            { value: "all", label: t("filterAll"), count: unapplied === "all" ? meta?.total : undefined },
            { value: "unapplied", label: t("filterUnapplied"), icon: CircleX },
          ]}
        />
      </PanelSection>
      <QueryBoundary
        query={{ data: payments.data ? rows : undefined, isLoading: payments.isLoading, isError: payments.isError, error: payments.error, refetch: payments.refetch }}
        loading={<SkeletonTable framed={false} rows={4} columns={[t("colTime"), t("colAmount"), t("colOrder"), t("colOutcome")]} />}
        empty={<EmptyState icon={Wallet} title={t("console.paymentsEmpty")} />}
        error={(error, retry) => <ErrorState error={error} title={t("console.logError")} onRetry={retry} />}
        className="border-t border-border"
      >
        {(list, { isRefetching }) => (
          <DataTable
            rows={list}
            columns={columns}
            getRowKey={(r) => String(r.id)}
            label={t("viewPayments")}
            busy={isRefetching}
            renderCard={(r) => (
              <div className="flex min-w-0 flex-col gap-1.5 px-4 py-3">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{formatMoneyLocalized(r.amount, { language })}</span>
                  {outcomeBadge(r)}
                </span>
                <span className="text-xs text-text-muted">
                  {orderCell(r)} · {formatDateTimeLocalized(r.createdAt, { language })}
                </span>
                <span className="break-all text-xs text-text-muted">
                  {t("colTransaction")} {txText(r)}
                </span>
              </div>
            )}
          />
        )}
      </QueryBoundary>
      <PagerRow page={meta?.page ?? page} pageSize={meta?.limit ?? PAGE_SIZE} total={meta?.total ?? 0} onPageChange={setPage} summaryKey="console.paymentsRange" />
    </>
  );
};

/**
 * ULAR BIZGA yuborgan webhooklar (`provider_webhook_logs`). Tana ko'rsatilmaydi — serverdan ham
 * qaytmaydi: ichida mijozning telefoni va manzili bo'ladi.
 */
const IncomingWebhookLog = ({ connection, switcher }: { connection: Connection; switcher: ReactNode }) => {
  const { t, i18n } = useTranslation("integrations");
  const language = i18n.language;
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const logs = useWebhookLogs({ integrationId: connection.id, status, page, limit: PAGE_SIZE }, { silentError: true });
  const rows = logs.data?.items ?? [];
  const meta = logs.data?.meta;
  const counts = logs.data?.counts;

  const outcomeBadge = (r: WebhookLogRow) => {
    /* `status` faqat uch qiymatni biladi — operator uchun muhim savol «NIMA bo'ldi», shuning uchun natija `error` ichidan. */
    const outcome = webhookOutcome(r);
    return <StatusBadge tone={toneOf(outcome.color)} label={t(outcome.labelKey)} />;
  };

  const columns: DataTableColumn<WebhookLogRow>[] = [
    { id: "time", header: t("colTime"), cell: (r) => <span className="whitespace-nowrap">{formatDateTimeLocalized(r.createdAt, { language })}</span> },
    { id: "event", header: t("colEvent"), cell: (r) => <span>{r.event_type || "—"}</span> },
    { id: "outcome", header: t("colOutcome"), cell: outcomeBadge },
    {
      id: "reason",
      header: t("colReason"),
      cell: (r) => (r.error ? <span className="[overflow-wrap:anywhere] text-[13px] text-text-muted">{r.error}</span> : <span className="text-text-muted">—</span>),
    },
  ];

  const all = counts?.all ?? 0;
  const share = (value?: number | null) => (all > 0 && value != null ? formatPercentLocalized((value / all) * 100, { language }) : null);

  return (
    <>
      <PanelSection>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {switcher}
          <RefreshButton loading={logs.isFetching} onClick={() => void logs.refetch()} />
        </div>
        {/* Sanoqlar bitta agregat so'rovdan; kelmasa chip sanoqsiz (0 emas). */}
        <FilterChips
          ariaLabel={t("console.outcomeFilterAria")}
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          options={[
            { value: "all", label: t("filterAll"), count: counts?.all ?? (status === "all" ? meta?.total : undefined) },
            { value: "processed", label: t("filterApplied"), count: counts?.processed, icon: CircleCheck },
            { value: "rejected", label: t("filterRejected"), count: counts?.rejected, icon: CircleX, countTone: "danger" },
            { value: INVALID_SIGNATURE_FILTER, label: t("filterInvalidSignature"), count: counts?.invalid_signature, icon: ShieldAlert, countTone: "danger" },
          ]}
        />
        {counts && all > 0 ? (
          <div className="flex flex-col gap-2">
            <SegBar
              ariaLabel={t("console.webhooksAria", {
                count: formatNumberLocalized(all, { language }),
                applied: formatNumberLocalized(counts.processed ?? 0, { language }),
                rejected: formatNumberLocalized(counts.rejected ?? 0, { language }),
                invalid: formatNumberLocalized(counts.invalid_signature ?? 0, { language }),
              })}
              /* Bo'laklar `status` bo'yicha (bir-birini kesmaydi): imzo xatosi rad etilganlarning ICHIDA — alohida
                 bo'lak qilinsa jami 100% dan oshardi; uning soni chipda. */
              parts={[
                { value: counts.processed ?? 0, className: "bg-success" },
                { value: counts.rejected ?? 0, className: "bg-danger" },
              ]}
            />
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
              <li className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="size-2.5 rounded-[3px] bg-success" />{t("filterApplied")} · {share(counts.processed)}</li>
              <li className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="size-2.5 rounded-[3px] bg-danger" />{t("filterRejected")} · {share(counts.rejected)}</li>
            </ul>
          </div>
        ) : null}
      </PanelSection>
      <QueryBoundary
        query={{ data: logs.data ? rows : undefined, isLoading: logs.isLoading, isError: logs.isError, error: logs.error, refetch: logs.refetch }}
        loading={<SkeletonTable framed={false} rows={4} columns={[t("colTime"), t("colEvent"), t("colOutcome"), t("colReason")]} />}
        empty={<EmptyState icon={Inbox} title={t("console.webhooksEmpty")} />}
        error={(error, retry) => <ErrorState error={error} title={t("console.logError")} onRetry={retry} />}
        className="border-t border-border"
      >
        {(list, { isRefetching }) => (
          <DataTable
            rows={list}
            columns={columns}
            getRowKey={(r) => String(r.id)}
            label={t("viewIncoming")}
            busy={isRefetching}
            renderCard={(r) => (
              <div className="flex min-w-0 flex-col gap-1.5 px-4 py-3">
                <span className="font-semibold">{r.event_type || "—"}</span>
                <span className="flex flex-wrap items-center gap-2">
                  {outcomeBadge(r)}
                  <span className="text-xs text-text-muted">{formatDateTimeLocalized(r.createdAt, { language })}</span>
                </span>
                {r.error ? <span className="[overflow-wrap:anywhere] text-xs text-text-muted">{r.error}</span> : null}
              </div>
            )}
          />
        )}
      </QueryBoundary>
      <PagerRow page={meta?.page ?? page} pageSize={meta?.limit ?? PAGE_SIZE} total={meta?.total ?? 0} onPageChange={setPage} summaryKey="console.webhooksRange" />
    </>
  );
};

/** BIZ yuborgan webhooklar (`partner_webhook_outbox`). */
const InboundLog = ({ connection, metrics }: { connection: Connection; metrics?: ConnectionMetrics }) => {
  const { t, i18n } = useTranslation("integrations");
  const language = i18n.language;
  const num = (value: number) => formatNumberLocalized(value, { language });
  const statusLabel = useStatusLabel();
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const webhooks = usePartnerWebhooks({ partner_id: connection.id, status, page, limit: PAGE_SIZE }, { silentError: true });
  const { retryWebhook } = usePartnerActions();
  const rows = webhooks.data?.data ?? [];

  const retry = async (id: string) => {
    try {
      await retryWebhook.mutateAsync(id);
      notify.success(t("logRequeued"));
    } catch (error) {
      notify.error(getBackendErrorMessage(error) || t("logRetryFailed"));
    }
  };

  /**
   * ⚠️ O'ZGARUVCHI NOMI `tag`, `t` EMAS — i18n funksiyasini SOYA QILMASIN.
   */
  const statusBadge = (r: PartnerWebhookRow) => {
    const tag = STATUS_TAG[r.status];
    return <StatusBadge tone={tag?.tone ?? "neutral"} label={tag ? t(tag.labelKey) : r.status} />;
  };
  const eventText = (r: PartnerWebhookRow) => (r.new_status ? statusLabel(r.new_status) : r.event_type || "—");
  const orderNo = (r: PartnerWebhookRow) => (r.order_id ? `№${r.order_id}` : "");
  const retryButton = (r: PartnerWebhookRow, iconOnly: boolean) =>
    r.status === "completed" ? (
      <span className="text-xs text-text-subtle">
        <span aria-hidden="true">—</span>
        <span className="sr-only">{t("console.noActionNeeded")}</span>
      </span>
    ) : iconOnly ? (
      <IconButton
        variant="secondary"
        icon={RefreshCw}
        label={t("console.retryEventAria", { order: orderNo(r) || r.external_order_id })}
        loading={retryWebhook.isPending && retryWebhook.variables === String(r.id)}
        onClick={() => void retry(String(r.id))}
      />
    ) : (
      <Button
        variant="secondary"
        size="sm"
        leftIcon={RefreshCw}
        title={t("logRetryTip")}
        aria-label={t("console.retryEventAria", { order: orderNo(r) || r.external_order_id })}
        loading={retryWebhook.isPending && retryWebhook.variables === String(r.id)}
        onClick={() => void retry(String(r.id))}
      >
        {t("logRetryBtn")}
      </Button>
    );

  const columns: DataTableColumn<PartnerWebhookRow>[] = [
    { id: "time", header: t("colTime"), cell: (r) => <span className="whitespace-nowrap">{formatDateTimeLocalized(r.created_at, { language })}</span> },
    { id: "status", header: t("colStatus"), cell: statusBadge },
    { id: "attempts", header: t("colAttempt"), align: "end", hideBelow: "lg", cell: (r) => <span className="tabular-nums">{num(r.attempts ?? 0)}</span> },
    {
      id: "event",
      header: t("colEvent"),
      cell: (r) => (
        <div className="flex min-w-0 flex-col">
          <span>
            {eventText(r)} <span className="font-semibold">{orderNo(r)}</span>
          </span>
          <span className="font-mono text-xs text-text-muted lg:hidden">{r.external_order_id}</span>
        </div>
      ),
    },
    { id: "order", header: t("colOrder"), hideBelow: "lg", cell: (r) => <span className="font-mono text-[13px]">{r.external_order_id || "—"}</span> },
    {
      id: "error",
      header: t("colError"),
      /* Xato matni MUHIM: «yetkazilmadi» o'zi sababni aytmaydi. */
      cell: (r) =>
        r.last_error ? (
          <span title={r.last_error} className="line-clamp-2 max-w-[320px] [overflow-wrap:anywhere] text-[13px] text-danger-fg">
            {r.last_error}
          </span>
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
    { id: "action", header: t("colAction"), cell: (r) => retryButton(r, false) },
  ];

  /* ── «Natija · 24 soat» — metrikadan (bitta so'rov, konsol bilan AYNI raqam). ── */
  const delivered = metrics?.delivered ?? 0;
  const queued = metrics?.queued ?? 0;
  const failed = metrics?.failed ?? 0;
  const total = delivered + queued + failed;
  const share = (value: number) => formatPercentLocalized(total > 0 ? (value / total) * 100 : 0, { language });

  return (
    <>
      <PanelSection>
        <SectionHead
          title={t("console.sentEventsTitle")}
          icon={Send}
          actions={<RefreshButton loading={webhooks.isFetching} onClick={() => void webhooks.refetch()} />}
        />
      </PanelSection>
      {metrics ? (
        <ColumnGrid>
          <ChartBlock
            title={t("console.resultTitle")}
            subtitle={t("console.eventsCount", { count: num(metrics.events) })}
          >
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-[28px] leading-9 font-bold text-text proportional-nums">
                {metrics.success_rate == null ? "—" : formatNumberLocalized(metrics.success_rate, { language, fractionDigits: 1 })}
                {metrics.success_rate == null ? null : <span className="ml-1 text-sm font-semibold text-text-muted">%</span>}
              </span>
              <span className="text-[13px] text-text-muted">{t("console.successWord")}</span>
            </p>
            <SegBar
              ariaLabel={t("console.segAria", { count: num(total), delivered: num(delivered), queued: num(queued), failed: num(failed) })}
              parts={[
                { value: delivered, className: "bg-success" },
                { value: queued, className: "bg-warning" },
                { value: failed, className: "bg-danger" },
              ]}
            />
            <LegendList
              ariaLabel={t("console.mixLegendAria")}
              rows={[
                { key: "d", keyClassName: "bg-success", label: t("deliveryDelivered"), value: t("console.countTa", { count: num(delivered) }), share: share(delivered) },
                { key: "q", keyClassName: "bg-warning", label: t("deliveryQueued"), value: t("console.countTa", { count: num(queued) }), share: share(queued) },
                { key: "f", keyClassName: "bg-danger", label: t("deliveryFailed"), value: t("console.countTa", { count: num(failed) }), share: share(failed) },
              ]}
            />
          </ChartBlock>
        </ColumnGrid>
      ) : null}
      <PanelSection className="pb-4">
        <FilterChips
          ariaLabel={t("console.deliveryFilterAria")}
          value={status}
          onChange={(v) => {
            setStatus(v);
            // Filtr o'zgarganda sahifa boshiga — aks holda 3-sahifada turib filtr almashsa bo'sh ro'yxat ko'rinardi.
            setPage(1);
          }}
          options={[
            { value: "all", label: t("filterAll") },
            { value: "completed", label: t(STATUS_TAG.completed.labelKey), icon: CircleCheck },
            { value: "pending", label: t(STATUS_TAG.pending.labelKey), icon: Clock },
            { value: "awaiting_config", label: t(STATUS_TAG.awaiting_config.labelKey), icon: ShieldAlert },
            { value: "permanently_failed", label: t(STATUS_TAG.permanently_failed.labelKey), icon: CircleX },
          ]}
        />
      </PanelSection>
      <QueryBoundary
        query={{ data: webhooks.data ? rows : undefined, isLoading: webhooks.isLoading, isError: webhooks.isError, error: webhooks.error, refetch: webhooks.refetch }}
        loading={<SkeletonTable framed={false} rows={4} columns={[t("colTime"), t("colStatus"), t("colEvent"), t("colError")]} />}
        empty={<EmptyState icon={History} title={t("console.sentEventsEmpty")} />}
        error={(error, retryQuery) => <ErrorState error={error} title={t("console.logError")} onRetry={retryQuery} />}
        className="border-t border-border"
      >
        {(list, { isRefetching }) => (
          <DataTable
            rows={list}
            columns={columns}
            getRowKey={(r) => String(r.id)}
            label={t("console.sentEventsTitle")}
            density="tablet-tight"
            busy={isRefetching}
            renderCard={(r) => (
              <div className="flex min-w-0 items-start gap-3 px-4 py-3">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="font-semibold">{eventText(r)}</span>
                  <span className="flex flex-wrap items-center gap-2">
                    {statusBadge(r)}
                    <span className="text-xs text-text-muted">
                      {[orderNo(r), r.external_order_id, formatDateTimeLocalized(r.created_at, { language }), t("console.attemptsShort", { count: num(r.attempts ?? 0) })]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  {r.last_error ? <span className={cx("[overflow-wrap:anywhere] text-xs text-danger-fg")}>{r.last_error}</span> : null}
                </div>
                {r.status === "completed" ? null : <div className="flex-none">{retryButton(r, true)}</div>}
              </div>
            )}
          />
        )}
      </QueryBoundary>
      <PagerRow
        page={webhooks.data?.page ?? page}
        pageSize={webhooks.data?.limit || PAGE_SIZE}
        total={webhooks.data?.total ?? 0}
        onPageChange={setPage}
        summaryKey="console.eventsRange"
      />
    </>
  );
};

/** «Oxirgi 12 sinxron» — har sinxronda tortilgan buyurtmalar (Grafik | Jadval). */
const SyncBars = ({ rows }: { rows: SyncHistoryRow[] }) => {
  const { t, i18n } = useTranslation("integrations");
  const language = i18n.language;
  const [mode, setMode] = useState<"chart" | "table">("chart");
  // Ro'yxat yangisidan boshlanadi — grafik chapdan o'ngga vaqt bo'yicha.
  const last = rows.slice(0, 12).reverse();
  const max = Math.max(1, ...last.map((r) => Number(r.synced_orders) || 0));
  const timeOf = (r: SyncHistoryRow) => {
    const ms = typeof r.sync_date === "string" ? Number(r.sync_date) : r.sync_date;
    return ms ? formatDateTimeLocalized(ms, { language }) : "—";
  };
  return (
    <ChartBlock
      title={t("console.syncBarsTitle")}
      subtitle={t("console.syncBarsSub")}
      controls={
        <SegmentedControl
          size="sm"
          ariaLabel={t("console.syncBarsViewAria")}
          value={mode}
          onValueChange={setMode}
          options={[
            { value: "chart", label: t("console.viewChart"), icon: ChartColumn },
            { value: "table", label: t("console.viewTable"), icon: List },
          ]}
        />
      }
    >
      {mode === "chart" ? (
        <>
          <div
            role="img"
            aria-label={t("console.syncBarsAria", { count: last.length, failed: last.filter((r) => r.status === "failed").length })}
            className="flex h-36 items-end gap-1.5 border-b border-border"
          >
            {last.map((r) => (
              <span
                key={String(r.id)}
                title={`${timeOf(r)} — ${t("console.countOrders", { count: formatNumberLocalized(r.synced_orders, { language }) })}`}
                className={cx("block min-w-0 max-w-6 flex-1 rounded-t-[4px]", r.status === "failed" ? "bg-danger" : "bg-chart-1")}
                style={{ height: `${Math.max(4, ((Number(r.synced_orders) || 0) / max) * 100)}%` }}
              />
            ))}
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
            <li className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="size-2.5 rounded-[3px] bg-chart-1" />{t("console.syncPulled")}</li>
            <li className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="size-2.5 rounded-[3px] bg-danger" />{t("console.syncFailedOne")}</li>
          </ul>
        </>
      ) : (
        <ul className="flex flex-col text-[13px]">
          {last.map((r) => (
            <li key={String(r.id)} className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-b-0">
              <span className="text-text">{timeOf(r)}</span>
              <span className={cx("font-semibold", r.status === "failed" ? "text-danger-fg" : "text-text")}>
                {t("console.countOrders", { count: formatNumberLocalized(r.synced_orders, { language }) })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </ChartBlock>
  );
};

/** BIZ tortib olgan sinxronlar (`sync_history`). */
const OutboundLog = ({ connection, switcher }: { connection: Connection; switcher: ReactNode }) => {
  const { t, i18n } = useTranslation("integrations");
  const language = i18n.language;
  const num = (value: number) => formatNumberLocalized(value, { language });
  const [status, setStatus] = useState("all");
  const history = useSyncHistory({ integrationId: connection.id, status, limit: PAGE_SIZE }, { silentError: true });

  const rows = history.data?.items ?? [];
  const summary = history.data?.summary;
  /**
   * ⚠️ Urinish bo'lmasa backend `success_rate: 0` qaytaradi. `0%` deb ko'rsatish «hammasi yiqildi» degan
   * YOLG'ON bo'lardi — aslida hali urinish yo'q.
   */
  const measured = Boolean(summary && summary.total_attempts > 0);
  const rate = measured ? summary!.success_rate : null;

  const statusBadge = (r: SyncHistoryRow) =>
    r.status === "success" ? (
      <StatusBadge tone="success" label={t("filterSuccess")} />
    ) : r.status === "failed" ? (
      <StatusBadge tone="danger" label={t("console.syncFailed")} />
    ) : (
      <StatusBadge tone="neutral" label={t("console.unknown")} />
    );
  /* Xato `result` JSON ichida bo'lishi mumkin — «yiqildi» so'zi o'zi sababni aytmaydi. */
  const resultText = (r: SyncHistoryRow) =>
    r.status === "failed" && r.result
      ? typeof r.result.error === "string"
        ? r.result.error
        : JSON.stringify(r.result).slice(0, 200)
      : null;
  const timeOf = (r: SyncHistoryRow) => {
    const ms = typeof r.sync_date === "string" ? Number(r.sync_date) : r.sync_date;
    return ms ? formatDateTimeLocalized(ms, { language }) : "—";
  };

  const columns: DataTableColumn<SyncHistoryRow>[] = [
    { id: "time", header: t("colTime"), cell: (r) => <span className="whitespace-nowrap">{timeOf(r)}</span> },
    { id: "status", header: t("colStatus"), cell: statusBadge },
    { id: "orders", header: t("colOrder"), align: "end", cell: (r) => <span>{t("console.countTa", { count: num(r.synced_orders) })}</span> },
    {
      id: "result",
      header: t("colOutcome"),
      cell: (r) => {
        const text = resultText(r);
        return text ? <span className="[overflow-wrap:anywhere] text-[13px] text-danger-fg">{text}</span> : <span className="text-text-muted">—</span>;
      },
    },
  ];

  return (
    <>
      <PanelSection>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {switcher}
          <RefreshButton loading={history.isFetching} onClick={() => void history.refetch()} />
        </div>
        <FilterChips
          ariaLabel={t("console.statusFilterAria")}
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: t("filterAll"), count: summary?.total_attempts },
            { value: "success", label: t("filterSuccess"), count: summary?.success_count, icon: CircleCheck },
            { value: "failed", label: t("filterFailed"), count: summary?.failed_count, icon: CircleX, countTone: "danger" },
          ]}
        />
      </PanelSection>
      {measured && summary ? (
        <ColumnGrid>
          <ChartBlock title={t("console.syncRateTitle")} subtitle={t("console.syncRateSub", { count: num(summary.total_attempts) })}>
            <SuccessGauge
              value={rate}
              valueText={formatPercentLocalized(rate ?? 0, { language })}
              label={t("console.syncRateLabel")}
              badge={
                <Badge tone={(rate ?? 0) >= 70 ? "success" : (rate ?? 0) >= 40 ? "warning" : "danger"}>
                  {t((rate ?? 0) >= 70 ? "console.zoneGood" : (rate ?? 0) >= 40 ? "console.zoneMid" : "console.zoneLow")}
                </Badge>
              }
              ariaLabel={t("console.syncRateAria", {
                rate: formatPercentLocalized(rate ?? 0, { language }),
                total: num(summary.total_attempts),
                ok: num(summary.success_count),
                failed: num(summary.failed_count),
              })}
              stats={[
                { key: "ok", tone: "success", icon: <CircleCheck size={16} aria-hidden="true" />, value: t("console.countTa", { count: num(summary.success_count) }), label: t("filterSuccess") },
                { key: "failed", tone: "danger", icon: <CircleX size={16} aria-hidden="true" />, value: t("console.countTa", { count: num(summary.failed_count) }), label: t("filterFailed") },
              ]}
            />
          </ChartBlock>
          {rows.length > 0 ? <SyncBars rows={rows} /> : null}
        </ColumnGrid>
      ) : null}
      <QueryBoundary
        query={{ data: history.data ? rows : undefined, isLoading: history.isLoading, isError: history.isError, error: history.error, refetch: history.refetch }}
        loading={<SkeletonTable framed={false} rows={4} columns={[t("colTime"), t("colStatus"), t("colOrder"), t("colOutcome")]} />}
        empty={<EmptyState icon={History} title={t("console.syncEmpty")} />}
        error={(error, retry) => <ErrorState error={error} title={t("console.logError")} onRetry={retry} />}
        className="border-t border-border"
      >
        {(list, { isRefetching }) => (
          <DataTable
            rows={list}
            columns={columns}
            getRowKey={(r) => String(r.id)}
            label={t("viewSyncHistory")}
            busy={isRefetching}
            renderCard={(r) => (
              <div className="flex min-w-0 flex-col gap-1.5 px-4 py-3">
                <span className="font-semibold">{timeOf(r)}</span>
                <span className="flex flex-wrap items-center gap-2">
                  {statusBadge(r)}
                  <span className="text-xs text-text-muted">{t("console.countOrders", { count: num(r.synced_orders) })}</span>
                </span>
                {resultText(r) ? <span className="[overflow-wrap:anywhere] text-xs text-danger-fg">{resultText(r)}</span> : null}
              </div>
            )}
          />
        )}
      </QueryBoundary>
    </>
  );
};

export default ConnectionLog;
