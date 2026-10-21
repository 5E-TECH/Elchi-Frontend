// dizayn-v2: superadmin-integrations-panel-settlement, admin-integrations-conn-settlement
import { useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Calendar, CircleCheck, CircleX, Clock, Receipt, RefreshCw, Undo2, Wallet, type LucideIcon } from "lucide-react";
import {
  cancelBlock,
  useRemittances,
  type Remittance,
  type RemittanceStatusFilter,
} from "../../../../entities/integrations/settlement";
import { cx } from "../../../../shared/lib/cx";
import { formatDateLocalized, formatDateTimeLocalized } from "../../../../shared/lib/formatDateTime";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../../shared/lib/formatMoney";
import {
  Badge,
  Button,
  DataTable,
  DateRange,
  EmptyState,
  Pagination,
  QueryBoundary,
  SkeletonTable,
  StatusBadge,
  type DataTableColumn,
} from "../../../../shared/ui/primitives";
import { FilterChips, InlineAlert, PanelSection, SectionHead } from "../../ui";
import CancelRemittanceDialog from "./CancelRemittanceDialog";
import { REMITTANCES_SECTION_ID } from "./remittancesAnchor";

/**
 * «OLINGAN TO'LOVLAR» (IS-3, DxdZFdIk; maket `*-panel-settlement` / `admin-integrations-conn-settlement`).
 *
 *   sarlavha + soni → sana oralig'i (`from_date` / `to_date`) + chiplar «Faol · Bekor qilingan · Barchasi» (o'z
 *   kaliti — `integrations.filterAll` emas) → jadval «Sana · Summa · Yopilgan qarzlar · To'lov raqami · izoh ·
 *   Holat · kassa · Bekor qilish» (planshetda 3–4-ustun birinchi katakka tushadi, telefonda kartalar) → sahifalash.
 *
 * Chizilmagan (Taklif · backend kerak, BD2-10): «Kim kiritdi / bekor qildi» ismi — javobda faqat id; bekor qilingan
 * eski yozuvda operatorning kassa tanlovi saqlanmaydi → «Kassa: eski yozuv».
 *
 * «Holat · kassa» (`cashbox_posted`): faol — «Kassaga yozildi» / «Kassaga yozilmadi» + «Asosiy kassa tarixini
 * tekshiring» / «Kassa: eski yozuv»; bekor qilingan — backend teskari chiqimni faqat `cashbox_posted = true` da
 * yozadi → «Kassadan qaytarildi» / «Kassa o'zgarmadi» / «Kassa: eski yozuv».
 */

const PAGE_SIZE = 10;

const SUB = "text-xs leading-[18px] text-text-muted";

const CashLine = ({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) => (
  <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
    <Icon size={14} aria-hidden="true" className="flex-none" />
    {children}
  </span>
);

const RemittancesSection = ({
  integrationId,
  connectionName,
  advanceBalance,
}: {
  integrationId: string;
  connectionName: string;
  /** Hozirgi hamkor avansi («Qoldiq»); o'qilmagan bo'lsa `null` — bekor qilish to'sig'i oldindan aytilmaydi. */
  advanceBalance: number | null;
}) => {
  const { t, i18n } = useTranslation("integrations");
  const language = i18n.language;
  const money = (value: number) => formatMoneyLocalized(value, { language });
  const dateTime = (value: string | null) => (value ? formatDateTimeLocalized(value, { language }) : "—");

  const [status, setStatus] = useState<RemittanceStatusFilter>("all");
  const [range, setRange] = useState<{ from: string; to: string }>({ from: "", to: "" });
  const [page, setPage] = useState(1);
  /** Bekor qilinayotgan to'lov — mazmun oyna yopilish animatsiyasida ham qoladi (`cancelOpen` alohida). */
  const [target, setTarget] = useState<Remittance | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  /** Oyna yopilgach fokus qaytadigan joy: «Bekor qilish» tugmasi yoki (bekor qilingach) bo'lim sarlavhasi. */
  const triggerRef = useRef<HTMLElement | null>(null);
  const headingRef = useRef<HTMLDivElement>(null);

  const query = useRemittances(
    { integrationId, status, from: range.from, to: range.to, page, limit: PAGE_SIZE },
    { silentError: true },
  );
  const rows = query.data?.items ?? [];
  const total = query.data?.pagination.total ?? 0;
  const hasDates = Boolean(range.from || range.to);
  const filtered = hasDates || status !== "all";

  const clearFilters = () => {
    setStatus("all");
    setRange({ from: "", to: "" });
    setPage(1);
  };

  const openCancel = (row: Remittance, trigger: HTMLElement) => {
    triggerRef.current = trigger;
    setTarget(row);
    setCancelOpen(true);
  };

  const closeCancel = () => setCancelOpen(false);

  const rangeText = [range.from, range.to]
    .filter(Boolean)
    .map((d) => formatDateLocalized(d, { language }))
    .join(" – ");

  const debtsLine = (r: Remittance) =>
    r.status === "cancelled"
      ? t("remittances.debtsReopened", { count: r.settledCount })
      : t("remittances.debts", { count: r.settledCount });

  /** «1 150 000 so'm · 350 000 so'm avansga o'tdi» (eski yozuvda yopilgan summa yo'q). */
  const settledSub = (r: Remittance) => {
    const parts: ReactNode[] = [];
    if (r.settledAmount !== null) parts.push(money(r.settledAmount));
    if (r.status === "active" && r.toAdvance > 0) {
      parts.push(
        <span key="adv" className="text-success-fg">
          {t("remittances.toAdvance", { amount: money(r.toAdvance) })}
        </span>,
      );
    }
    return parts.length ? parts.flatMap((p, i) => (i ? [" · ", p] : [p])) : null;
  };

  /** «Bekor qilindi: 16.10.2026, 15:32 · «Summa xato…»» — sabab foydalanuvchi yozgan matn (backend xatosi emas). */
  const cancelledLine = (r: Remittance) =>
    r.status === "cancelled"
      ? [t("remittances.cancelledAt", { date: dateTime(r.cancelledAt) }), r.cancelReason ? `«${r.cancelReason}»` : null]
          .filter(Boolean)
          .join(" · ")
      : null;

  const statusCell = (r: Remittance) => {
    const cancelled = r.status === "cancelled";
    let cash: ReactNode;
    if (r.cashboxPosted === null) cash = <CashLine icon={Clock}>{t("remittances.cashLegacy")}</CashLine>;
    else if (cancelled)
      cash = r.cashboxPosted ? (
        <CashLine icon={Undo2}>{t("remittances.cashReversed")}</CashLine>
      ) : (
        <CashLine icon={Wallet}>{t("remittances.cashUnchanged")}</CashLine>
      );
    else if (r.cashboxPosted) cash = <CashLine icon={CircleCheck}>{t("remittances.cashPosted")}</CashLine>;
    else
      cash = (
        <>
          <Badge tone="warning" dot>
            {t("remittances.cashNotPosted")}
          </Badge>
          <span className="text-xs text-text-subtle">{t("remittances.cashNotPostedHint")}</span>
        </>
      );
    return (
      <span className="flex min-w-0 flex-col items-start gap-1.5">
        <StatusBadge
          tone={cancelled ? "danger" : "success"}
          label={cancelled ? t("remittances.statusCancelled") : t("remittances.statusActive")}
        />
        {cash}
      </span>
    );
  };

  const cancelButton = (r: Remittance) =>
    r.status === "active" ? (
      <Button
        variant="danger-soft"
        size="sm"
        aria-haspopup="dialog"
        aria-label={t("remittances.cancelAria", { id: r.id })}
        onClick={(event) => openCancel(r, event.currentTarget)}
      >
        {t("remittances.cancel")}
      </Button>
    ) : null;

  const referenceBlock = (r: Remittance, compact: boolean) => {
    const cancelledText = cancelledLine(r);
    return (
      <>
        {compact ? (
          r.reference || r.note ? (
            <span className={cx(SUB, "block wrap-break-word")}>{[r.reference, r.note].filter(Boolean).join(" · ")}</span>
          ) : null
        ) : (
          <>
            <span className="block wrap-break-word">{r.reference ?? <span className="text-text-subtle">—</span>}</span>
            {r.note ? <span className={cx(SUB, "block wrap-break-word")}>{r.note}</span> : null}
          </>
        )}
        {cancelledText ? <span className={cx(SUB, "block wrap-break-word")}>{cancelledText}</span> : null}
      </>
    );
  };

  const settledLine = (r: Remittance) => {
    const sub = settledSub(r);
    return (
      <span className={cx(SUB, "block")}>
        {r.status === "cancelled" ? debtsLine(r) : t("remittances.debtsClosed", { count: r.settledCount })}
        {sub ? <> · {sub}</> : null}
      </span>
    );
  };

  const columns: DataTableColumn<Remittance>[] = [
    {
      id: "date",
      header: t("remittances.colDate"),
      cell: (r) => (
        <span className="flex min-w-0 flex-col">
          <span className="whitespace-nowrap font-semibold text-text">{dateTime(r.createdAt)}</span>
          <span className={SUB}>{t("remittances.number", { id: r.id })}</span>
          {/* Planshet (< 1024): «Yopilgan qarzlar» va «To'lov raqami · izoh» ustunlari shu yerga tushadi. */}
          <span className="hidden max-w-[320px] flex-col max-lg:flex">
            {settledLine(r)}
            {referenceBlock(r, true)}
          </span>
        </span>
      ),
    },
    {
      id: "amount",
      header: t("remittances.colAmount"),
      align: "end",
      cell: (r) => (
        <span className={cx("whitespace-nowrap", r.status === "cancelled" ? "text-text-muted" : "font-semibold text-text")}>
          {money(r.amount)}
        </span>
      ),
    },
    {
      id: "settled",
      header: t("remittances.colSettled"),
      hideBelow: "lg",
      cell: (r) => {
        const sub = settledSub(r);
        return (
          <span className="flex min-w-0 flex-col">
            <span className={r.status === "cancelled" ? "text-text-muted" : undefined}>{debtsLine(r)}</span>
            {sub ? <span className={SUB}>{sub}</span> : null}
          </span>
        );
      },
    },
    {
      id: "reference",
      header: t("remittances.colReference"),
      hideBelow: "lg",
      cell: (r) => <span className="flex min-w-0 max-w-[260px] flex-col">{referenceBlock(r, false)}</span>,
    },
    { id: "status", header: t("remittances.colStatus"), cell: statusCell },
    {
      id: "actions",
      header: <span className="sr-only">{t("remittances.colActions")}</span>,
      align: "end",
      cell: (r) => cancelButton(r),
    },
  ];

  const block = target ? cancelBlock(target, advanceBalance, rows) : null;

  return (
    <section aria-labelledby={REMITTANCES_SECTION_ID} data-testid="remittances" className="flex min-w-0 flex-col">
      <PanelSection as="div">
        <div ref={headingRef} tabIndex={-1} data-remittances-head className="scroll-mt-4 rounded-md">
          <SectionHead
            id={REMITTANCES_SECTION_ID}
            icon={Receipt}
            title={
              <>
                {t("remittances.title")}
                {query.data ? (
                  <span
                    aria-hidden="true"
                    className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-sunken px-1.5 text-xs font-semibold text-text-muted tabular-nums"
                  >
                    {formatNumberLocalized(total, { language })}
                  </span>
                ) : null}
              </>
            }
          />
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <DateRange
            value={range}
            onChange={(next) => {
              setRange(next);
              setPage(1);
            }}
            aria-label={t("remittances.dateAria")}
            className="w-[240px] max-md:w-full"
          />
          <FilterChips
            ariaLabel={t("remittances.filterAria")}
            value={status}
            onChange={(next) => {
              setStatus(next);
              setPage(1);
            }}
            options={[
              { value: "active", label: t("remittances.filterActive"), icon: CircleCheck },
              { value: "cancelled", label: t("remittances.filterCancelled"), icon: CircleX },
              { value: "all", label: t("remittances.filterAll") },
            ]}
          />
        </div>
      </PanelSection>
      <QueryBoundary
        query={{ data: query.data ? rows : undefined, isLoading: query.isLoading, isError: query.isError, error: query.error, refetch: query.refetch }}
        loadingLabel={t("remittances.loading")}
        loading={
          <SkeletonTable
            framed={false}
            rows={3}
            columns={[t("remittances.colDate"), t("remittances.colAmount"), t("remittances.colSettled"), t("remittances.colStatus")]}
          />
        }
        empty={
          filtered ? (
            <EmptyState
              icon={hasDates ? Calendar : Receipt}
              title={hasDates ? t("remittances.emptyPeriodTitle") : t("remittances.emptyFilterTitle")}
              description={hasDates ? t("remittances.emptyPeriodText", { range: rangeText }) : t("remittances.emptyFilterText")}
              action={
                <Button variant="ghost" onClick={clearFilters}>
                  {t("remittances.clearFilters")}
                </Button>
              }
            />
          ) : (
            <EmptyState icon={Receipt} title={t("remittances.emptyTitle")} description={t("remittances.emptyText", { name: connectionName })} />
          )
        }
        error={(_error, retry) => (
          <div className="px-5 py-4 max-md:px-4">
            <InlineAlert
              tone="danger"
              title={t("remittances.error")}
              action={
                <Button variant="secondary" size="sm" leftIcon={RefreshCw} onClick={retry}>
                  {t("remittances.retry")}
                </Button>
              }
            />
          </div>
        )}
        className="border-t border-border"
      >
        {(list, { isRefetching }) => (
          <DataTable
            rows={list}
            columns={columns}
            getRowKey={(r) => r.id}
            label={t("remittances.title")}
            busy={isRefetching}
            renderCard={(r) => (
              <div className="flex min-w-0 flex-col gap-1 px-4 py-3">
                <span className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold text-text">{dateTime(r.createdAt)}</span>
                  <span className={cx("font-semibold", r.status === "cancelled" ? "text-text-muted" : "text-text")}>
                    {money(r.amount)}
                  </span>
                </span>
                <span className={SUB}>{t("remittances.number", { id: r.id })}</span>
                {settledLine(r)}
                {referenceBlock(r, true)}
                <span className="mt-1">{statusCell(r)}</span>
                {r.status === "active" ? <span className="mt-1 flex">{cancelButton(r)}</span> : null}
              </div>
            )}
          />
        )}
      </QueryBoundary>
      {total > 0 ? (
        <div className="border-t border-border px-5 py-3 max-md:px-4">
          <Pagination
            page={query.data?.pagination.page ?? page}
            pageSize={query.data?.pagination.limit ?? PAGE_SIZE}
            total={total}
            onPageChange={setPage}
            label={t("remittances.pagesAria")}
            summary={(r) => t("remittances.range", r)}
          />
        </div>
      ) : null}

      <CancelRemittanceDialog
        open={cancelOpen}
        remittance={target}
        integrationId={integrationId}
        connectionName={connectionName}
        block={block}
        returnFocus={triggerRef}
        // Bekor qilingan qatorda «Bekor qilish» tugmasi qolmaydi — fokus bo'lim sarlavhasiga (sahifa boshiga emas).
        onCancelled={() => {
          triggerRef.current = headingRef.current;
        }}
        onClose={closeCancel}
      />
    </section>
  );
};

export default RemittancesSection;
