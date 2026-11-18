// dizayn-v2: market_operator-earnings, market_operator-earnings-no-commission
import { useCallback, useMemo, useState } from "react";
import { ReceiptText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useMyOperatorBalance, useMyOperatorPayments, type OperatorPayment } from "../../../entities/operator-payment";
import { cx } from "../../../shared/lib/cx";
import { formatDateLocalized } from "../../../shared/lib/formatDateTime";
import { formatMoneyLocalized, formatNumberLocalized, resolveMoneyLanguage } from "../../../shared/lib/formatMoney";
import {
  Badge,
  Card,
  DataTable,
  EmptyState,
  Pagination,
  QueryBoundary,
  SkeletonLines,
  type DataTableColumn,
} from "../../../shared/ui/primitives";
import { MY_PAYMENTS_PAGE_SIZE } from "./EarningsSummary";

/**
 * «TO'LOVLAR» (maket `market_operator-earnings`; F2qp6FtE / 37vonCdg) — market sizga bergan to'lovlar, faqat o'qish:
 * `GET finance/operators/me/payments` (limit/offset). Ustunlar: Summa · Izoh · Sana (to'lov sanasi); bekor qilingan
 * yozuv — summa chizilgan + «Bekor qilingan» (sabab bilan). Telefonda ro'yxat (izoh va sana chapda, summa o'ngda).
 * Pastda «N ta to'lov» + «Jami: …» (`/me/balance` → `paid`); ko'p bo'lsa — sahifalash. Bo'sh — «Hali to'lov yo'q».
 */
export const MyPaymentsCard = ({ className }: { className?: string }) => {
  const { t, i18n } = useTranslation("myEarnings");
  const language = resolveMoneyLanguage(i18n.resolvedLanguage ?? i18n.language);
  const [page, setPage] = useState(1);
  const offset = (page - 1) * MY_PAYMENTS_PAGE_SIZE;
  const payments = useMyOperatorPayments({ limit: MY_PAYMENTS_PAGE_SIZE, offset });
  const balance = useMyOperatorBalance();
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

  const noteCell = useCallback(
    (row: OperatorPayment) => (
      <span className="flex min-w-0 flex-col items-start gap-1">
        <span className="[overflow-wrap:anywhere]">{row.note || "—"}</span>
        {row.status === "cancelled" ? (
          <Badge tone="danger" dot>
            {t("payments.cancelled")}
          </Badge>
        ) : null}
        {row.status === "cancelled" && row.cancelReason ? (
          <span className="text-[13px] text-text-muted [overflow-wrap:anywhere]">
            {t("payments.cancelReason", { reason: row.cancelReason })}
          </span>
        ) : null}
      </span>
    ),
    [t],
  );

  const columns = useMemo<DataTableColumn<OperatorPayment>[]>(
    () => [
      { id: "amount", header: t("payments.amount"), cell: amount },
      { id: "note", header: t("payments.note"), cell: noteCell },
      {
        id: "date",
        header: t("payments.date"),
        cellClassName: "whitespace-nowrap text-text-muted tabular-nums",
        cell: (row) => formatDateLocalized(row.paidAt, { language }),
      },
    ],
    [amount, language, noteCell, t],
  );

  const renderCard = useCallback(
    (row: OperatorPayment) => (
      <div className="flex min-w-0 items-start justify-between gap-3 px-4 py-3">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="font-semibold text-text [overflow-wrap:anywhere]">{row.note || t("payments.noNote")}</span>
          <span className="text-[13px] text-text-muted tabular-nums">{formatDateLocalized(row.paidAt, { language })}</span>
          {row.status === "cancelled" ? (
            <span className="mt-1">
              <Badge tone="danger" dot>
                {t("payments.cancelled")}
              </Badge>
            </span>
          ) : null}
        </span>
        {amount(row)}
      </div>
    ),
    [amount, language, t],
  );

  const footer =
    payments.data && total > 0 ? (
      total > MY_PAYMENTS_PAGE_SIZE ? (
        <Pagination
          page={page}
          pageSize={MY_PAYMENTS_PAGE_SIZE}
          total={total}
          onPageChange={setPage}
          disabled={payments.isFetching}
          summary={(range) => t("payments.pagination", range)}
        />
      ) : (
        <div className="flex w-full flex-wrap items-center justify-between gap-2 text-[13px] text-text-muted">
          <span>{t("payments.summary", { total: formatNumberLocalized(total, { language }) })}</span>
          {balance.data ? (
            <span>
              {t("payments.totalLabel")}{" "}
              <span className="font-semibold text-text">{formatMoneyLocalized(balance.data.paid, { language })}</span>
            </span>
          ) : null}
        </div>
      )
    ) : undefined;

  return (
    <Card
      padding="none"
      title={t("payments.title")}
      description={t("payments.description")}
      footer={footer}
      className={className}
    >
      <QueryBoundary
        query={{
          data: payments.data?.items,
          isLoading: payments.isLoading,
          isError: payments.isError,
          error: payments.error,
          refetch: payments.refetch,
        }}
        loading={
          <div className="p-5">
            <SkeletonLines lines={4} />
          </div>
        }
        empty={<EmptyState icon={ReceiptText} title={t("payments.emptyTitle")} description={t("payments.emptyDescription")} />}
      >
        {(rows) => (
          <DataTable
            rows={rows}
            columns={columns}
            getRowKey={(row) => row.id}
            label={t("payments.title")}
            cardsLabel={t("payments.title")}
            renderCard={renderCard}
            busy={payments.isFetching && payments.isPlaceholderData}
          />
        )}
      </QueryBoundary>
    </Card>
  );
};
