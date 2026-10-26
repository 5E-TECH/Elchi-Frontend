// dizayn-v2: superadmin-payments-main-cashbox-shift-result-dialog, admin-payments-main-cashbox-shift-result-dialog, manager-payments-main-cashbox-shift-result-dialog
import { memo, type ReactNode } from "react";
import { Banknote, CircleCheck, CreditCard, Download, FileText, Info, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CashboxShift } from "../../../entities/payments";
import { cx } from "../../../shared/lib/cx";
import { formatDateTimeLocalized, formatTimeLocalized, toValidDate } from "../../../shared/lib/formatDateTime";
import { formatMoneyLocalized, formatSignedMoneyLocalized } from "../../../shared/lib/formatMoney";
import { Link } from "react-router-dom";
import { Badge, Button, buttonClasses, Dialog } from "../../../shared/ui/primitives";
import { ShiftDiffAmount, ShiftDiffBadge } from "./ShiftDiff";
import ShiftSummaryList, { type ShiftSummaryRow } from "./ShiftSummaryList";

/**
 * «SMENA YOPILDI» — NATIJA OYNASI (maketlar `{superadmin,admin,manager}-payments-main-cashbox-shift-result-dialog`).
 *
 * Qiymatlar faqat `POST finance/shift/close` javobidan (yakuniy kutilgan summa backendda hisoblanadi): naqd va
 * karta bo'yicha «Ochilishda · Kirim · Chiqim · Kutilgan · Sanalgan · Farq» — desktop/planshetda jadval, telefonda
 * ikki blok (Naqd, Karta). Karta sanalmagan (`discrepancy_card === null`) — «Sanalmadi» va izoh. Ostida ochgan /
 * yopgan xodim va izoh, «Excel hisobot yuklab olindi» eslatmasi; «Excelga yuklash» (qayta) va «Tayyor».
 *
 * Sahifa qayta yuklangandan keyin natijani ko'rsatish (`last_closed`) — Taklif · backend kerak (CB-3).
 */

type ShiftResultDialogProps = {
  open: boolean;
  onClose: () => void;
  shift: CashboxShift | null;
  openedByName?: string | null;
  closedByName?: string | null;
  /** «Asosiy kassa» yoki «Urgut filiali kassasi». */
  cashboxLabel: string;
  /** «Karta (Click)» (asosiy kassa) yoki «Karta» (filial). */
  cardLabel: string;
  onExport: () => void;
  /** kiZgTybn — kartalar tekshirilgan smenada «Smena hisoboti» havolasi (`/payments/shifts/:id`). */
  reportHref?: string | null;
};

type Column = "cash" | "card";
type MetricKey = "opening" | "income" | "expense" | "expected" | "counted" | "diff";

const METRICS: readonly MetricKey[] = ["opening", "income", "expense", "expected", "counted", "diff"];

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const num = (value: number | null | undefined) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

const ShiftResultDialog = ({
  open,
  onClose,
  shift,
  openedByName,
  closedByName,
  cashboxLabel,
  cardLabel,
  onExport,
  reportHref,
}: ShiftResultDialogProps) => {
  const { t, i18n } = useTranslation("payments");
  const language = i18n.resolvedLanguage ?? i18n.language;

  const opened = toValidDate(shift?.opened_at ?? null);
  const closed = toValidDate(shift?.closed_at ?? null);
  const range = opened
    ? closed
      ? `${formatDateTimeLocalized(opened, { language })} – ${
          sameDay(opened, closed) ? formatTimeLocalized(closed, { language }) : formatDateTimeLocalized(closed, { language })
        }`
      : formatDateTimeLocalized(opened, { language })
    : "";
  const description = range
    ? t("v2MainCashbox.shift.result.subtitle", { range, cashbox: cashboxLabel })
    : cashboxLabel;

  const notCountedBadge = <Badge>{t("v2MainCashbox.shift.diff.notCounted")}</Badge>;

  const values = (column: Column) => {
    const income = num(column === "cash" ? shift?.total_income_cash : shift?.total_income_card);
    const expense = num(column === "cash" ? shift?.total_expense_cash : shift?.total_expense_card);
    const diff = column === "cash" ? shift?.discrepancy_cash ?? null : shift?.discrepancy_card ?? null;
    const counted = column === "cash" ? shift?.closing_balance_cash : shift?.closing_balance_card;
    const expected = column === "cash" ? shift?.expected_balance_cash : shift?.expected_balance_card;
    const opening = column === "cash" ? shift?.opening_balance_cash : shift?.opening_balance_card;
    return { income, expense, diff, counted: num(counted), expected, opening: num(opening) };
  };

  const money = (value: number) => (
    <span className="whitespace-nowrap">{formatMoneyLocalized(value, { language })}</span>
  );

  /** Bitta katak qiymati (jadval va telefon bloklari uchun bir xil). */
  const cell = (column: Column, metric: MetricKey, layout: "table" | "list"): ReactNode => {
    const v = values(column);
    switch (metric) {
      case "opening":
        return money(v.opening);
      case "income":
        return (
          <span className={cx("whitespace-nowrap", v.income > 0 && "text-success-fg")}>
            {formatSignedMoneyLocalized(v.income, { language })}
          </span>
        );
      case "expense":
        return (
          <span className={cx("whitespace-nowrap", v.expense > 0 && "text-danger-fg")}>
            {formatSignedMoneyLocalized(-v.expense, { language })}
          </span>
        );
      case "expected":
        return (
          <span className="whitespace-nowrap font-semibold">
            {v.expected === null || v.expected === undefined ? "—" : formatMoneyLocalized(v.expected, { language })}
          </span>
        );
      case "counted":
        return v.diff === null ? (
          notCountedBadge
        ) : (
          <span className="whitespace-nowrap font-semibold">{formatMoneyLocalized(v.counted, { language })}</span>
        );
      case "diff":
        if (v.diff === null) return notCountedBadge;
        return layout === "table" ? (
          <span className="flex flex-col items-end gap-1">
            <ShiftDiffAmount diff={v.diff} />
            <ShiftDiffBadge diff={v.diff} />
          </span>
        ) : (
          <>
            <ShiftDiffAmount diff={v.diff} />
            <ShiftDiffBadge diff={v.diff} />
          </>
        );
    }
  };

  const metricLabel = (metric: MetricKey) => t(`v2MainCashbox.shift.result.${metric}`);
  const columns: Array<{ key: Column; label: string; icon: LucideIcon }> = [
    { key: "cash", label: t("v2MainCashbox.shift.cash"), icon: Banknote },
    { key: "card", label: cardLabel, icon: CreditCard },
  ];

  const cardNotCounted = Boolean(shift) && (shift?.discrepancy_card ?? null) === null;
  const comment = shift?.comment?.trim() ?? "";

  return (
    <Dialog
      open={open && Boolean(shift)}
      onClose={onClose}
      size="lg"
      icon={CircleCheck}
      iconTone="success"
      title={t("v2MainCashbox.shift.result.title")}
      description={description}
      footer={
        <>
          {reportHref ? (
            <Link to={reportHref} className={buttonClasses({ variant: "secondary" })} onClick={onClose}>
              <FileText aria-hidden="true" size={18} />
              {t("shiftCheck.resultReport")}
            </Link>
          ) : null}
          <Button variant="secondary" leftIcon={Download} onClick={onExport}>
            {t("v2MainCashbox.shift.result.export")}
          </Button>
          <Button onClick={onClose}>{t("v2MainCashbox.shift.result.done")}</Button>
        </>
      }
    >
      {/* Desktop / planshet — jadval (`.el-table.is-compact`). */}
      <div className="overflow-x-auto rounded-xl border border-border max-md:hidden">
        <table
          aria-label={t("v2MainCashbox.shift.result.tableLabel")}
          className="w-full border-collapse text-sm"
        >
          <thead>
            <tr>
              <th
                scope="col"
                className="h-9 border-b border-border bg-sunken px-3 text-left text-xs font-semibold uppercase tracking-[.04em] text-text-muted"
              >
                <span className="sr-only">{t("v2MainCashbox.shift.result.metric")}</span>
              </th>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className="h-9 whitespace-nowrap border-b border-border bg-sunken px-3 text-right text-xs font-semibold uppercase tracking-[.04em] text-text-muted"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METRICS.map((metric, index) => {
              // Oxirgi qatorda chiziq yo'q (tashqi ramka bor) — `th` uchun ham aniq, selektor ustunligiga bog'liq emas.
              const rowBorder = index < METRICS.length - 1 ? "border-b border-border" : "";
              return (
                <tr key={metric}>
                  <th
                    scope="row"
                    className={cx(
                      "h-11 px-3 py-1.5 text-left",
                      rowBorder,
                      metric === "diff" ? "font-semibold text-text" : "font-normal text-text-muted",
                    )}
                  >
                    {metricLabel(metric)}
                  </th>
                  {columns.map((column) => (
                    <td key={column.key} className={cx("h-11 px-3 py-1.5 text-right text-text", rowBorder)}>
                      {cell(column.key, metric, "table")}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Telefon — naqd va karta alohida bloklarda. */}
      <div className="hidden flex-col gap-4 max-md:flex">
        {columns.map((column) => {
          const Icon = column.icon;
          const rows: ShiftSummaryRow[] = METRICS.map((metric) => ({
            key: metric,
            label: metricLabel(metric),
            value: cell(column.key, metric, "list"),
            strong: metric === "diff",
            plain: metric === "opening" || metric === "income" || metric === "expense",
          }));
          return (
            <section key={column.key} aria-label={column.label} className="flex flex-col gap-2">
              <h3 className="m-0 inline-flex items-center gap-2 text-sm font-semibold text-text">
                <Icon aria-hidden="true" size={16} className="text-text-muted" />
                {column.label}
              </h3>
              <ShiftSummaryList rows={rows} />
            </section>
          );
        })}
      </div>

      {cardNotCounted ? (
        <p className="m-0 flex items-start gap-2 text-xs text-text-muted">
          <Info aria-hidden="true" size={16} className="mt-px shrink-0" />
          <span className="min-w-0">{t("v2MainCashbox.shift.result.cardNotCounted")}</span>
        </p>
      ) : null}

      <dl className="m-0 grid grid-cols-[minmax(120px,40%)_1fr] gap-x-4 gap-y-2.5 px-1 text-sm">
        <dt className="text-text-muted">{t("v2MainCashbox.shift.openedBy")}</dt>
        <dd className="m-0 min-w-0 font-semibold text-text">{openedByName?.trim() || "—"}</dd>
        <dt className="text-text-muted">{t("v2MainCashbox.shift.closedBy")}</dt>
        <dd className="m-0 min-w-0 font-semibold text-text">{closedByName?.trim() || "—"}</dd>
        {comment ? (
          <>
            <dt className="text-text-muted">{t("v2MainCashbox.shift.comment")}</dt>
            <dd className="m-0 min-w-0 text-text wrap-break-word">{comment}</dd>
          </>
        ) : null}
      </dl>

      <p className="m-0 flex items-start gap-2 text-xs text-text-muted">
        <Download aria-hidden="true" size={16} className="mt-px shrink-0" />
        <span className="min-w-0">{t("v2MainCashbox.shift.result.excelNote")}</span>
      </p>
    </Dialog>
  );
};

export default memo(ShiftResultDialog);
