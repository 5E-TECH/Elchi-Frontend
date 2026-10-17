// dizayn-v2: superadmin-payments-overview, admin-payments-overview, manager-payments-overview
import { memo, useCallback, useMemo, useState, type ReactNode } from "react";
import { ArrowDownLeft, ArrowUpRight, ChevronRight, Inbox, ListFilter } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatSignedMoneyLocalized } from "../../../shared/lib/formatMoney";
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  IconButton,
  Pagination as PaginationControl,
  QueryBoundary,
  SkeletonTable,
  type DataTableColumn,
} from "../../../shared/ui/primitives";
import FinanceHistoryDetailPopup from "./FinanceHistoryDetailPopup";
import { resolvePaymentActorName, resolvePaymentCounterparty } from "./paymentHistoryActor";
import { getCashboxTypeLabel, getPaymentSourceTitle, getViewerOperationType } from "./paymentSourceType";

// ─── Types (boshqa «Moliya» fayllari import qiladi — o'zgarmaydi, faqat additiv) ───────────────

export interface PaymentRow {
  id: string;
  amount: number;
  balance_after?: number;
  operation_type?: string;
  cashbox_id?: string | number;
  source_type?: string;
  source_id?: string;
  cashbox_type?: string;
  created_by?: string;
  created_by_user?: PaymentHistoryActor | null;
  createdByUser?: PaymentHistoryActor | null;
  user?: PaymentHistoryActor | null;
  source_user?: PaymentHistoryActor | null;
  sourceUser?: PaymentHistoryActor | null;
  payment_method?: string;
  payment_date?: string;
  comment?: string;
  createdAt?: string;
  created_at?: string;
  cashbox?: {
    id: string;
    balance: number;
    balance_cash?: number;
    balance_card?: number;
    cashbox_type: string;
  };
}

export interface PaymentHistoryActor {
  id?: string | number;
  name?: string | null;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone_number?: string | null;
  phone?: string | null;
  role?: string | null;
  status?: string | null;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface PaymentHistoryTableProps {
  data?: PaymentRow[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  pagination?: Pagination;
  onPageChange?: (page: number) => void;
  onItemsPerPageChange?: (limit: number) => void;
  currentPage?: number;
  /** So'rov xatosi (`ErrorState` turi: tarmoq, server …). */
  error?: unknown;
  /** Fonda yangilanmoqda (sahifa/filtr almashdi) — ro'yxat xiralashadi. */
  isFetching?: boolean;
  /** Joriy foydalanuvchi roli — manba va kassa yorliqlari maketdagidek (`getPaymentSourceTitle`). */
  viewerRole?: string | null;
  /** Filtr faol: bo'sh holatda «Filtrlarni tozalash» amali. */
  onClearFilters?: () => void;
  clearFiltersLabel?: string;
}

const PAGE_SIZES = [10, 20, 50, 100] as const;

const rowDate = (row: PaymentRow) => row.payment_date || row.createdAt || row.created_at || "";

const rowCashboxType = (row: PaymentRow) => row.cashbox_type || row.cashbox?.cashbox_type;

/** Yaratgan xodim ismi; noma'lum — «—». */
const actorName = (row: PaymentRow) => {
  const name = resolvePaymentActorName(row);
  return name === "-" ? "—" : name;
};

/**
 * «OPERATSIYALAR TARIXI» RO'YXATI — /payments (dizayn v2, maketlar `*-payments-overview`).
 *
 * Kartaning tana qismi: `DataTable` (Sana · Yaratgan · Manba · Kassa · Operatsiya · Summa · ›), sahifalash
 * («1–10 / 128 ta operatsiya», qatorlar soni, sahifalar) va qator tafsiloti (`FinanceHistoryDetailPopup`).
 * Planshetda (< 1024) «Yaratgan» Sana ostida, «Kassa» yashirin (menejerda — Operatsiya ostida); telefonda —
 * kartalar: «sarlavha · summa», «qarshi tomon · kassa», «badge · sana · yaratgan». Tablar va filtrlar —
 * sahifada (karta boshida). Holatlar: skelet, bo'sh («Operatsiyalar topilmadi»; filtr bo'lsa — tozalash),
 * xato + «Qayta urinish».
 */
const PaymentHistoryTable = ({
  data,
  isLoading = false,
  isError = false,
  onRetry,
  pagination,
  onPageChange,
  onItemsPerPageChange,
  currentPage,
  error,
  isFetching = false,
  viewerRole,
  onClearFilters,
  clearFiltersLabel,
}: PaymentHistoryTableProps) => {
  const { t, i18n } = useTranslation("payments");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const [selectedRow, setSelectedRow] = useState<PaymentRow | null>(null);
  const isManager = String(viewerRole ?? "").toLowerCase() === "manager";

  const dateText = useCallback(
    (row: PaymentRow) => {
      const value = rowDate(row);
      return value ? formatDateTimeLocalized(value, { language }) : "—";
    },
    [language],
  );
  const sourceTitle = useCallback(
    (row: PaymentRow) => getPaymentSourceTitle(row.source_type, t, { role: viewerRole, cashboxType: rowCashboxType(row) }),
    [t, viewerRole],
  );
  const cashboxLabel = useCallback(
    (row: PaymentRow) => getCashboxTypeLabel(rowCashboxType(row), t, viewerRole),
    [t, viewerRole],
  );
  const counterparty = useCallback(
    (row: PaymentRow) => resolvePaymentCounterparty(row, (id) => t("v2Common.orderNumber", { id })),
    [t],
  );
  const direction = useCallback((row: PaymentRow) => getViewerOperationType(row, viewerRole), [viewerRole]);

  const operationBadge = useCallback(
    (row: PaymentRow) => {
      const value = direction(row);
      if (!value) return <span className="text-text-muted">—</span>;
      return (
        <Badge icon={value === "income" ? ArrowDownLeft : ArrowUpRight}>
          {t(value === "income" ? "v2Common.income" : "v2Common.expense")}
        </Badge>
      );
    },
    [direction, t],
  );

  const amountNode = useCallback(
    (row: PaymentRow) => {
      const value = direction(row);
      const amount = Math.abs(Number(row.amount) || 0);
      return (
        <span
          className={cx(
            "whitespace-nowrap font-semibold",
            value === "income" ? "text-success-fg" : value === "expense" ? "text-danger-fg" : "text-text",
          )}
        >
          {formatSignedMoneyLocalized(value === "expense" ? -amount : amount, { language })}
        </span>
      );
    },
    [direction, language],
  );

  const openLabel = useCallback(
    (row: PaymentRow) => t("v2Common.openDetail", { title: sourceTitle(row), date: dateText(row) }),
    [dateText, sourceTitle, t],
  );

  const columns = useMemo<DataTableColumn<PaymentRow>[]>(
    () => [
      {
        id: "date",
        header: t("v2Overview.history.columns.date"),
        className: "whitespace-nowrap",
        cell: (row) => (
          <>
            <div>{dateText(row)}</div>
            <div className="hidden text-[13px] text-text-muted max-lg:block">{actorName(row)}</div>
          </>
        ),
      },
      {
        id: "createdBy",
        header: t("v2Overview.history.columns.createdBy"),
        hideBelow: "lg",
        className: "whitespace-nowrap",
        cell: (row) => actorName(row),
      },
      {
        id: "source",
        header: t("v2Overview.history.columns.source"),
        cell: (row) => {
          const sub = counterparty(row);
          return (
            <>
              <button
                type="button"
                onClick={() => setSelectedRow(row)}
                className="text-left font-semibold text-text hover:text-action-fg hover:underline"
              >
                {sourceTitle(row)}
              </button>
              {sub ? <div className="text-[13px] text-text-muted [overflow-wrap:anywhere]">{sub}</div> : null}
            </>
          );
        },
      },
      {
        id: "cashbox",
        header: t("v2Overview.history.columns.cashbox"),
        hideBelow: "lg",
        className: "whitespace-nowrap",
        cell: (row) => (rowCashboxType(row) ? cashboxLabel(row) : "—"),
      },
      {
        id: "operation",
        header: t("v2Overview.history.columns.operation"),
        cell: (row) => (
          <>
            <div>{operationBadge(row)}</div>
            {isManager && rowCashboxType(row) ? (
              <div className="mt-1 hidden text-[13px] text-text-muted max-lg:block">{cashboxLabel(row)}</div>
            ) : null}
          </>
        ),
      },
      {
        id: "amount",
        header: t("v2Overview.history.columns.amount"),
        align: "end",
        cell: amountNode,
      },
      {
        id: "detail",
        header: <span className="sr-only">{t("v2Overview.history.columns.detail")}</span>,
        className: "w-14",
        cellClassName: "text-right",
        cell: (row) => (
          <IconButton
            size="sm"
            variant="ghost"
            icon={ChevronRight}
            label={openLabel(row)}
            onClick={() => setSelectedRow(row)}
            className="text-text-muted"
          />
        ),
      },
    ],
    [amountNode, cashboxLabel, counterparty, dateText, isManager, openLabel, operationBadge, sourceTitle, t],
  );

  // Telefon kartasi (maket `.el-list-item`): sarlavha + summa · qarshi tomon · kassa · badge + sana · yaratgan.
  const renderCard = useCallback(
    (row: PaymentRow) => {
      const sub = [counterparty(row), rowCashboxType(row) ? cashboxLabel(row) : null].filter(Boolean).join(" · ");
      return (
        <button
          type="button"
          aria-label={openLabel(row)}
          onClick={() => setSelectedRow(row)}
          className="flex min-h-14 w-full flex-col gap-1 px-4 py-3 text-left text-sm text-text hover:bg-row-hover"
        >
          <span className="flex w-full min-w-0 justify-between gap-2">
            <span className="min-w-0 font-semibold">{sourceTitle(row)}</span>
            {amountNode(row)}
          </span>
          {sub ? <span className="text-[13px] text-text-muted [overflow-wrap:anywhere]">{sub}</span> : null}
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {operationBadge(row)}
            <span className="text-[13px] text-text-muted">
              <span className="whitespace-nowrap">{dateText(row)}</span> · {actorName(row)}
            </span>
          </span>
        </button>
      );
    },
    [amountNode, cashboxLabel, counterparty, dateText, openLabel, operationBadge, sourceTitle],
  );

  const total = pagination?.total ?? data?.length ?? 0;
  const page = pagination?.page ?? currentPage ?? 1;
  const pageSize = pagination?.limit ?? 10;
  const showPagination = Boolean(pagination && onPageChange && total > 0 && !isError);

  const emptyState: ReactNode = onClearFilters ? (
    <EmptyState
      icon={ListFilter}
      title={t("v2Overview.history.empty")}
      description={t("v2Overview.history.filteredEmptyDescription")}
      action={
        <Button variant="secondary" onClick={onClearFilters}>
          {clearFiltersLabel}
        </Button>
      }
    />
  ) : (
    <EmptyState
      icon={Inbox}
      title={t("v2Overview.history.empty")}
      description={t("v2Overview.history.emptyDescription")}
    />
  );

  return (
    <>
      <QueryBoundary
        query={{ data, isLoading, isError, error, refetch: onRetry, isFetching }}
        loadingLabel={t("v2Overview.history.loading")}
        loading={
          <SkeletonTable
            framed={false}
            rows={8}
            columns={[
              t("v2Overview.history.columns.date"),
              t("v2Overview.history.columns.createdBy"),
              t("v2Overview.history.columns.source"),
              t("v2Overview.history.columns.operation"),
              t("v2Overview.history.columns.amount"),
            ]}
          />
        }
        empty={emptyState}
        error={(queryError, retry) => (
          <ErrorState error={queryError} title={t("v2Overview.history.loadError")} onRetry={retry} />
        )}
        className="border-t border-border"
      >
        {(rows, { isRefetching }) => (
          <DataTable
            rows={rows}
            columns={columns}
            getRowKey={(row, index) => String(row.id ?? index)}
            label={t("v2Overview.history.label")}
            cardsLabel={t("v2Overview.history.cardsLabel")}
            onRowClick={(row) => setSelectedRow(row)}
            renderCard={renderCard}
            busy={isRefetching}
          />
        )}
      </QueryBoundary>

      {showPagination && onPageChange ? (
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3 max-md:px-4">
          <PaginationControl
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={onPageChange}
            onPageSizeChange={onItemsPerPageChange}
            pageSizeOptions={PAGE_SIZES}
            summary={(range) => t("v2Common.paginationOperations", range)}
            className="w-full"
          />
        </div>
      ) : null}

      <FinanceHistoryDetailPopup row={selectedRow} onClose={() => setSelectedRow(null)} />
    </>
  );
};

export default memo(PaymentHistoryTable);
