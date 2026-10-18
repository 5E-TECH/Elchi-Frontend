// dizayn-v2: superadmin-ops-finance-operators
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import {
  CURRENCY_LABEL,
  formatCompactMoneyLocalized,
  formatMoneyLocalized,
  formatNumberLocalized,
  formatPercentLocalized,
  resolveMoneyLanguage,
} from "../../../shared/lib/formatMoney";
import { Card } from "../../../shared/ui/primitives";
import type { OperatorBalance } from "../lib/operatorFinance";

/**
 * «Operator N balansi» (maket `superadmin-ops-finance-operators` → `#c-bal`): «Operatorga to'lanishi kerak»
 * katta summa, sharshara «Ishlab topgan / To'langan / Qoldiq» (`.el-waterfall`, CSS ustunlar — LedgerFlow
 * naqshi: o'sish/kamayish uchun `--div-*` tokeni ilovada yo'q, jami `text-muted`, kamayish `chart-8`),
 * yonida yorliqli ro'yxat va «To'langan ulushi» o'lchagichi (`paid / earned`).
 * Hammasi `GET /finance/operators/:id/balance` dagi `earned`, `paid`, `balance` dan.
 */

type Column = { key: string; label: string; from: number; to: number; tone: "total" | "down" };

const BAR_CLASS: Record<Column["tone"], string> = {
  total: "bg-text-muted",
  down: "bg-chart-8",
};

export const OperatorBalanceCard = ({ operatorId, balance }: { operatorId: string; balance: OperatorBalance }) => {
  const { t, i18n } = useTranslation("ops");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const lang = resolveMoneyLanguage(language);
  const { earned, paid, balance: rest } = balance;

  const money = (value: number) => formatMoneyLocalized(value, { language });
  const compact = (value: number) => formatCompactMoneyLocalized(value, { language, withCurrency: false, fractionDigits: 2 });

  const columns: Column[] = [
    { key: "earned", label: t("finance.balance.earned"), from: 0, to: earned, tone: "total" },
    { key: "paid", label: t("finance.balance.paid"), from: earned, to: earned - paid, tone: "down" },
    { key: "rest", label: t("finance.balance.rest"), from: 0, to: rest, tone: "total" },
  ];

  // Shkala: 0 dan eng katta qiymatgacha (manfiy qoldiq — ortiqcha to'langan — nolda kesiladi).
  const max = Math.max(earned, paid, rest, 1);
  const pct = (value: number) => (Math.max(0, Math.min(value, max)) / max) * 100;

  const paidShare = earned > 0 ? Math.min((paid / earned) * 100, 100) : 0;
  const paidShareText = formatPercentLocalized(paidShare, { language });

  const rows = [
    { key: "earned", label: t("finance.balance.earned"), value: money(earned), keyClass: BAR_CLASS.total, strong: false },
    { key: "paid", label: t("finance.balance.paid"), value: money(-paid), keyClass: BAR_CLASS.down, strong: false },
    { key: "rest", label: t("finance.balance.rest"), value: money(rest), keyClass: BAR_CLASS.total, strong: true },
  ];

  return (
    <Card
      divided={false}
      title={t("finance.balance.title", { id: operatorId })}
      description={t("finance.balance.subtitle")}
      bodyClassName="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-text-muted">{t("finance.balance.due")}</span>
        <span className="whitespace-nowrap text-[28px] leading-9 font-bold tracking-[-.01em] text-text proportional-nums max-md:text-[22px] max-md:leading-[30px]">
          {formatNumberLocalized(Math.round(rest), { language })}
          <span className="ml-1 text-sm font-semibold tracking-normal text-text-muted max-md:text-[13px]">
            {CURRENCY_LABEL[lang]}
          </span>
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
        <figure className="m-0 flex min-w-0 flex-[1_1_300px] flex-col gap-2 pt-6">
          <div
            role="img"
            aria-label={t("finance.balance.waterfallAria", { balance: money(rest), earned: money(earned), paid: money(paid) })}
            className="relative grid h-[190px] min-w-0 auto-cols-fr grid-flow-col"
          >
            <span aria-hidden="true" className="absolute inset-x-0 bottom-0 border-t border-border" />
            {columns.map((column, index) => {
              const low = Math.min(column.from, column.to);
              const high = Math.max(column.from, column.to);
              const next = columns[index + 1];
              const value = column.tone === "down" ? -paid : column.to;
              return (
                <div key={column.key} className="relative h-full min-w-0">
                  <span
                    aria-hidden="true"
                    className={cx("absolute left-1/2 -ml-3 w-6 min-h-[3px] rounded-[4px]", BAR_CLASS[column.tone])}
                    style={{ bottom: `${pct(low)}%`, height: `${pct(high) - pct(low)}%` }}
                  />
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -translate-y-full whitespace-nowrap pb-1 text-center text-xs font-bold text-text"
                    style={{ top: `${100 - pct(high)}%` }}
                  >
                    {compact(value)}
                  </span>
                  {next ? (
                    <span
                      aria-hidden="true"
                      className="absolute left-[calc(50%+12px)] h-0 w-[calc(100%-24px)] border-t border-border"
                      style={{ bottom: `${pct(column.tone === "down" ? column.to : high)}%` }}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
          <figcaption aria-hidden="true" className="grid auto-cols-fr grid-flow-col gap-1 text-center text-xs text-text-muted">
            {columns.map((column) => (
              <span key={column.key}>{column.label}</span>
            ))}
          </figcaption>
        </figure>

        <dl className="m-0 flex min-w-0 flex-[1_1_260px] flex-col border-t border-border">
          {rows.map((row, index) => (
            <div
              key={row.key}
              className={cx(
                "flex items-center justify-between gap-3 py-2.5",
                index < rows.length - 1 && "border-b border-border",
              )}
            >
              <dt className="flex min-w-0 items-center gap-2 text-[13px] text-text">
                <span aria-hidden="true" className={cx("size-2.5 shrink-0 rounded-[3px]", row.keyClass)} />
                <span className={cx(row.strong && "font-semibold")}>{row.label}</span>
              </dt>
              <dd className="m-0 whitespace-nowrap font-semibold text-text">{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex justify-between gap-2 text-[13px]">
          <span className="font-semibold text-text">{t("finance.balance.paidShare")}</span>
          <span className="text-text">{paidShareText}</span>
        </div>
        <div
          role="meter"
          aria-label={t("finance.balance.paidShareAria", { value: paidShareText })}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(paidShare * 10) / 10}
          className="h-3 overflow-hidden rounded-full bg-action-soft"
        >
          <span className="block h-full rounded-full bg-chart-1" style={{ width: `${paidShare}%` }} />
        </div>
      </div>
    </Card>
  );
};
