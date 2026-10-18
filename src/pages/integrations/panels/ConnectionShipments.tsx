// dizayn-v2: superadmin-integrations-panel-shipments, admin-integrations-conn-shipments
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { CircleCheck, Clock, GitCompareArrows, Package, RefreshCw, Send, TriangleAlert, Truck } from "lucide-react";
import type { RootState } from "../../../app/config/store";
import { OrderStatusBadge } from "../../../entities/order";
import {
  usePartnerShipments,
  useProviderShipments,
  useRedispatch,
  type PartnerShipmentRow,
  type ProviderShipmentRow,
  type ShipmentCounts,
  type ShipmentFilter,
} from "../../../entities/integrations/shipments";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { cx } from "../../../shared/lib/cx";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatMoneyLocalized, formatNumberLocalized, formatPercentLocalized } from "../../../shared/lib/formatMoney";
import { formatPhone } from "../../../shared/lib/formatPhone";
import { notify } from "../../../shared/lib/notify";
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  IconButton,
  Pagination,
  QueryBoundary,
  SkeletonTable,
  type DataTableColumn,
} from "../../../shared/ui/primitives";
import { ChartBlock, ColumnGrid, FilterChips, InlineAlert, LegendList, PanelSection, SectionHead, SegBar } from "../ui";
import type { Connection } from "../useConnections";

/**
 * POSILKALAR — ulanish bo'yicha posilkalar (maket `*-panel-shipments`).
 *
 *   Tashuvchi: «Posilkalar oqimi» (jami → yuborildi → tashuvchida → yetkazildi) + «Posilkalar holati»
 *   (ulush) — ikkalasi ham ro'yxat sanoqlaridan (`counts`, bitta agregat so'rov; kelmasa chizilmaydi) →
 *   chiplar (sonli) + «Yangilash» → jadval (xatoli qator ostida «Xato: …» + «Qayta jo'natish») → sahifalash.
 *   Hamkor: «Bu ro'yxat bog'lanishni ko'rsatadi» + «Kelgan posilkalar» (Ularning raqami / Bizdagi buyurtma / Kelgan vaqt).
 *
 * NEGA KERAK BO'LDI. Ma'lumot bazada bor edi (`provider_shipments`), lekin ko'rish yo'li yo'q edi — «qaysi
 * posilka yetmadi?» degan savolga javob uchun buyurtmalarni bittalab ochib chiqish kerak edi.
 */

/** Buyurtma tafsiloti sahifasi (`/orders/edit/:orderId`; `/orders/:id` marshruti yo'q). */
const orderHref = (orderId: string | number) => `/orders/edit/${orderId}`;
/** Buyurtma havolasi; telefonda (kartalar) bosiladigan balandlik 44 px. */
const ORDER_LINK = "font-semibold text-text hover:text-action-fg hover:underline max-md:inline-flex max-md:min-h-11 max-md:items-center";

/**
 * Mijoz telefoni jurnal ekraniga chiqadi — faqat superadmin/admin to'liq ko'radi (endpoint ham shu
 * rollarga ochiq); boshqa rolda oxirgi 4 raqam.
 */
const PHONE_ROLES = new Set(["superadmin", "admin"]);
const maskPhone = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 4 ? `*** ${digits.slice(-4)}` : "***";
};

const PAGE_SIZE = 20;

const ConnectionShipments = ({ connection }: { connection: Connection }) =>
  connection.kind === "partner" ? <PartnerShipments connection={connection} /> : <ProviderShipments connection={connection} />;

/** «Posilkalar oqimi» + «Posilkalar holati» — faqat sanoqlar kelganda (eski backendda chizilmaydi). */
const ShipmentCharts = ({ counts }: { counts: ShipmentCounts }) => {
  const { t, i18n } = useTranslation("integrations");
  const language = i18n.language;
  const num = (value: number) => formatNumberLocalized(value, { language });
  const pct = (value: number) => formatPercentLocalized(value, { language });
  const all = counts.all;
  if (!all) return null;
  const sent = Math.max(0, all - counts.not_sent);
  const carrier = Math.max(0, sent - counts.failed);
  const delivered = Math.min(counts.delivered, carrier);
  const other = Math.max(0, carrier - delivered);
  const share = (value: number, of: number) => (of > 0 ? pct((value / of) * 100) : pct(0));

  const steps = [
    { key: "all", label: t("console.flowAll"), value: all, bar: "bg-chart-1", note: t("console.flowNotSent", { share: share(sent, all), count: num(counts.not_sent) }) },
    { key: "sent", label: t("console.flowSent"), value: sent, bar: "bg-chart-1/80", note: t("console.flowRejected", { share: share(carrier, sent), count: num(counts.failed) }) },
    { key: "carrier", label: t("console.flowCarrier"), value: carrier, bar: "bg-chart-1/60", note: t("console.flowOther", { share: share(delivered, carrier), count: num(other) }) },
    { key: "delivered", label: t("console.flowDelivered"), value: delivered, bar: "bg-chart-1/40", note: null },
  ];

  return (
    <ColumnGrid basis={420}>
      <ChartBlock title={t("console.flowTitle")} subtitle={t("console.flowSub")}>
        <ol
          aria-label={t("console.flowAria", { all: num(all), sent: num(sent), carrier: num(carrier), delivered: num(delivered) })}
          className="flex flex-col gap-1"
        >
          {steps.map((step) => (
            <li key={step.key} className="flex flex-col gap-1">
              <div className="grid grid-cols-[minmax(84px,22%)_minmax(0,1fr)_auto] items-center gap-3 text-[13px]">
                <span className="truncate text-text">{step.label}</span>
                <span className="flex min-w-0 justify-center">
                  <span
                    aria-hidden="true"
                    className={cx("block h-6 rounded-[4px]", step.bar)}
                    style={{ width: `${Math.max(4, (step.value / all) * 100)}%` }}
                  />
                </span>
                <span className="whitespace-nowrap text-right font-semibold text-text tabular-nums">
                  {t("console.countTa", { count: num(step.value) })}
                </span>
              </div>
              {step.note ? <p className="pl-[calc(22%+12px)] text-xs text-text-muted max-md:pl-0">↓ {step.note}</p> : null}
            </li>
          ))}
        </ol>
        {counts.mismatch ? (
          <p className="flex items-start gap-2 text-xs text-text-muted">
            <TriangleAlert size={14} aria-hidden="true" className="mt-px shrink-0" />
            {t("console.flowMismatch", { count: num(counts.mismatch) })}
          </p>
        ) : null}
      </ChartBlock>
      <ChartBlock title={t("console.stateTitle")} subtitle={t("console.stateSub", { count: num(all) })}>
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-[28px] leading-9 font-bold text-text proportional-nums">
            {formatNumberLocalized((delivered / all) * 100, { language, fractionDigits: 1 })}
            <span className="ml-1 text-sm font-semibold text-text-muted">%</span>
          </span>
          <span className="text-[13px] text-text-muted">{t("console.stateDelivered", { all: num(all), count: num(delivered) })}</span>
        </p>
        <SegBar
          size="lg"
          ariaLabel={t("console.stateAria", {
            all: num(all),
            delivered: num(delivered),
            other: num(other),
            notSent: num(counts.not_sent),
            failed: num(counts.failed),
          })}
          parts={[
            { value: delivered, className: "bg-success" },
            { value: other, className: "bg-chart-muted" },
            { value: counts.not_sent, className: "bg-warning" },
            { value: counts.failed, className: "bg-danger" },
          ]}
        />
        <LegendList
          ariaLabel={t("console.stateLegendAria")}
          rows={[
            { key: "d", keyClassName: "bg-success", icon: <CircleCheck size={14} aria-hidden="true" className="shrink-0 text-text-muted" />, label: t("deliveryDelivered"), value: t("console.countTa", { count: num(delivered) }), share: share(delivered, all) },
            { key: "o", keyClassName: "bg-chart-muted", icon: <Truck size={14} aria-hidden="true" className="shrink-0 text-text-muted" />, label: t("console.stateOther"), value: t("console.countTa", { count: num(other) }), share: share(other, all) },
            { key: "n", keyClassName: "bg-warning", icon: <Clock size={14} aria-hidden="true" className="shrink-0 text-text-muted" />, label: t("filterNotSent"), value: t("console.countTa", { count: num(counts.not_sent) }), share: share(counts.not_sent, all) },
            { key: "f", keyClassName: "bg-danger", icon: <TriangleAlert size={14} aria-hidden="true" className="shrink-0 text-text-muted" />, label: t("filterFailed"), value: t("console.countTa", { count: num(counts.failed) }), share: share(counts.failed, all) },
          ]}
        />
      </ChartBlock>
    </ColumnGrid>
  );
};

/** Chiquvchi: tashuvchiga berilgan posilkalar. */
const ProviderShipments = ({ connection }: { connection: Connection }) => {
  const { t, i18n } = useTranslation("integrations");
  const language = i18n.language;
  const [filter, setFilter] = useState<ShipmentFilter>("all");
  const [page, setPage] = useState(1);
  const role = useSelector((state: RootState) => state.role.role);
  const canSeePhone = PHONE_ROLES.has(String(role ?? ""));

  const raw = connection.raw as { slug?: string };
  const slug = String(raw.slug ?? "");

  const list = useProviderShipments({ integrationId: connection.id, filter, page, limit: PAGE_SIZE }, { silentError: true });
  const redispatch = useRedispatch();

  const rows = list.data?.items ?? [];
  const counts = list.data?.counts;
  const total = list.data?.pagination.total ?? rows.length;

  const retry = async (orderId: string) => {
    if (!slug) {
      // Slug bo'lmasa dispatch marshruti yasalmaydi — sababini aytamiz.
      notify.error(t("shpNoSlug"));
      return;
    }
    try {
      await redispatch.mutateAsync({ slug, orderId });
      notify.success(t("shpResent"));
    } catch (error) {
      notify.error(getBackendErrorMessage(error) || t("shpResendFailed"));
    }
  };

  const phoneOf = (phone?: string | null) => (phone ? (canSeePhone ? formatPhone(phone) : maskPhone(phone)) : "—");
  const orderNo = (r: ProviderShipmentRow) => r.order?.order_number ?? r.order_id;
  const orderLink = (r: ProviderShipmentRow) => (
    <Link to={orderHref(r.order_id)} className={ORDER_LINK}>
      #{orderNo(r)}
    </Link>
  );
  /**
   * IKKI STATUS birga ko'rsatiladi va bu ataylab: ular ajralib ketishi mumkin (tashuvchi «delivered» deydi,
   * bizda hali «waiting»). ⚠️ BIZNING holat tarjima qilinadi (badge), ularniki XOM qoladi.
   */
  const statusCell = (r: ProviderShipmentRow) => (
    <div className="flex flex-col items-start gap-1">
      {r.internal_status ? <OrderStatusBadge status={r.internal_status} /> : <span className="text-text-muted">—</span>}
      <span className={cx("inline-flex items-center gap-1 text-xs", filter === "mismatch" ? "text-warning-fg" : "text-text-muted")}>
        {filter === "mismatch" ? <GitCompareArrows size={14} aria-hidden="true" /> : null}
        {t("console.theirs", { status: r.provider_status ?? "—" })}
      </span>
    </div>
  );

  const errorStrip = (r: ProviderShipmentRow) => (
    /* Qayta jo'natish FAQAT xato bor qatorda: muvaffaqiyatli posilkani qayta jo'natish tashuvchida ikkinchi yozuv yaratishi mumkin. */
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[10px] bg-danger-soft px-3 py-2">
      <TriangleAlert size={16} aria-hidden="true" className="shrink-0 text-danger-fg" />
      <p className="min-w-0 flex-[1_1_240px] text-[13px] text-danger-fg [overflow-wrap:anywhere]">
        <span className="font-semibold">{t("console.errorPrefix")}</span> {r.last_error}
      </p>
      <Button
        variant="secondary"
        size="sm"
        leftIcon={Send}
        loading={redispatch.isPending && redispatch.variables?.orderId === String(r.order_id)}
        onClick={() => void retry(String(r.order_id))}
        className="max-md:min-h-11 max-md:w-full"
      >
        {t("shpRetry")}
      </Button>
    </div>
  );

  const columns: DataTableColumn<ProviderShipmentRow>[] = [
    {
      id: "order",
      header: t("colOrder"),
      cell: (r) => (
        <div className="flex flex-col">
          {orderLink(r)}
          <span className="text-xs text-text-muted lg:hidden">{formatDateTimeLocalized(r.status_changed_at, { language })}</span>
        </div>
      ),
    },
    {
      id: "customer",
      header: t("colCustomer"),
      cell: (r) =>
        r.order ? (
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-semibold">{r.order.customer_name ?? "—"}</span>
            <span className="text-xs text-text-muted tabular-nums">
              {phoneOf(r.order.customer_phone)}
            </span>
          </div>
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
    {
      id: "address",
      header: t("mapAddress"),
      hideBelow: "lg",
      cell: (r) =>
        r.order ? (
          <div className="flex min-w-0 flex-col">
            <span className="truncate">{r.order.district_name ?? "—"}</span>
            <span className="truncate text-xs text-text-muted">{r.order.region_name ?? "—"}</span>
          </div>
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
    {
      // Jo'natilgan COD (buyurtma summasi) — yig'ilgani Hisob-kitob tabida.
      id: "amount",
      header: t("colAmountSent"),
      align: "end",
      cell: (r) =>
        r.order?.total_price != null ? (
          <span className="font-semibold">{formatMoneyLocalized(r.order.total_price, { language })}</span>
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
    {
      id: "tracking",
      header: t("colTrackingCode"),
      hideBelow: "lg",
      cell: (r) => <span className="font-mono text-[13px]">{r.tracking_number ?? r.external_ref ?? "—"}</span>,
    },
    { id: "status", header: t("colStatus"), cell: statusCell },
    {
      id: "attempts",
      header: t("colAttempt"),
      align: "end",
      cell: (r) => <span className="tabular-nums">{formatNumberLocalized(r.send_attempts, { language })}</span>,
    },
    {
      id: "changed",
      header: t("colChanged"),
      hideBelow: "lg",
      cell: (r) => <span className="whitespace-nowrap">{formatDateTimeLocalized(r.status_changed_at, { language })}</span>,
    },
  ];

  const renderCard = (r: ProviderShipmentRow) => (
    <div className="flex min-w-0 flex-col gap-1.5 px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="flex flex-wrap items-baseline gap-x-2">
          {orderLink(r)}
          <span className="text-xs text-text-muted">{formatDateTimeLocalized(r.status_changed_at, { language })}</span>
        </span>
        {r.order?.total_price != null ? (
          <span className="font-semibold">{formatMoneyLocalized(r.order.total_price, { language })}</span>
        ) : null}
      </div>
      {r.order ? (
        <span className="text-[13px] text-text">
          {r.order.customer_name ?? "—"} · <span className="text-text-muted">{phoneOf(r.order.customer_phone)}</span>
        </span>
      ) : null}
      {r.order ? (
        <span className="text-xs text-text-muted">
          {[r.order.district_name, r.order.region_name].filter(Boolean).join(", ") || "—"}
        </span>
      ) : null}
      {statusCell(r)}
    </div>
  );

  const chipOptions = [
    { value: "all" as const, label: t("filterAll"), count: counts?.all ?? list.data?.pagination.total },
    { value: "not_sent" as const, label: t("filterNotSent"), count: counts?.not_sent, icon: Clock },
    { value: "failed" as const, label: t("filterFailed"), count: counts?.failed, icon: TriangleAlert, countTone: "danger" as const },
    { value: "delivered" as const, label: t("filterDelivered"), count: counts?.delivered, icon: CircleCheck },
    /*
      «Nomuvofiqlik» — faqat status xaritasi bor ulanishda (aks holda hamma qator nomuvofiq bo'lib ko'rinardi).
      Sanoqlar kelmasa (eski backend) — chip sanoqsiz, «0» deb yolg'on ko'rsatilmaydi.
    */
    ...(counts && counts.mismatch !== null
      ? [{ value: "mismatch" as const, label: t("filterMismatch"), count: counts.mismatch, icon: GitCompareArrows, countTone: "warning" as const }]
      : []),
  ];

  return (
    <div className="flex min-w-0 flex-col">
      {counts ? <ShipmentCharts counts={counts} /> : null}
      <PanelSection aria-label={t("tabShipments")} className="pb-4">
        <FilterChips
          ariaLabel={t("console.shipmentsFilterAria")}
          value={filter}
          onChange={(v) => {
            setFilter(v);
            setPage(1);
          }}
          options={chipOptions}
          trailing={
            <>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={RefreshCw}
                loading={list.isFetching}
                onClick={() => void list.refetch()}
                className="max-md:hidden"
              >
                {t("refresh")}
              </Button>
              <IconButton
                variant="secondary"
                icon={RefreshCw}
                label={t("refresh")}
                loading={list.isFetching}
                onClick={() => void list.refetch()}
                className="md:hidden"
              />
            </>
          }
        />
      </PanelSection>
      <QueryBoundary
        query={{ data: list.data ? rows : undefined, isLoading: list.isLoading, isError: list.isError, error: list.error, refetch: list.refetch }}
        loading={<SkeletonTable framed={false} rows={5} columns={[t("colOrder"), t("colCustomer"), t("colAmountSent"), t("colStatus")]} />}
        empty={<EmptyState icon={Package} title={t("console.shipmentsEmpty")} description={t("console.shipmentsEmptyHint")} />}
        error={(error, retryQuery) => <ErrorState error={error} title={t("console.shipmentsError")} onRetry={retryQuery} />}
        className="border-t border-border"
      >
        {(list_, { isRefetching }) => (
          <DataTable
            rows={list_}
            columns={columns}
            getRowKey={(r) => String(r.id)}
            label={t("tabShipments")}
            density="tablet-tight"
            renderCard={renderCard}
            busy={isRefetching}
            expandable={{
              toggle: "none",
              isExpanded: (r) => Boolean(r.last_error),
              canExpand: (r) => Boolean(r.last_error),
              onToggle: () => undefined,
              render: errorStrip,
              expandedClassName: "",
              panelClassName: "px-4 pb-3 pt-0",
            }}
          />
        )}
      </QueryBoundary>
      {total > 0 ? (
        <div className="border-t border-border px-5 py-3 max-md:px-4">
          <Pagination
            page={list.data?.pagination.page ?? page}
            pageSize={list.data?.pagination.limit ?? PAGE_SIZE}
            total={total}
            onPageChange={setPage}
            summary={(range) => t("console.shipmentsRange", range)}
          />
        </div>
      ) : null}
    </div>
  );
};

/** Kiruvchi: hamkordan kelgan posilkalar bog'lanishi. */
const PartnerShipments = ({ connection }: { connection: Connection }) => {
  const { t, i18n } = useTranslation("integrations");
  const [page, setPage] = useState(1);
  const list = usePartnerShipments({ partnerId: connection.id, page, limit: PAGE_SIZE }, { silentError: true });
  const rows = list.data?.items ?? [];
  const total = list.data?.pagination.total ?? rows.length;

  const columns: DataTableColumn<PartnerShipmentRow>[] = [
    { id: "theirs", header: t("colTheirNumber"), cell: (r) => <span className="font-mono text-[13px]">{r.external_order_id}</span> },
    {
      id: "ours",
      header: t("colOurOrder"),
      cell: (r) => (
        <Link to={orderHref(r.order_id)} className={ORDER_LINK}>
          #{r.order_id}
        </Link>
      ),
    },
    {
      id: "arrived",
      header: t("colArrived"),
      cell: (r) => <span className="whitespace-nowrap">{formatDateTimeLocalized(r.createdAt, { language: i18n.language })}</span>,
    },
  ];

  return (
    <div className="flex min-w-0 flex-col">
      <PanelSection>
        <InlineAlert tone="info" title={t("shpLinkInfo")}>
          {t("shpLinkInfoDesc")}
        </InlineAlert>
        <SectionHead
          title={t("shpIncoming")}
          actions={
            <Button variant="secondary" size="sm" leftIcon={RefreshCw} loading={list.isFetching} onClick={() => void list.refetch()} className="max-md:min-h-11">
              {t("refresh")}
            </Button>
          }
        />
      </PanelSection>
      <QueryBoundary
        query={{ data: list.data ? rows : undefined, isLoading: list.isLoading, isError: list.isError, error: list.error, refetch: list.refetch }}
        loading={<SkeletonTable framed={false} rows={4} columns={[t("colTheirNumber"), t("colOurOrder"), t("colArrived")]} />}
        empty={<EmptyState icon={Package} title={t("console.incomingEmpty")} description={t("console.incomingEmptyHint")} />}
        error={(error, retryQuery) => <ErrorState error={error} title={t("console.shipmentsError")} onRetry={retryQuery} />}
        className="border-t border-border"
      >
        {(list_, { isRefetching }) => (
          <DataTable
            rows={list_}
            columns={columns}
            getRowKey={(r) => String(r.id)}
            label={t("shpIncoming")}
            busy={isRefetching}
            renderCard={(r) => (
              <div className="flex min-w-0 flex-col gap-1 px-4 py-3">
                <span className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link to={orderHref(r.order_id)} className={ORDER_LINK}>
                    #{r.order_id}
                  </Link>
                  <span className="text-xs text-text-muted">{formatDateTimeLocalized(r.createdAt, { language: i18n.language })}</span>
                </span>
                <span className="font-mono text-xs text-text-muted">{r.external_order_id}</span>
              </div>
            )}
          />
        )}
      </QueryBoundary>
      {total > 0 ? (
        <div className="border-t border-border px-5 py-3 max-md:px-4">
          <Pagination
            page={list.data?.pagination.page ?? page}
            pageSize={list.data?.pagination.limit ?? PAGE_SIZE}
            total={total}
            onPageChange={setPage}
            summary={(range) => t("console.incomingRange", range)}
          />
        </div>
      ) : null}
    </div>
  );
};

export default ConnectionShipments;
