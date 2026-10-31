// dizayn-v2: superadmin-balance-history, admin-balance-history
import { memo, useId, useMemo, useState } from "react";
import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  isFinanceDailyForbidden,
  shiftDay,
  toDailyRange,
  useFinancialBalanceDaily,
} from "../../../entities/payments/financeDaily";
import { cx } from "../../../shared/lib/cx";
import { toISODate } from "../../../shared/lib/dateRange";
import { formatDateLocalized, formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import {
  formatCompactMoneyLocalized,
  formatMoneyLocalized,
  formatNumberLocalized,
  formatPercentLocalized,
  formatSignedMoneyLocalized,
} from "../../../shared/lib/formatMoney";
import { ViewToggle, type ChartView } from "../../../shared/ui/charts";
import { Card } from "../../../shared/ui/primitives";
import { formatRangeShort } from "../../../shared/ui/primitives/date/calendarMath";
import MainCashboxBalanceChart from "../../payments/components/MainCashboxBalanceChart";
import type { DailyBalancePoint } from "../../payments/components/lib/mainCashboxStats";

type LedgerBalanceCardProps = {
  fromDate: string;
  toDate: string;
  /** Sahifa KPI'sidagi «Umumiy balans» (izohda); noma'lum — `null`. */
  generalBalance: number | null;
};

/**
 * «DAFTAR QOLDIG'I» (maket `superadmin-balance-history`): har kun oxiridagi P&L daftari qoldig'i, davr boshi, sof
 * o'zgarish va eng yuqori kun — `GET /finance/financial-balance/daily`. Sana filtri bo'lmasa — oxirgi 14 kun; manba
 * filtri grafikka tegishli emas (backend parametri yo'q). 403 da karta yashirinadi, xatoda «Qayta urinish».
 */
const LedgerBalanceCard = ({ fromDate, toDate, generalBalance }: LedgerBalanceCardProps) => {
  const { t, i18n } = useTranslation("payments");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const titleId = useId();
  const [view, setView] = useState<ChartView>("chart");
  const range = useMemo(() => toDailyRange({ from: fromDate, to: toDate }), [fromDate, toDate]);
  const query = useFinancialBalanceDaily(range);
  const data = query.data ?? null;

  const money = (value: number | null) => (value === null ? "—" : formatMoneyLocalized(value, { language }));
  const today = toISODate(new Date());
  const reachesToday = range.to >= today;

  const points = useMemo<DailyBalancePoint[]>(() => {
    if (!data) return [];
    const opening = data.ledger.openingBalance;
    const days = data.days.flatMap((day) =>
      day.ledger.closingBalance === null
        ? []
        : [
            {
              date: day.date,
              balance: day.ledger.closingBalance,
              income: day.ledger.income,
              expense: day.ledger.expense,
            },
          ],
    );
    return opening === null ? days : [{ date: shiftDay(data.from, -1), balance: opening, income: 0, expense: 0 }, ...days];
  }, [data]);

  if (query.isError && isFinanceDailyForbidden(query.error)) return null;

  const ledger = data?.ledger;
  const net = ledger?.net ?? 0;
  const opening = ledger?.openingBalance ?? null;
  const facts = ledger
    ? [
        {
          key: "current",
          label: t(reachesToday ? "v2Daily.ledger.current" : "v2Daily.ledger.periodEnd"),
          value: money(ledger.closingBalance),
          hint: reachesToday
            ? t("v2Daily.ledger.currentHint", { time: formatDateTimeLocalized(query.dataUpdatedAt, { language }) })
            : formatDateLocalized(range.to, { language }),
          tone: "text-text",
        },
        {
          key: "start",
          label: t("v2Daily.ledger.start"),
          value: money(opening),
          hint: t("v2Daily.ledger.startHint", { date: formatDateLocalized(shiftDay(data?.from ?? range.from, -1), { language }) }),
          tone: "text-text",
        },
        {
          key: "net",
          label: t("v2Daily.netChange"),
          value: formatSignedMoneyLocalized(net, { language }),
          hint: [
            opening ? `${net > 0 ? "+" : ""}${formatPercentLocalized((net / Math.abs(opening)) * 100, { language })}` : null,
            t("v2Daily.ledger.entries", { value: formatNumberLocalized(ledger.count, { language }) }),
          ]
            .filter(Boolean)
            .join(" · "),
          tone: net > 0 ? "text-success-fg" : net < 0 ? "text-danger-fg" : "text-text",
        },
        {
          key: "peak",
          label: t("v2Daily.ledger.peak"),
          value: money(ledger.peak?.balance ?? null),
          hint: ledger.peak ? formatDateLocalized(ledger.peak.date, { language }) : undefined,
          tone: "text-text",
        },
      ]
    : [];

  return (
    <Card as="section" divided={false} aria-labelledby={titleId} bodyClassName="flex flex-col gap-4" className="min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
          <h2 id={titleId} className="text-base font-bold text-text">
            {t("v2Daily.ledger.title")}
          </h2>
          <p className="text-[13px] leading-[18px] text-text-muted">
            {t("v2Daily.ledger.subtitle", { range: formatRangeShort(range) ?? "" })}
          </p>
        </div>
        <ViewToggle value={view} onChange={setView} ariaLabel={t("v2Daily.ledger.viewLabel")} />
      </div>
      {facts.length > 0 ? (
        <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(min(160px,100%),1fr))] gap-x-4 gap-y-3 max-md:flex max-md:flex-col max-md:gap-0">
          {facts.map((fact) => (
            <div
              key={fact.key}
              className="flex min-w-0 flex-col gap-0.5 max-md:flex-row max-md:items-center max-md:justify-between max-md:gap-2 max-md:border-t max-md:border-border max-md:py-2 max-md:first:border-t-0"
            >
              <dt className="text-xs text-text-muted max-md:text-[13px]">{fact.label}</dt>
              <dd className={cx("m-0 whitespace-nowrap text-xl leading-7 font-bold max-md:text-sm max-md:leading-5 max-md:font-semibold", fact.tone)}>
                {fact.value}
              </dd>
              {fact.hint ? <dd className="m-0 text-xs text-text-muted max-md:hidden">{fact.hint}</dd> : null}
            </div>
          ))}
        </dl>
      ) : null}
      <MainCashboxBalanceChart
        points={points}
        view={view}
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        onRetry={() => void query.refetch()}
        chartLabelKey="v2Daily.ledger.chartLabel"
        tableLabel={t("v2Daily.ledger.title")}
      />
      <p className="m-0 flex items-start gap-2 border-t border-border pt-4 text-xs text-text-subtle">
        <Info aria-hidden="true" size={14} className="mt-px shrink-0" />
        <span>
          {generalBalance === null
            ? t("v2Daily.ledger.noteNoTotal")
            : t("v2Daily.ledger.note", { total: formatCompactMoneyLocalized(generalBalance, { language }) })}
        </span>
      </p>
    </Card>
  );
};

export default memo(LedgerBalanceCard);
