// dizayn-v2: (maket yo'q) market_operator-earnings, market-operators-list
import { memo, useCallback, useMemo } from "react";
import { HandCoins, ReceiptText } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { OperatorBalance } from "../../../entities/operator-payment";
import { cx } from "../../../shared/lib/cx";
import { formatDateLocalized } from "../../../shared/lib/formatDateTime";
import { formatMoneyLocalized, formatNumberLocalized, resolveMoneyLanguage } from "../../../shared/lib/formatMoney";
import { Button, DataTable, Skeleton, type DataTableColumn } from "../../../shared/ui/primitives";
import type { PaymentDialogOperator } from "./RecordOperatorPaymentDialog";
import { OperatorAvatar } from "./OperatorsTable";

type Props = {
  rows: readonly OperatorBalance[];
  onRecord: (operator: PaymentDialogOperator) => void;
  /** «Daromadlar» — operator ishlab topgan summaning tarkibi (qaysi buyurtmadan qancha). */
  onEarnings: (operator: OperatorBalance) => void;
};

/**
 * HAR OPERATOR HISOBI (F2qp6FtE): Operator · Buyurtmalar («41 sotilgan · 9 yo'lda», < 1024 yashirin; 2026-11-20) ·
 * Ishlab topdi · To'landi · Qoldiq (qalin; manfiy — «Ortiqcha to'langan»)
 * · Oxirgi to'lov (< 1024 yashirin) · «To'lov yozish» (ikkinchi darajali, sarlavhadagi asosiy tugma bilan bir xil
 * oyna, operator tanlangan). Telefonda kartalar: ism, uch katakli qator (maket `market_operator-earnings` telefon
 * «Hisob» qatori kabi) va to'liq enli tugma. Maket yo'q — eng yaqini `market_operator-earnings`, `market-operators-list`.
 */
export const OperatorBalancesTable = memo(({ rows, onRecord, onEarnings }: Props) => {
  const { t, i18n } = useTranslation("marketOperators");
  const language = resolveMoneyLanguage(i18n.resolvedLanguage ?? i18n.language);
  const money = useCallback((value: number) => formatMoneyLocalized(value, { language }), [language]);

  const nameOf = useCallback((row: OperatorBalance) => row.operatorName || row.operatorId, []);
  const nameClass = (row: OperatorBalance) =>
    cx("font-semibold [overflow-wrap:anywhere]", row.status === "active" ? "text-text" : "text-text-muted");
  /** Holat izohi: nofaol / o'chirilgan (faolda — yo'q). */
  const statusNote = useCallback(
    (row: OperatorBalance) =>
      row.status === "deleted" ? t("status.deleted") : row.status === "inactive" ? t("status.inactive") : null,
    [t],
  );
  /**
   * 2026-11-20: «41 sotilgan · 9 yo'lda» — komissiya faqat sotilganidan yoziladi; yo'ldagisi sotilsa yoziladi.
   * Backend sanamagan bo'lsa — «—».
   */
  const ordersText = useCallback(
    (row: OperatorBalance) =>
      row.ordersSold === null || row.ordersPending === null
        ? "—"
        : t("payments.balances.ordersValue", {
            sold: formatNumberLocalized(row.ordersSold, { language }),
            pending: formatNumberLocalized(row.ordersPending, { language }),
          }),
    [language, t],
  );

  const balanceCell = useCallback(
    (row: OperatorBalance) => (
      <span className="flex flex-col items-end gap-0.5">
        <span className="whitespace-nowrap font-semibold text-text tabular-nums">{money(row.balance)}</span>
        {row.balance < 0 ? (
          <span className="whitespace-nowrap text-[13px] text-text-muted">{t("payments.balances.overpaid")}</span>
        ) : null}
      </span>
    ),
    [money, t],
  );

  const recordButton = useCallback(
    (row: OperatorBalance, className?: string) => (
      <Button
        size="sm"
        variant="secondary"
        leftIcon={HandCoins}
        className={className}
        aria-label={t("payments.balances.recordFor", { name: nameOf(row) })}
        onClick={() => onRecord({ id: row.operatorId, name: nameOf(row) })}
      >
        {t("payments.record")}
      </Button>
    ),
    [nameOf, onRecord, t],
  );

  /** «Daromadlar» va (o'chirilmagan operatorga) «To'lov yozish». */
  const actions = useCallback(
    (row: OperatorBalance, className?: string) => (
      <span className={cx("inline-flex flex-wrap justify-end gap-2", className)}>
        <Button
          size="sm"
          variant="ghost"
          leftIcon={ReceiptText}
          aria-haspopup="dialog"
          aria-label={t("payments.balances.earningsFor", { name: nameOf(row) })}
          onClick={() => onEarnings(row)}
          className={className ? "flex-1" : undefined}
        >
          {t("payments.balances.earnings")}
        </Button>
        {row.status === "deleted" ? null : recordButton(row, className ? "flex-1" : undefined)}
      </span>
    ),
    [nameOf, onEarnings, recordButton, t],
  );

  const columns = useMemo<DataTableColumn<OperatorBalance>[]>(
    () => [
      {
        id: "operator",
        header: t("payments.balances.operator"),
        cell: (row) => (
          <div className="flex min-w-0 items-center gap-3">
            <OperatorAvatar name={nameOf(row)} />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className={nameClass(row)}>{nameOf(row)}</span>
              {statusNote(row) ? <span className="text-[13px] text-text-muted">{statusNote(row)}</span> : null}
            </span>
          </div>
        ),
      },
      {
        id: "orders",
        header: t("payments.balances.orders"),
        hideBelow: "lg",
        cellClassName: "whitespace-nowrap text-text-muted tabular-nums",
        cell: ordersText,
      },
      {
        id: "earned",
        header: t("payments.balances.earned"),
        align: "end",
        cellClassName: "tabular-nums",
        cell: (row) => money(row.earned),
      },
      {
        id: "paid",
        header: t("payments.balances.paid"),
        align: "end",
        cellClassName: "tabular-nums",
        cell: (row) => money(row.paid),
      },
      { id: "balance", header: t("payments.balances.balance"), align: "end", cell: balanceCell },
      {
        id: "lastPaid",
        header: t("payments.balances.lastPaid"),
        hideBelow: "lg",
        cellClassName: "whitespace-nowrap text-text-muted tabular-nums",
        cell: (row) => (row.lastPaidAt ? formatDateLocalized(row.lastPaidAt, { language }) : t("payments.balances.never")),
      },
      {
        id: "actions",
        header: <span className="sr-only">{t("payments.balances.actions")}</span>,
        cellClassName: "text-right",
        cell: (row) => actions(row),
      },
    ],
    [actions, balanceCell, language, money, nameOf, ordersText, statusNote, t],
  );

  const renderCard = useCallback(
    (row: OperatorBalance) => (
      <div className="flex min-w-0 flex-col gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <OperatorAvatar name={nameOf(row)} size={40} />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className={nameClass(row)}>{nameOf(row)}</span>
            <span className="text-[13px] text-text-muted">
              {row.lastPaidAt
                ? t("payments.balances.lastPaidShort", { date: formatDateLocalized(row.lastPaidAt, { language }) })
                : t("payments.balances.never")}
              {statusNote(row) ? ` · ${statusNote(row)}` : ""}
            </span>
            {ordersText(row) === "—" ? null : (
              <span className="text-[13px] text-text-muted tabular-nums">
                {t("payments.balances.ordersShort", { value: ordersText(row) })}
              </span>
            )}
          </span>
        </div>
        <dl className="m-0 grid grid-cols-3 overflow-hidden rounded-xl border border-border">
          {(
            [
              ["earned", row.earned],
              ["paid", row.paid],
              ["balance", row.balance],
            ] as const
          ).map(([key, value], index) => (
            <div key={key} className={cx("flex min-w-0 flex-col gap-0.5 px-3 py-2", index > 0 && "border-l border-border")}>
              <dt className="truncate text-xs font-semibold text-text-muted">{t(`payments.balances.${key}`)}</dt>
              <dd className="m-0 truncate text-sm font-semibold text-text tabular-nums">
                {formatMoneyLocalized(value, { language, withCurrency: false })}
              </dd>
            </div>
          ))}
        </dl>
        {row.balance < 0 ? (
          <span className="text-[13px] text-text-muted">
            {t("payments.balances.overpaidBy", { amount: money(-row.balance) })}
          </span>
        ) : null}
        {actions(row, "w-full")}
      </div>
    ),
    [actions, language, money, nameOf, ordersText, statusNote, t],
  );

  return (
    <DataTable
      rows={rows}
      columns={columns}
      getRowKey={(row) => row.operatorId}
      label={t("payments.balances.label")}
      cardsLabel={t("payments.balances.label")}
      density="tablet-tight"
      renderCard={renderCard}
      className="border-t border-border"
    />
  );
});
OperatorBalancesTable.displayName = "OperatorBalancesTable";

const SKELETON_ROWS = [0, 1, 2];

/** Yuklanish skeleti — jadval bilan bir xil ustunlar (sakramasin). */
export const OperatorBalancesSkeleton = memo(() => {
  const { t } = useTranslation("marketOperators");
  const columns = useMemo<DataTableColumn<number>[]>(
    () => [
      {
        id: "operator",
        header: t("payments.balances.operator"),
        cell: () => (
          <div className="flex items-center gap-3">
            <Skeleton tone="border" shape="circle" width={36} height={36} />
            <Skeleton tone="border" width={140} />
          </div>
        ),
      },
      {
        id: "orders",
        header: t("payments.balances.orders"),
        hideBelow: "lg" as const,
        cell: () => <Skeleton tone="border" width={120} />,
      },
      ...(["earned", "paid", "balance"] as const).map((key) => ({
        id: key,
        header: t(`payments.balances.${key}`),
        align: "end" as const,
        cell: () => <Skeleton tone="border" width={96} className="ml-auto" />,
      })),
      {
        id: "lastPaid",
        header: t("payments.balances.lastPaid"),
        hideBelow: "lg" as const,
        cell: () => <Skeleton tone="border" width={88} />,
      },
      {
        id: "actions",
        header: <span className="sr-only">{t("payments.balances.actions")}</span>,
        cell: () => <Skeleton tone="border" shape="block" width={120} height={32} className="ml-auto" />,
      },
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
          <div className="flex flex-col gap-3 px-4 py-3">
            <Skeleton tone="border" width="60%" height={14} />
            <Skeleton tone="border" shape="block" width="100%" height={48} />
          </div>
        )}
        className="border-t border-border"
      />
    </div>
  );
});
OperatorBalancesSkeleton.displayName = "OperatorBalancesSkeleton";
