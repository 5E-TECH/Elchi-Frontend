// dizayn-v2: (maket yo'q) market_operator-earnings, market-operators-list
import { memo, useCallback, useMemo } from "react";
import { CircleX, Landmark } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { OperatorPayment } from "../../../entities/operator-payment";
import { cx } from "../../../shared/lib/cx";
import { formatDateLocalized } from "../../../shared/lib/formatDateTime";
import { formatMoneyLocalized, resolveMoneyLanguage } from "../../../shared/lib/formatMoney";
import { Badge, Button, DataTable, Skeleton, type DataTableColumn } from "../../../shared/ui/primitives";

type Props = {
  rows: readonly OperatorPayment[];
  busy?: boolean;
  onCancel: (payment: OperatorPayment) => void;
};

/**
 * TO'LOVLAR TARIXI (F2qp6FtE): Sana (to'lov sanasi) · Operator · Summa · Izoh (< 1024 yashirin) · Holat · amal.
 * Holat: market yozuvi — «Yozilgan»; bekor qilingan — «Bekor qilingan» + sabab (summa chizilgan); eski Elchi
 * yozuvi — «Elchi kassasidan» (Elchi ilgari Asosiy kassadan to'lagan, bekor qilinmaydi). «Bekor qilish» — faqat
 * `can_cancel` (o'z yozuvi, faol). Telefonda kartalar. Maket yo'q — eng yaqini `market_operator-earnings`
 * («To'lovlar»: Summa · Izoh · Sana).
 */
export const OperatorPaymentsTable = memo(({ rows, busy, onCancel }: Props) => {
  const { t, i18n } = useTranslation("marketOperators");
  const language = resolveMoneyLanguage(i18n.resolvedLanguage ?? i18n.language);

  const operatorName = useCallback(
    (row: OperatorPayment) => row.operatorName ?? t("payments.history.deletedOperator"),
    [t],
  );

  const amountText = useCallback(
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

  const statusCell = useCallback(
    (row: OperatorPayment) => {
      if (row.status === "cancelled") {
        return (
          <span className="flex flex-col items-start gap-1">
            <Badge tone="danger" dot>
              {t("payments.history.cancelled")}
            </Badge>
            {row.cancelReason ? (
              <span className="text-[13px] text-text-muted [overflow-wrap:anywhere]">
                {t("payments.history.cancelReason", { reason: row.cancelReason })}
              </span>
            ) : null}
          </span>
        );
      }
      if (row.source === "elchi") {
        return (
          <span className="flex flex-col items-start gap-1">
            <Badge tone="info" icon={Landmark}>
              {/* Kassa izi bor eski yozuv — «Elchi kassasidan»; izsiz (AUDIT M6 dan oldingi) — «Elchi yozuvi». */}
              {t(row.affectsCashbox ? "payments.history.elchi" : "payments.history.elchiRecord")}
            </Badge>
            <span className="text-[13px] text-text-muted">{t("payments.history.elchiHint")}</span>
          </span>
        );
      }
      return (
        <Badge tone="success" dot>
          {t("payments.history.active")}
        </Badge>
      );
    },
    [t],
  );

  const cancelButton = useCallback(
    (row: OperatorPayment, className?: string) =>
      row.canCancel ? (
        <Button
          size="sm"
          variant="ghost"
          leftIcon={CircleX}
          className={className}
          aria-label={t("payments.history.cancelFor", {
            amount: formatMoneyLocalized(row.amount, { language }),
            name: operatorName(row),
          })}
          onClick={() => onCancel(row)}
        >
          {t("payments.history.cancel")}
        </Button>
      ) : null,
    [language, onCancel, operatorName, t],
  );

  const columns = useMemo<DataTableColumn<OperatorPayment>[]>(
    () => [
      {
        id: "date",
        header: t("payments.history.date"),
        cellClassName: "whitespace-nowrap tabular-nums",
        cell: (row) => formatDateLocalized(row.paidAt, { language }),
      },
      {
        id: "operator",
        header: t("payments.history.operator"),
        cell: (row) => (
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="font-semibold text-text [overflow-wrap:anywhere]">{operatorName(row)}</span>
            {/* Planshetda «Izoh» ustuni yashirin — izoh ism ostida. */}
            {row.note ? (
              <span className="hidden text-[13px] text-text-muted [overflow-wrap:anywhere] max-lg:block">{row.note}</span>
            ) : null}
          </span>
        ),
      },
      { id: "amount", header: t("payments.history.amount"), align: "end", cell: amountText },
      {
        id: "note",
        header: t("payments.history.note"),
        hideBelow: "lg",
        cellClassName: "text-text-muted [overflow-wrap:anywhere]",
        cell: (row) => row.note || "—",
      },
      { id: "status", header: t("payments.history.status"), cell: statusCell },
      {
        id: "actions",
        header: <span className="sr-only">{t("payments.history.actions")}</span>,
        cellClassName: "text-right",
        cell: (row) => cancelButton(row),
      },
    ],
    [amountText, cancelButton, language, operatorName, statusCell, t],
  );

  const renderCard = useCallback(
    (row: OperatorPayment) => (
      <div className="flex min-w-0 flex-col gap-2 px-4 py-3">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="font-semibold text-text [overflow-wrap:anywhere]">{operatorName(row)}</span>
            <span className="text-[13px] text-text-muted tabular-nums">
              {formatDateLocalized(row.paidAt, { language })}
              {row.note ? ` · ${row.note}` : ""}
            </span>
          </span>
          {amountText(row)}
        </div>
        <div>{statusCell(row)}</div>
        {cancelButton(row, "w-full")}
      </div>
    ),
    [amountText, cancelButton, language, operatorName, statusCell],
  );

  return (
    <DataTable
      rows={rows}
      columns={columns}
      getRowKey={(row) => row.id}
      label={t("payments.history.label")}
      cardsLabel={t("payments.history.label")}
      density="tablet-tight"
      renderCard={renderCard}
      busy={busy}
      className="border-t border-border"
    />
  );
});
OperatorPaymentsTable.displayName = "OperatorPaymentsTable";

const SKELETON_ROWS = [0, 1, 2, 3];

export const OperatorPaymentsSkeleton = memo(() => {
  const { t } = useTranslation("marketOperators");
  const columns = useMemo<DataTableColumn<number>[]>(
    () => [
      { id: "date", header: t("payments.history.date"), cell: () => <Skeleton tone="border" width={88} /> },
      { id: "operator", header: t("payments.history.operator"), cell: () => <Skeleton tone="border" width={140} /> },
      {
        id: "amount",
        header: t("payments.history.amount"),
        align: "end",
        cell: () => <Skeleton tone="border" width={96} className="ml-auto" />,
      },
      {
        id: "note",
        header: t("payments.history.note"),
        hideBelow: "lg",
        cell: () => <Skeleton tone="border" width={120} />,
      },
      { id: "status", header: t("payments.history.status"), cell: () => <Skeleton tone="border" width={72} height={22} /> },
      { id: "actions", header: <span className="sr-only">{t("payments.history.actions")}</span>, cell: () => null },
    ],
    [t],
  );
  return (
    <div aria-hidden="true">
      <DataTable
        rows={SKELETON_ROWS}
        columns={columns}
        getRowKey={(index) => String(index)}
        density="tablet-tight"
        renderCard={() => (
          <div className="flex flex-col gap-2 px-4 py-3">
            <Skeleton tone="border" width="55%" height={14} />
            <Skeleton tone="border" width="35%" />
          </div>
        )}
        className="border-t border-border"
      />
    </div>
  );
});
OperatorPaymentsSkeleton.displayName = "OperatorPaymentsSkeleton";
