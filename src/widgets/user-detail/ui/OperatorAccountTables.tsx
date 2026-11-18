// dizayn-v2: (maket yo'q) market_operator-earnings, superadmin-users-detail
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, Landmark, ReceiptText, ShoppingBag, Store } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatCommissionValue } from "../../../entities/market-operator";
import {
  useOperatorAccountBalance,
  useOperatorAccountEarnings,
  useOperatorAccountPayments,
  type OperatorEarning,
  type OperatorPayment,
} from "../../../entities/operator-payment";
import { cx } from "../../../shared/lib/cx";
import { formatDateLocalized, formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import {
  formatMoneyLocalized,
  formatNumberLocalized,
  formatSignedMoneyLocalized,
  resolveMoneyLanguage,
} from "../../../shared/lib/formatMoney";
import {
  Badge,
  Card,
  DataTable,
  EmptyState,
  Pagination,
  Pressable,
  QueryBoundary,
  SkeletonLines,
  type DataTableColumn,
} from "../../../shared/ui/primitives";

/** Har ro'yxatda bir sahifa (maket `market_operator-earnings` — «To'lovlar» va «Daromadlar»). */
export const OPERATOR_ACCOUNT_PAGE_SIZE = 10;

const useMoneyLanguage = () => {
  const { i18n } = useTranslation();
  return resolveMoneyLanguage(i18n.resolvedLanguage ?? i18n.language);
};

/** Sahifa yozuvsiz qolsa (jami kamaygan) — mavjud oxirgi sahifa; o'zgarish kerak bo'lmasa `null`. */
const clampedPage = (data: { items: readonly unknown[]; total: number } | undefined, page: number): number | null => {
  if (!data || data.items.length > 0 || data.total === 0 || page === 1) return null;
  const lastPage = Math.max(1, Math.ceil(data.total / OPERATOR_ACCOUNT_PAGE_SIZE));
  return lastPage < page ? lastPage : null;
};

/** Karta osti: ko'p bo'lsa — sahifalash, aks holda «N ta …» + «Jami: …» (maket `.el-card-foot`). */
const ListFooter = ({
  page,
  total,
  busy,
  onPageChange,
  pagination,
  summary,
  sum,
}: {
  page: number;
  total: number;
  busy: boolean;
  onPageChange: (page: number) => void;
  pagination: (range: { from: string; to: string; total: string }) => ReactNode;
  summary: ReactNode;
  sum: ReactNode;
}) =>
  total > OPERATOR_ACCOUNT_PAGE_SIZE ? (
    <Pagination
      page={page}
      pageSize={OPERATOR_ACCOUNT_PAGE_SIZE}
      total={total}
      onPageChange={onPageChange}
      disabled={busy}
      summary={pagination}
    />
  ) : (
    <div className="flex w-full flex-wrap items-center justify-between gap-2 text-[13px] text-text-muted">
      <span>{summary}</span>
      {sum}
    </div>
  );

const LIST_LOADING = (
  <div className="p-5">
    <SkeletonLines lines={4} />
  </div>
);

/**
 * «TO'LOVLAR» (B1te60bD, faqat o'qish) — `GET finance/operators/:operator_id/payments` (limit/offset; to'lov sanasi
 * bo'yicha yangisi tepada, bekor qilinganlar ham). Ustunlar: Sana · Summa · Kim yozdi (market yoki eski Elchi
 * yozuvi — «Elchi kassasidan» kassa izi bor bo'lsa, aks holda «Elchi yozuvi») · Holat («Yozilgan» / «Bekor qilingan»
 * + sabab, summa chizilgan) · Izoh (< 1024 — «Kim yozdi» ostida). Telefonda kartalar. Bekor qilish / yozish YO'Q.
 * Maket yo'q — eng yaqini `market_operator-earnings` («To'lovlar»).
 */
export const OperatorAccountPaymentsCard = ({ operatorId }: { operatorId: string }) => {
  const { t } = useTranslation("users");
  const language = useMoneyLanguage();
  const [page, setPage] = useState(1);
  const payments = useOperatorAccountPayments(operatorId, {
    limit: OPERATOR_ACCOUNT_PAGE_SIZE,
    offset: (page - 1) * OPERATOR_ACCOUNT_PAGE_SIZE,
  });
  const balance = useOperatorAccountBalance(operatorId);
  const lastPage = clampedPage(payments.data, page);
  if (lastPage !== null) setPage(lastPage);
  const total = payments.data?.total ?? 0;

  const amount = useCallback(
    (row: OperatorPayment) => (
      <span
        className={cx(
          "whitespace-nowrap font-semibold tabular-nums",
          row.status === "cancelled" ? "text-text-muted line-through" : "text-text",
        )}
      >
        {formatMoneyLocalized(row.amount, { language })}
      </span>
    ),
    [language],
  );

  const recordedBy = useCallback(
    (row: OperatorPayment) =>
      row.source === "market" ? (
        <Badge icon={Store}>{t("operatorAccount.payments.byMarket")}</Badge>
      ) : (
        <Badge tone="info" icon={Landmark}>
          {/* Kassa izi bor eski yozuv — «Elchi kassasidan»; izsiz (AUDIT M6 dan oldingi) — «Elchi yozuvi». */}
          {t(row.affectsCashbox ? "operatorAccount.payments.byElchiCashbox" : "operatorAccount.payments.byElchiRecord")}
        </Badge>
      ),
    [t],
  );

  const statusBadge = useCallback(
    (row: OperatorPayment) =>
      row.status === "cancelled" ? (
        <Badge tone="danger" dot>
          {t("operatorAccount.payments.cancelled")}
        </Badge>
      ) : (
        <Badge tone="success" dot>
          {t("operatorAccount.payments.active")}
        </Badge>
      ),
    [t],
  );

  const cancelReason = useCallback(
    (row: OperatorPayment) =>
      row.status === "cancelled" && row.cancelReason ? (
        <span className="text-[13px] text-text-muted [overflow-wrap:anywhere]">
          {t("operatorAccount.payments.cancelReason", { reason: row.cancelReason })}
        </span>
      ) : null,
    [t],
  );

  const status = useCallback(
    (row: OperatorPayment) => (
      <span className="flex flex-col items-start gap-1">
        {statusBadge(row)}
        {cancelReason(row)}
      </span>
    ),
    [cancelReason, statusBadge],
  );

  const columns = useMemo<DataTableColumn<OperatorPayment>[]>(
    () => [
      {
        id: "date",
        header: t("operatorAccount.payments.date"),
        cellClassName: "whitespace-nowrap tabular-nums",
        cell: (row) => formatDateLocalized(row.paidAt, { language }),
      },
      { id: "amount", header: t("operatorAccount.payments.amount"), align: "end", cell: amount },
      {
        id: "recordedBy",
        header: t("operatorAccount.payments.recordedBy"),
        cell: (row) => (
          <span className="flex min-w-0 flex-col items-start gap-1">
            {recordedBy(row)}
            {/* Planshetda «Izoh» ustuni yashirin — izoh shu yerda. */}
            {row.note ? (
              <span className="hidden text-[13px] text-text-muted [overflow-wrap:anywhere] max-lg:block">{row.note}</span>
            ) : null}
          </span>
        ),
      },
      { id: "status", header: t("operatorAccount.payments.status"), cell: status },
      {
        id: "note",
        header: t("operatorAccount.payments.note"),
        hideBelow: "lg",
        cellClassName: "text-text-muted [overflow-wrap:anywhere]",
        cell: (row) => row.note || "—",
      },
    ],
    [amount, language, recordedBy, status, t],
  );

  const renderCard = useCallback(
    (row: OperatorPayment) => (
      <div className="flex min-w-0 flex-col gap-2 px-4 py-3">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="font-semibold text-text [overflow-wrap:anywhere]">
              {row.note || t("operatorAccount.payments.noNote")}
            </span>
            <span className="text-[13px] text-text-muted tabular-nums">{formatDateLocalized(row.paidAt, { language })}</span>
          </span>
          {amount(row)}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {recordedBy(row)}
          {statusBadge(row)}
        </div>
        {cancelReason(row)}
      </div>
    ),
    [amount, cancelReason, language, recordedBy, statusBadge, t],
  );

  const footer =
    payments.data && total > 0 ? (
      <ListFooter
        page={page}
        total={total}
        busy={payments.isFetching}
        onPageChange={setPage}
        pagination={(range) => t("operatorAccount.payments.pagination", range)}
        summary={t("operatorAccount.payments.summary", { total: formatNumberLocalized(total, { language }) })}
        sum={
          balance.data ? (
            <span>
              {t("operatorAccount.totalLabel")}{" "}
              <span className="font-semibold text-text">{formatMoneyLocalized(balance.data.paid, { language })}</span>
            </span>
          ) : null
        }
      />
    ) : undefined;

  return (
    <Card
      as="section"
      padding="none"
      title={t("operatorAccount.payments.title")}
      description={t("operatorAccount.payments.description")}
      footer={footer}
    >
      <QueryBoundary
        query={{
          data: payments.data?.items,
          isLoading: payments.isLoading,
          isError: payments.isError,
          error: payments.error,
          refetch: payments.refetch,
        }}
        loadingLabel={t("operatorAccount.payments.loading")}
        loading={LIST_LOADING}
        empty={
          <EmptyState
            icon={ReceiptText}
            title={t("operatorAccount.payments.emptyTitle")}
            description={t("operatorAccount.payments.emptyDescription")}
          />
        }
      >
        {(rows) => (
          <DataTable
            rows={rows}
            columns={columns}
            getRowKey={(row) => row.id}
            label={t("operatorAccount.payments.title")}
            cardsLabel={t("operatorAccount.payments.title")}
            density="tablet-tight"
            renderCard={renderCard}
            busy={payments.isFetching && payments.isPlaceholderData}
            className="border-t border-border"
          />
        )}
      </QueryBoundary>
    </Card>
  );
};

/** Buyurtma tafsiloti (barcha rollar uchun v2 sahifa). */
const orderHref = (row: OperatorEarning) => `/orders/edit/${row.orderId}`;

/**
 * «DAROMADLAR» (B1te60bD, faqat o'qish) — `GET finance/operators/:operator_id/earnings` (limit/offset; har sotilgan
 * buyurtma uchun sotuv paytidagi stavka bilan hisoblangan komissiya). Ustunlar maketdagidek: Buyurtma (№ — tafsilotga
 * havola) · Buyurtma summasi · Stavka (< 1024 yashirin) · Daromad · Sana. Telefonda kartalar («360 000 so'm × 5%»).
 * Maket yo'q — eng yaqini `market_operator-earnings` («Daromadlar»).
 */
export const OperatorAccountEarningsCard = ({ operatorId }: { operatorId: string }) => {
  const { t } = useTranslation("users");
  const language = useMoneyLanguage();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const earnings = useOperatorAccountEarnings(operatorId, {
    limit: OPERATOR_ACCOUNT_PAGE_SIZE,
    offset: (page - 1) * OPERATOR_ACCOUNT_PAGE_SIZE,
  });
  const balance = useOperatorAccountBalance(operatorId);
  const lastPage = clampedPage(earnings.data, page);
  if (lastPage !== null) setPage(lastPage);
  const total = earnings.data?.total ?? 0;

  const money = useCallback((value: number | null) => (value === null ? "—" : formatMoneyLocalized(value, { language })), [language]);
  const rate = useCallback(
    (row: OperatorEarning) =>
      row.commissionType && row.commissionValue !== null
        ? formatCommissionValue(row.commissionType, row.commissionValue, language)
        : "—",
    [language],
  );
  const earned = useCallback(
    (row: OperatorEarning) => (
      <span className="whitespace-nowrap font-semibold text-text tabular-nums">
        {formatSignedMoneyLocalized(row.amount, { language })}
      </span>
    ),
    [language],
  );
  const created = useCallback(
    (row: OperatorEarning) => (row.createdAt ? formatDateTimeLocalized(row.createdAt, { language }) : "—"),
    [language],
  );

  const columns = useMemo<DataTableColumn<OperatorEarning>[]>(
    () => [
      {
        id: "order",
        header: t("operatorAccount.earnings.order"),
        cell: (row) => (
          // Qatorni bosish — sichqoncha uchun; klaviatura uchun qatorda havola (DataTable qoidasi).
          <Link to={orderHref(row)} className="font-semibold text-text hover:text-action-fg hover:underline">
            {t("operatorAccount.earnings.orderId", { id: row.orderId })}
          </Link>
        ),
      },
      {
        id: "orderTotal",
        header: t("operatorAccount.earnings.orderTotal"),
        align: "end",
        hideBelow: "lg",
        cellClassName: "tabular-nums",
        cell: (row) => money(row.orderTotal),
      },
      { id: "rate", header: t("operatorAccount.earnings.rate"), hideBelow: "lg", cell: rate },
      { id: "amount", header: t("operatorAccount.earnings.amount"), align: "end", cell: earned },
      {
        id: "date",
        header: t("operatorAccount.earnings.date"),
        cellClassName: "whitespace-nowrap text-text-muted tabular-nums",
        cell: created,
      },
    ],
    [created, earned, money, rate, t],
  );

  const renderCard = useCallback(
    (row: OperatorEarning) => (
      <Pressable
        onClick={() => navigate(orderHref(row))}
        className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left text-sm text-text"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-semibold">{t("operatorAccount.earnings.orderId", { id: row.orderId })}</span>
          <span className="text-[13px] text-text-muted tabular-nums">{created(row)}</span>
          {row.orderTotal !== null && rate(row) !== "—" ? (
            <span className="text-[13px] text-text-muted tabular-nums">
              {/* Foiz — «360 000 so'm × 5%»; qat'iy summa ko'paytirilmaydi — «280 000 so'm · qat'iy 3 000 so'm». */}
              {t(row.commissionType === "fixed" ? "operatorAccount.earnings.rateLineFixed" : "operatorAccount.earnings.rateLine", {
                total: money(row.orderTotal),
                rate: rate(row),
              })}
            </span>
          ) : null}
        </span>
        {earned(row)}
        <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-text-muted" />
      </Pressable>
    ),
    [created, earned, money, navigate, rate, t],
  );

  const footer =
    earnings.data && total > 0 ? (
      <ListFooter
        page={page}
        total={total}
        busy={earnings.isFetching}
        onPageChange={setPage}
        pagination={(range) => t("operatorAccount.earnings.pagination", range)}
        summary={t("operatorAccount.earnings.summary", { total: formatNumberLocalized(total, { language }) })}
        sum={
          balance.data ? (
            <span>
              {t("operatorAccount.totalLabel")}{" "}
              <span className="font-semibold text-text">{formatMoneyLocalized(balance.data.earned, { language })}</span>
            </span>
          ) : null
        }
      />
    ) : undefined;

  return (
    <Card
      as="section"
      padding="none"
      title={t("operatorAccount.earnings.title")}
      description={t("operatorAccount.earnings.description")}
      footer={footer}
    >
      <QueryBoundary
        query={{
          data: earnings.data?.items,
          isLoading: earnings.isLoading,
          isError: earnings.isError,
          error: earnings.error,
          refetch: earnings.refetch,
        }}
        loadingLabel={t("operatorAccount.earnings.loading")}
        loading={LIST_LOADING}
        empty={
          <EmptyState
            icon={ShoppingBag}
            title={t("operatorAccount.earnings.emptyTitle")}
            description={t("operatorAccount.earnings.emptyDescription")}
          />
        }
      >
        {(rows) => (
          <DataTable
            rows={rows}
            columns={columns}
            getRowKey={(row) => row.id}
            label={t("operatorAccount.earnings.title")}
            cardsLabel={t("operatorAccount.earnings.title")}
            density="tablet-tight"
            onRowClick={(row) => navigate(orderHref(row))}
            renderCard={renderCard}
            busy={earnings.isFetching && earnings.isPlaceholderData}
            className="border-t border-border"
          />
        )}
      </QueryBoundary>
    </Card>
  );
};
