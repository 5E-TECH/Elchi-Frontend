// dizayn-v2: investor-dashboard-home, investor-profits-list
import { useTranslation } from "react-i18next";
import type { InvestorProfit } from "../../../entities/investors";
import { formatDateLocalized } from "../../../shared/lib/formatDateTime";
import { formatMoneyLocalized, formatPercentLocalized } from "../../../shared/lib/formatMoney";
import { DataTable, StatusBadge } from "../../../shared/ui/primitives";
import { formatPeriodRange, monthNames, monthTitleOf } from "../lib/format";

export interface ProfitHistoryTableProps {
  rows: readonly InvestorProfit[];
  /** Tashqi o'ram klassi (karta ichida — `border-t` kerak emas: sarlavha chizig'i bor). */
  className?: string;
  busy?: boolean;
  /** Jadval / kartalar ro'yxati nomi (sukut «Foyda tarixi»; `/profits` da — «Foyda yozuvlari»). */
  label?: string;
}

/**
 * FOYDA TARIXI jadvali (maket `investor-dashboard-home` → «Foyda tarixi» va `/profits` — `investor-profits-list`, IN-2): Davr
 * (oraliq + oy nomi), Foiz, Summa, Holat (To'langan — yashil, Kutilmoqda — sariq; so'z + nuqta), To'langan sana.
 * Planshetda «Foiz» va «To'langan sana» yashirin, telefonda kartalar. Tartib serverda (`period_start` DESC) —
 * sarlavhada saralash tugmasi yo'q.
 */
export const ProfitHistoryTable = ({ rows, className, busy, label }: ProfitHistoryTableProps) => {
  const { t, i18n } = useTranslation(["investor", "ui"]);
  const language = i18n.language;
  const names = monthNames(t);
  const money = (value: number) => formatMoneyLocalized(value, { language });
  const percent = (value: number | null) => (value == null ? "—" : formatPercentLocalized(value, { language, fractionDigits: 2 }));
  const status = (row: InvestorProfit) =>
    row.isPaid ? (
      <StatusBadge tone="success" label={t("profits.statusPaid")} />
    ) : (
      <StatusBadge tone="warning" label={t("profits.statusPending")} />
    );

  return (
    <DataTable<InvestorProfit>
      rows={rows}
      getRowKey={(row, index) => row.id || `profit-${index}`}
      label={label ?? t("profits.label")}
      cardsLabel={label ?? t("profits.label")}
      className={className}
      busy={busy}
      columns={[
        {
          id: "period",
          header: t("profits.colPeriod"),
          cell: (row) => (
            <span className="flex min-w-0 flex-col">
              <span className="whitespace-nowrap font-semibold text-text">{formatPeriodRange(row.periodStart, row.periodEnd)}</span>
              <span className="text-[13px] text-text-muted">{monthTitleOf(row.periodEnd, names)}</span>
            </span>
          ),
        },
        { id: "percent", header: t("profits.colPercent"), align: "end", hideBelow: "lg", cell: (row) => percent(row.percentage) },
        {
          id: "amount",
          header: t("profits.colAmount"),
          align: "end",
          cell: (row) => <span className="font-semibold">{money(row.amount)}</span>,
        },
        { id: "status", header: t("profits.colStatus"), cell: status },
        {
          id: "paidAt",
          header: t("profits.colPaidAt"),
          hideBelow: "lg",
          cell: (row) =>
            row.isPaid && row.paidAt ? formatDateLocalized(row.paidAt) : <span className="text-text-subtle">—</span>,
        },
      ]}
      renderCard={(row) => (
        <div className="flex min-w-0 flex-col gap-1 px-4 py-3">
          <span className="flex justify-between gap-2">
            <span className="font-semibold text-text">{formatPeriodRange(row.periodStart, row.periodEnd)}</span>
            <span className="whitespace-nowrap font-semibold text-text">{money(row.amount)}</span>
          </span>
          <span className="flex flex-wrap items-center gap-1.5">
            {status(row)}
            <span className="text-xs text-text-muted">{percent(row.percentage)}</span>
            <span className="ml-auto whitespace-nowrap text-xs text-text-muted">
              {row.isPaid && row.paidAt
                ? t("profits.cardPaid", { date: formatDateLocalized(row.paidAt) })
                : row.isPaid
                  ? t("profits.statusPaid")
                  : t("profits.cardPending")}
            </span>
          </span>
        </div>
      )}
    />
  );
};
