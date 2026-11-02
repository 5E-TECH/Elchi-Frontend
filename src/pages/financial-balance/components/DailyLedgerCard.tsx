// dizayn-v2: superadmin-balance-analysis, admin-balance-analysis
import { memo, useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { FinancialBalanceDaily } from "../../../entities/payments/financeDaily";
import { formatMoneyLocalized, formatSignedMoneyLocalized } from "../../../shared/lib/formatMoney";
import { ChartLegend, ViewToggle, type ChartView } from "../../../shared/ui/charts";
import { Card, ErrorState, SkeletonChart } from "../../../shared/ui/primitives";
import { formatRangeShort } from "../../../shared/ui/primitives/date/calendarMath";
import DailyFlowChart, { type DailyFlowPoint } from "../../payments/components/DailyFlowChart";

type DailyLedgerCardProps = {
  data: FinancialBalanceDaily | null;
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  onRetry: () => void;
};

/**
 * «KUNLIK KIRIM VA CHIQIM» (maket `superadmin-balance-analysis`): har kuni daftarga qancha kirdi va chiqdi —
 * `GET /finance/financial-balance/daily` (`days[].ledger`). So'rov Tahlil tabida (davr bilan birga), 403 ni ham o'sha
 * yerda hal qiladi. Karta tahlilning qolgan qismiga bog'liq emas: xato bo'lsa faqat shu kartada «Qayta urinish».
 */
const DailyLedgerCard = ({ data, isLoading, isError, error, onRetry }: DailyLedgerCardProps) => {
  const { t, i18n } = useTranslation("payments");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const titleId = useId();
  const [view, setView] = useState<ChartView>("chart");
  const days = useMemo<DailyFlowPoint[]>(
    () =>
      (data?.days ?? []).map((day) => ({
        date: day.date,
        income: day.ledger.income,
        expense: day.ledger.expense,
        net: day.ledger.net,
      })),
    [data],
  );
  const range = data ? (formatRangeShort({ from: data.from, to: data.to }) ?? "") : "";

  return (
    <Card as="section" divided={false} aria-labelledby={titleId} bodyClassName="flex flex-col gap-4" className="min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
          <h2 id={titleId} className="text-base font-bold text-text">
            {t("v2Daily.dailyLedger.title")}
          </h2>
          <p className="text-[13px] leading-[18px] text-text-muted">
            {range ? t("v2Daily.dailyLedger.subtitle", { range }) : t("v2Daily.dailyLedger.subtitleEmpty")}
          </p>
        </div>
        {data ? <ViewToggle value={view} onChange={setView} ariaLabel={t("v2Daily.dailyLedger.viewLabel")} /> : null}
      </div>
      {isLoading ? (
        <div role="status" aria-label={t("v2Daily.flow.loading")}>
          <SkeletonChart className="h-[290px] max-md:h-44" bars={14} />
        </div>
      ) : isError || !data ? (
        <ErrorState size="chart" error={error} title={t("v2Daily.flow.loadError")} onRetry={onRetry} />
      ) : (
        <>
          <DailyFlowChart
            days={days}
            view={view}
            tableLabel={t("v2Daily.dailyLedger.title")}
            ariaLabel={t("v2Daily.dailyLedger.aria", {
              range,
              income: formatMoneyLocalized(data.ledger.income, { language }),
              expense: formatMoneyLocalized(data.ledger.expense, { language }),
              net: formatSignedMoneyLocalized(data.ledger.net, { language }),
            })}
          />
          <div className="border-t border-border pt-4">
            <ChartLegend
              items={[
                { key: "income", label: t("v2Daily.income"), tone: "action", keyClassName: "bg-chart-1" },
                { key: "expense", label: t("v2Daily.expense"), tone: "danger", keyClassName: "bg-chart-8" },
              ]}
            />
          </div>
        </>
      )}
    </Card>
  );
};

export default memo(DailyLedgerCard);
