// dizayn-v2: market-cashbox-my, courier-cashbox-my-all
import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  closingPoints,
  dayOverDay,
  isFinanceDailyForbidden,
  type DailyFlow,
  type FinanceHistoryDaily,
} from "../../../entities/payments/financeDaily";
import { cx } from "../../../shared/lib/cx";
import { toISODate } from "../../../shared/lib/dateRange";
import { formatDateLocalized, toValidDate } from "../../../shared/lib/formatDateTime";
import { formatMoneyLocalized, formatSignedMoneyLocalized } from "../../../shared/lib/formatMoney";
import { DeltaChip, Sparkline, Waterfall, type ChartView, type WaterfallStep } from "../../../shared/ui/charts";
import { formatRangeShort } from "../../../shared/ui/primitives/date/calendarMath";
import { groupBySource, type SourceBucket } from "./lib/mainCashboxStats";
import MainCashboxBalanceChart from "./MainCashboxBalanceChart";
import type { PaymentRow } from "./patmentHistoryTable";
import { getPaymentSourceTitle } from "./paymentSourceType";

/**
 * O'Z KASSAM — KUNLIK BLOKLAR (qzjTMWPb, `GET /finance/history/daily`; rol bo'yicha gateway o'z kassasini qo'yadi).
 * Maket: `courier-cashbox-my-all` («kechaga nisbatan», balans chizig'i, «Kassa oqimi»), `market-cashbox-my` («davr
 * boshiga nisbatan», «Davr oqimi»). Har blok ma'lumot bo'lmasa o'zi yashirinadi — balans va tarix ishlayveradi.
 */

export type DailyQueryState = {
  data?: FinanceHistoryDaily | null;
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  refetch: () => unknown;
};

export const isDailyAvailable = (query: DailyQueryState) => !(query.isError && isFinanceDailyForbidden(query.error));

/** Kuryer — kechagi kun bilan, market va filial — davr boshi bilan (maket). Noma'lum bo'lsa chizilmaydi. */
export const MyBalanceDelta = memo(
  ({ query, role, hidden, language }: { query: DailyQueryState; role: string; hidden: boolean; language: string }) => {
    const { t } = useTranslation("payments");
    const data = query.isError ? null : query.data;
    if (!data) return null;
    const isCourier = role === "courier";
    const amount = isCourier
      ? (dayOverDay(data.days)?.amount ?? null)
      : data.openingBalance === null || data.closingBalance === null
        ? null
        : data.closingBalance - data.openingBalance;
    if (amount === null) return null;
    return (
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
        <DeltaChip
          value={amount}
          goodWhen="none"
          text={hidden ? "••••••" : formatSignedMoneyLocalized(amount, { language, withCurrency: false })}
        />
        <span>
          {isCourier
            ? t("v2Daily.vsYesterday")
            : t("v2Daily.vsPeriodStart", { date: formatDateLocalized(data.from, { language }).slice(0, 5) })}
        </span>
      </span>
    );
  },
);

/**
 * 7/14 kunlik chiziq + ostidagi o'q qatori (maket `manager-payments-cash-detail-courier`, `courier-cashbox-my-all`):
 * «02.10 · Kun oxiridagi qoldiq · Bugun». Ikki nuqta bo'lmasa chizilmaydi.
 */
export const ClosingSpark = memo(
  ({ days, name, caption, language, className }: {
    days: readonly DailyFlow[];
    name: string;
    caption: string;
    language: string;
    className?: string;
  }) => {
    const { t } = useTranslation("payments");
    const points = closingPoints(days);
    if (points.length < 2) return null;
    const last = points[points.length - 1];
    return (
      <div className={cx("flex min-w-0 flex-col gap-1", className)}>
        <Sparkline
          values={points.map((point) => point.balance)}
          label={t("v2Daily.kpi.sparkLabel", {
            name,
            count: points.length,
            last: formatMoneyLocalized(last.balance, { language }),
          })}
        />
        <div className="flex justify-between gap-2 text-xs text-text-muted">
          <span>{formatDateLocalized(points[0].date, { language }).slice(0, 5)}</span>
          <span>{caption}</span>
          <span className="font-semibold text-text">
            {last.date === toISODate(new Date()) ? t("v2Daily.today") : formatDateLocalized(last.date, { language }).slice(0, 5)}
          </span>
        </div>
      </div>
    );
  },
);

/** Kun oxiridagi qoldiq. Snapshot hali yo'q (`pending`) — izoh; xatoda «Qayta urinish»; 403 da umuman chizilmaydi. */
export const MyBalanceTrend = memo(
  ({ query, view, hidden }: { query: DailyQueryState; view: ChartView; hidden: boolean }) => {
    const { t } = useTranslation("payments");
    const points = useMemo(() => closingPoints(query.data?.days ?? []), [query.data]);
    if (!isDailyAvailable(query)) return null;
    return (
      <MainCashboxBalanceChart
        points={points}
        view={view}
        hidden={hidden}
        isLoading={query.isLoading}
        isError={query.isError || (!query.isLoading && !query.data)}
        error={query.error}
        onRetry={() => void query.refetch()}
        chartLabelKey="v2Daily.my.chartLabel"
        tableLabel={t("v2MyCashbox.balance.title")}
        emptyHint={query.data?.balanceStatus === "pending" ? t("v2Daily.pendingHint") : undefined}
      />
    );
  },
);

/** Manba ustunlari ko'pi bilan 2 ta (har yo'nalishda) + «Boshqa»: 320 px kartaga 5–6 ustun sig'adi (maket). */
const TOP_SOURCES = 2;

const sumBuckets = (buckets: readonly SourceBucket[]) => buckets.reduce((sum, bucket) => sum + bucket.amount, 0);

type FlowInput = {
  rows: readonly PaymentRow[];
  income: number;
  expense: number;
  sourceLabel: (sourceType: string) => string;
  labels: { income: string; expense: string; other: string };
};

/**
 * Sharshara o'rtasi: tarix qatorlari server jami bilan aynan to'g'ri kelsa — manbalar bo'yicha, aks holda (masalan
 * «To'lov o'tkazmalari» tabi yoki qatorlar to'liq emas) — bitta «Kirim» va bitta «Chiqim» (yolg'on taqsimot yo'q).
 */
export const buildFlowSteps = ({ rows, income, expense, sourceLabel, labels }: FlowInput): WaterfallStep[] => {
  const incomeSources = groupBySource(rows, "income");
  const expenseSources = groupBySource(rows, "expense");
  const matches = sumBuckets(incomeSources) === income && sumBuckets(expenseSources) === expense;
  const toSteps = (buckets: SourceBucket[], kind: "up" | "down", fallback: string, total: number): WaterfallStep[] => {
    if (!matches) return total > 0 ? [{ key: `${kind}-total`, label: fallback, value: total, kind }] : [];
    const top = buckets.slice(0, TOP_SOURCES).map((bucket) => ({
      key: `${kind}-${bucket.sourceType}`,
      label: sourceLabel(bucket.sourceType),
      value: bucket.amount,
      kind,
    }));
    const rest = sumBuckets(buckets.slice(TOP_SOURCES));
    return rest > 0 ? [...top, { key: `${kind}-other`, label: labels.other, value: rest, kind }] : top;
  };
  return [...toSteps(incomeSources, "up", labels.income, income), ...toSteps(expenseSources, "down", labels.expense, expense)];
};

/** «Kassa oqimi» / «Davr oqimi»: davr boshi → kirim va chiqim manbalari → joriy balans. Qoldiq noma'lum — chizilmaydi. */
export const MyCashFlow = memo(
  ({ query, rows, role, hidden, language }: {
    query: DailyQueryState;
    rows: readonly PaymentRow[];
    role: string;
    hidden: boolean;
    language: string;
  }) => {
    const { t } = useTranslation("payments");
    const data = query.isError ? null : query.data;
    if (!data || data.openingBalance === null || data.closingBalance === null || hidden) return null;
    const { openingBalance, closingBalance } = data;
    if (data.totals.income === 0 && data.totals.expense === 0) return null;

    // Server kunni `createdAt` bo'yicha guruhlaydi — qatorlar ham shu sana bilan.
    const periodRows = rows.filter((row) => {
      const date = toValidDate(row.createdAt || row.created_at || row.payment_date);
      const day = date ? toISODate(date) : "";
      return day >= data.from && day <= data.to;
    });
    const middle = buildFlowSteps({
      rows: periodRows,
      income: data.totals.income,
      expense: data.totals.expense,
      sourceLabel: (sourceType) => getPaymentSourceTitle(sourceType, t, { role }),
      labels: { income: t("v2Daily.my.incomeStep"), expense: t("v2Daily.my.expenseStep"), other: t("v2Daily.my.other") },
    });
    const steps: WaterfallStep[] = [
      { key: "start", label: t("v2Daily.my.start"), value: openingBalance, kind: "start" },
      ...middle,
      { key: "end", label: t("v2Daily.my.end"), value: closingBalance, kind: "total" },
    ];
    const range = formatRangeShort({ from: data.from, to: data.to }) ?? "";

    return (
      <div className="flex min-w-0 flex-col gap-3 border-t border-border pt-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="text-sm font-semibold text-text">
            {t(role === "courier" ? "v2Daily.my.flowCourier" : "v2Daily.my.flowMarket")}
          </h3>
          <p className="text-[13px] text-text-muted">{t("v2Daily.my.flowSub", { range })}</p>
        </div>
        <Waterfall
          steps={steps}
          ariaLabel={t("v2Daily.my.flowAria", {
            range,
            steps: steps
              .map((step) => {
                const money = { language };
                const value =
                  step.kind === "up"
                    ? formatSignedMoneyLocalized(Math.abs(step.value), money)
                    : step.kind === "down"
                      ? formatSignedMoneyLocalized(-Math.abs(step.value), money)
                      : formatMoneyLocalized(step.value, money);
                return `${step.label} ${value}`;
              })
              .join(", "),
          })}
        />
      </div>
    );
  },
);
