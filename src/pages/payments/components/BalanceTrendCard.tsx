// dizayn-v2: manager-payments-main-cashbox
import { memo, useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  closingPoints,
  isFinanceDailyForbidden,
  lastDaysRange,
  useFinanceHistoryDaily,
} from "../../../entities/payments/financeDaily";
import { ViewToggle, type ChartView } from "../../../shared/ui/charts";
import { Card } from "../../../shared/ui/primitives";
import MainCashboxBalanceChart from "./MainCashboxBalanceChart";

/** «Balans dinamikasi» davri (maket: oxirgi 14 kun). */
const TREND_DAYS = 14;

/**
 * «BALANS DINAMIKASI» (maket `manager-payments-main-cashbox`): kassaning kun oxiridagi qoldig'i, oxirgi 14 kun —
 * `GET /finance/history/daily` (gateway menejerga o'z filiali kassasini qo'yadi). Snapshot hali qurilmagan bo'lsa
 * (`balance_status: pending`) qoldiqlar `null` — chiziq o'rnida izoh; 403 da karta jim yashirinadi.
 */
const BalanceTrendCard = ({ cashboxLabel, hidden = false }: { cashboxLabel: string; hidden?: boolean }) => {
  const { t } = useTranslation("payments");
  const titleId = useId();
  const [view, setView] = useState<ChartView>("chart");
  const params = useMemo(() => {
    const range = lastDaysRange(TREND_DAYS);
    return { from_date: range.from, to_date: range.to };
  }, []);
  const query = useFinanceHistoryDaily(params);
  const points = useMemo(() => closingPoints(query.data?.days ?? []), [query.data]);

  if (query.isError && isFinanceDailyForbidden(query.error)) return null;

  return (
    <Card as="section" divided={false} aria-labelledby={titleId} bodyClassName="flex flex-col gap-4" className="min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
          <h2 id={titleId} className="text-base font-bold text-text">
            {t("v2Daily.trend.title")}
          </h2>
          <p className="text-[13px] leading-[18px] text-text-muted">
            {t("v2Daily.trend.subtitle", { cashbox: cashboxLabel, count: TREND_DAYS })}
          </p>
        </div>
        <ViewToggle value={view} onChange={setView} ariaLabel={t("v2Daily.trend.viewLabel")} />
      </div>
      <MainCashboxBalanceChart
        points={points}
        view={view}
        hidden={hidden}
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        onRetry={() => void query.refetch()}
        chartLabelKey="v2Daily.trend.chartLabel"
        tableLabel={t("v2Daily.trend.title")}
        emptyHint={query.data?.balanceStatus === "pending" ? t("v2Daily.pendingHint") : undefined}
      />
    </Card>
  );
};

export default memo(BalanceTrendCard);
