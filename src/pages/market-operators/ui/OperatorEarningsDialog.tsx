// dizayn-v2: (maket yo'q) market_operator-earnings
import { memo, useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ReceiptText, ShoppingBag } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatCommissionValue } from "../../../entities/market-operator";
import {
  useMarketOperatorEarnings,
  type OperatorBalance,
  type OperatorEarning,
} from "../../../entities/operator-payment";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatMoneyLocalized, formatNumberLocalized, resolveMoneyLanguage } from "../../../shared/lib/formatMoney";
import {
  DataTable,
  Dialog,
  EmptyState,
  Pagination,
  QueryBoundary,
  type DataTableColumn,
} from "../../../shared/ui/primitives";

/** Sahifadagi qatorlar soni (oyna ichida — qisqa ro'yxat). */
export const OPERATOR_EARNINGS_PAGE_SIZE = 10;

/** Buyurtma tafsiloti (market ham ochadi — `canViewOrders`). */
const orderHref = (row: OperatorEarning) => `/orders/edit/${row.orderId}`;

type Props = {
  /** Ochiq oyna operatori; `null` — yopiq. */
  operator: OperatorBalance | null;
  onClose: () => void;
};

/**
 * «DAROMADLAR» OYNASI (2026-11-20; maket yo'q — eng yaqini `market_operator-earnings` va superadmin
 * `OperatorAccountEarningsCard`). Ega: «operator nomidan yaratilgan buyurtmalarga xizmat haqqi ko'rsatilmayapti» —
 * market endi «Ishlab topdi» summasining tarkibini ko'radi: har sotilgan buyurtma, uning summasi, sotuv paytidagi
 * stavka va ulush (`GET finance/operator-payments/earnings`). Komissiya faqat SOTUVDA yozilgani tepada aytiladi,
 * yo'ldagi buyurtmalar soni bilan.
 */
export const OperatorEarningsDialog = memo(({ operator, onClose }: Props) => {
  const { t, i18n } = useTranslation("marketOperators");
  const language = resolveMoneyLanguage(i18n.resolvedLanguage ?? i18n.language);
  const [page, setPage] = useState(1);
  const [shownFor, setShownFor] = useState<string | null>(null);
  const operatorId = operator?.operatorId ?? null;
  // Boshqa operator ochilsa — birinchi sahifadan (render paytida, effekt emas).
  if (operatorId !== shownFor) {
    setShownFor(operatorId);
    setPage(1);
  }
  const earnings = useMarketOperatorEarnings(operatorId, { page, limit: OPERATOR_EARNINGS_PAGE_SIZE });
  const total = earnings.data?.total ?? 0;
  const name = operator ? operator.operatorName || operator.operatorId : "";

  const money = useCallback(
    (value: number | null) => (value === null ? "—" : formatMoneyLocalized(value, { language })),
    [language],
  );
  const rate = useCallback(
    (row: OperatorEarning) =>
      row.commissionType && row.commissionValue !== null
        ? formatCommissionValue(row.commissionType, row.commissionValue, language)
        : "—",
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
        header: t("payments.earnings.order"),
        cell: (row) => (
          <Link to={orderHref(row)} className="font-semibold text-text hover:text-action-fg hover:underline">
            {t("payments.earnings.orderId", { id: row.orderId })}
          </Link>
        ),
      },
      {
        id: "orderTotal",
        header: t("payments.earnings.orderTotal"),
        align: "end",
        hideBelow: "lg",
        cellClassName: "tabular-nums",
        cell: (row) => money(row.orderTotal),
      },
      { id: "rate", header: t("payments.earnings.rate"), hideBelow: "lg", cell: rate },
      {
        id: "amount",
        header: t("payments.earnings.amount"),
        align: "end",
        cellClassName: "whitespace-nowrap font-semibold tabular-nums",
        cell: (row) => money(row.amount),
      },
      {
        id: "date",
        header: t("payments.earnings.date"),
        cellClassName: "whitespace-nowrap text-text-muted tabular-nums",
        cell: created,
      },
    ],
    [created, money, rate, t],
  );

  const renderCard = useCallback(
    (row: OperatorEarning) => (
      <div className="flex min-h-14 items-center gap-3 px-4 py-3 text-sm text-text">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Link to={orderHref(row)} className="font-semibold text-text hover:underline">
            {t("payments.earnings.orderId", { id: row.orderId })}
          </Link>
          <span className="text-[13px] text-text-muted tabular-nums">{created(row)}</span>
          {row.orderTotal !== null && rate(row) !== "—" ? (
            <span className="text-[13px] text-text-muted tabular-nums">
              {t("payments.earnings.rateLine", { total: money(row.orderTotal), rate: rate(row) })}
            </span>
          ) : null}
        </span>
        <span className="whitespace-nowrap font-semibold tabular-nums">{money(row.amount)}</span>
      </div>
    ),
    [created, money, rate, t],
  );

  const pending = operator?.ordersPending ?? 0;

  return (
    <Dialog
      open={operator !== null}
      onClose={onClose}
      size="lg"
      icon={ReceiptText}
      title={t("payments.earnings.title", { name })}
      description={t("payments.earnings.description")}
    >
      <div className="flex min-w-0 flex-col gap-3">
        {operator ? (
          <p className="m-0 text-sm text-text">
            {t("payments.earnings.summary", { amount: money(operator.earned) })}
            {pending > 0
              ? ` ${t("payments.earnings.pending", { value: formatNumberLocalized(pending, { language }) })}`
              : ""}
          </p>
        ) : null}
        <QueryBoundary
          query={{
            data: earnings.data?.items,
            isLoading: earnings.isLoading,
            isError: earnings.isError,
            error: earnings.error,
            refetch: earnings.refetch,
          }}
          loadingLabel={t("payments.earnings.loading")}
          empty={
            <EmptyState
              icon={ShoppingBag}
              title={t("payments.earnings.emptyTitle")}
              description={t("payments.earnings.emptyDescription")}
            />
          }
        >
          {(rows) => (
            <DataTable
              rows={rows}
              columns={columns}
              getRowKey={(row) => row.id}
              label={t("payments.earnings.label", { name })}
              cardsLabel={t("payments.earnings.label", { name })}
              density="tablet-tight"
              renderCard={renderCard}
              busy={earnings.isFetching && earnings.isPlaceholderData}
            />
          )}
        </QueryBoundary>
        {total > OPERATOR_EARNINGS_PAGE_SIZE ? (
          <Pagination
            page={page}
            pageSize={OPERATOR_EARNINGS_PAGE_SIZE}
            total={total}
            onPageChange={setPage}
            disabled={earnings.isFetching}
            summary={(range) => t("payments.earnings.pagination", range)}
          />
        ) : null}
      </div>
    </Dialog>
  );
});
OperatorEarningsDialog.displayName = "OperatorEarningsDialog";
