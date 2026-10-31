// dizayn-v2: superadmin-payments-overview, admin-payments-overview, manager-payments-overview
import { memo, useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  daysBetween,
  isFinanceDailyForbidden,
  useFinanceHistoryDaily,
  type FinanceDailyParams,
} from "../../../entities/payments/financeDaily";
import { cx } from "../../../shared/lib/cx";
import {
  formatMoneyLocalized,
  formatNumberLocalized,
  formatPercentLocalized,
  formatSignedMoneyLocalized,
} from "../../../shared/lib/formatMoney";
import { ChartLegend, ViewToggle, type ChartView } from "../../../shared/ui/charts";
import { Card, ErrorState, SkeletonChart } from "../../../shared/ui/primitives";
import { formatRangeShort } from "../../../shared/ui/primitives/date/calendarMath";
import DailyFlowChart from "./DailyFlowChart";

type CashFlowCardProps = {
  /** `staff` — «Pul oqimi» (superadmin/admin); `manager` — «Kassa oqimi» (filial kassasi). */
  variant: "staff" | "manager";
  /** So'rov: sana + `GET /finance/history` bilan bir xil filtrlar (`history/daily` shartnomasi). */
  params: FinanceDailyParams;
  /** Sarlavhadagi kassa nomi: «Asosiy kassa» yoki filtrdagi kassa turi. */
  cashboxLabel: string;
  className?: string;
};

type Stat = { key: string; label: string; value: string; hint?: string; tone: string; legend?: string; line?: boolean };

/**
 * «PUL OQIMI» / «KASSA OQIMI» (maket `superadmin-payments-overview`, `manager-payments-overview`): davr jami va kunlik
 * kirim/chiqim — `GET /finance/history/daily` (server agregati, yuklangan sahifadan emas). Yuklanishda skelet, xatoda
 * «Qayta urinish» (0 deb ko'rsatilmaydi), 403 da karta jim yashirinadi — sahifa ishlayveradi.
 */
const CashFlowCard = ({ variant, params, cashboxLabel, className }: CashFlowCardProps) => {
  const { t, i18n } = useTranslation("payments");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const titleId = useId();
  const [view, setView] = useState<ChartView>("chart");
  const query = useFinanceHistoryDaily(params);
  const isStaff = variant === "staff";
  const copy = isStaff ? "v2Daily.flow" : "v2Daily.managerFlow";

  const data = query.data ?? null;
  const signed = (value: number) => formatSignedMoneyLocalized(value, { language });
  const range = data ? formatRangeShort({ from: data.from, to: data.to }) ?? "" : "";

  const stats = useMemo<Stat[]>(() => {
    if (!data) return [];
    const { income, expense, net, incomeCount, expenseCount } = data.totals;
    const money = (value: number) => formatSignedMoneyLocalized(value, { language });
    const count = (value: number) => t("v2Daily.flow.operations", { value: formatNumberLocalized(value, { language }) });
    if (isStaff) {
      return [
        {
          key: "income",
          label: t("v2Daily.flow.totalIncome"),
          value: money(income),
          hint: count(incomeCount),
          tone: income > 0 ? "text-success-fg" : "text-text",
          legend: "bg-chart-1",
        },
        {
          key: "expense",
          label: t("v2Daily.flow.totalExpense"),
          value: money(-expense),
          hint: count(expenseCount),
          tone: expense > 0 ? "text-danger-fg" : "text-text",
          legend: "bg-chart-8",
        },
        {
          key: "net",
          label: t("v2Daily.net"),
          value: money(net),
          hint:
            income > 0 && net > 0
              ? t("v2Daily.flow.retained", { percent: formatPercentLocalized((net / income) * 100, { language }) })
              : undefined,
          tone: "text-text",
          legend: "bg-text-muted",
          line: true,
        },
      ];
    }
    const dayCount = formatNumberLocalized(daysBetween(data.from, data.to), { language });
    return [
      {
        key: "income",
        label: t("v2Daily.managerFlow.income", { count: dayCount }),
        value: money(income),
        tone: income > 0 ? "text-success-fg" : "text-text",
      },
      {
        key: "expense",
        label: t("v2Daily.managerFlow.expense", { count: dayCount }),
        value: money(-expense),
        tone: expense > 0 ? "text-danger-fg" : "text-text",
      },
      { key: "net", label: t("v2Daily.netChange"), value: money(net), tone: "text-text" },
    ];
  }, [data, isStaff, language, t]);

  if (query.isError && isFinanceDailyForbidden(query.error)) return null;

  const subtitle = data
    ? t(`${copy}.subtitle`, { range, cashbox: cashboxLabel })
    : t(`${copy}.subtitleEmpty`, { cashbox: cashboxLabel });
  const legend = [
    { key: "income", label: t("v2Daily.income"), tone: "action" as const, keyClassName: "bg-chart-1" },
    { key: "expense", label: t("v2Daily.expense"), tone: "danger" as const, keyClassName: "bg-chart-8" },
    ...(isStaff
      ? [{ key: "net", label: t("v2Daily.flow.netLegend"), tone: "neutral" as const, keyClassName: "bg-text-muted", line: true }]
      : []),
  ];

  return (
    <Card as="section" divided={false} aria-labelledby={titleId} bodyClassName="flex flex-col gap-4" className={cx("min-w-0", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
          <h2 id={titleId} className="text-base font-bold text-text">
            {t(`${copy}.title`)}
          </h2>
          <p className="text-[13px] leading-[18px] text-text-muted">{subtitle}</p>
        </div>
        {data ? <ViewToggle value={view} onChange={setView} ariaLabel={t(`${copy}.viewLabel`)} /> : null}
      </div>

      {query.isLoading ? (
        <div role="status" aria-label={t("v2Daily.flow.loading")}>
          <SkeletonChart className="h-[290px] max-md:h-44" bars={14} />
        </div>
      ) : !data ? (
        <ErrorState
          size="chart"
          error={query.error}
          title={t("v2Daily.flow.loadError")}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <>
          <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(min(160px,100%),1fr))] gap-x-4 gap-y-3 max-md:flex max-md:flex-col max-md:gap-0">
            {stats.map((stat) => (
              <div
                key={stat.key}
                className="flex min-w-0 flex-col gap-0.5 max-md:flex-row max-md:items-center max-md:justify-between max-md:gap-2 max-md:border-t max-md:border-border max-md:py-2 max-md:first:border-t-0"
              >
                <dt className="inline-flex items-center gap-1.5 text-xs text-text-muted max-md:text-[13px]">
                  {stat.legend ? (
                    <span
                      aria-hidden="true"
                      className={cx(stat.line ? "h-0.5 w-3 rounded-full" : "size-2.5 rounded-[3px]", stat.legend)}
                    />
                  ) : null}
                  {stat.label}
                </dt>
                <dd className={cx("m-0 whitespace-nowrap text-xl leading-7 font-bold max-md:text-sm max-md:leading-5 max-md:font-semibold", stat.tone)}>
                  {stat.value}
                </dd>
                {stat.hint ? <dd className="m-0 text-xs text-text-muted max-md:hidden">{stat.hint}</dd> : null}
              </div>
            ))}
          </dl>
          <DailyFlowChart
            days={data.days}
            view={view}
            showNet={isStaff}
            tableLabel={t(`${copy}.title`)}
            ariaLabel={t(`${copy}.aria`, {
              cashbox: cashboxLabel,
              range,
              income: formatMoneyLocalized(data.totals.income, { language }),
              expense: formatMoneyLocalized(data.totals.expense, { language }),
              net: signed(data.totals.net),
            })}
          />
          <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 border-t border-border pt-4">
            <ChartLegend items={legend} />
            {isStaff ? null : <span className="text-xs text-text-muted">{t("v2Daily.managerFlow.note")}</span>}
          </div>
        </>
      )}
    </Card>
  );
};

export default memo(CashFlowCard);
