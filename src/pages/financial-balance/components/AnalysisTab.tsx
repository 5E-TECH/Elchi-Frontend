import { memo, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bolt,
  ChevronLeft,
  ChevronRight,
  Sigma,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useCashBox } from "../../../entities/payments";
import FilterDateInput from "../../../shared/ui/FilterDateInput";
import { formatFinancialAmount, toFinancialNumber } from "../lib/financialBalance";

interface LedgerRow {
  id: string;
  date: string;
  sourceType: string;
  operationType: string;
  actor: string;
  amount: number;
  signedAmount: number;
}

interface SourceBucket {
  sourceType: string;
  label: string;
  amount: number;
  percent: number;
}

const PAGE_SIZE = 10;

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const formatDateTime = (value: string) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${day}.${month}.${year} ${hours}:${minutes}`;
};

const sourceTypeLabel = (value: string, t: (key: string) => string) => {
  const normalized = value.trim().toLowerCase();

  if (normalized === "sell" || normalized === "sell_profit") return t("financialBalanceSourceProfit");
  if (normalized === "manual_income") return t("financialBalanceSourceManualIncome");
  if (normalized === "manual_expense") return t("financialBalanceSourceManualExpense");
  if (normalized === "salary") return t("financialBalanceSourceSalary");
  if (normalized === "correction") return t("financialBalanceSourceCorrection");
  if (normalized === "bills") return t("financialBalanceSourceBills");

  return value || "-";
};

const getRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};

const pickName = (value: unknown) => {
  const record = getRecord(value);

  return String(
    record.name ??
      record.full_name ??
      record.username ??
      record.phone_number ??
      record.phone ??
      "",
  ).trim();
};

const getActorName = (item: Record<string, unknown>) =>
  pickName(item.user) ||
  pickName(item.source_user) ||
  pickName(item.created_by) ||
  pickName(getRecord(item.cashbox).user) ||
  String(item.source_id ?? "").trim();

const normalizeRows = (items: unknown[]): LedgerRow[] =>
  items.map((item, index) => {
    const record = getRecord(item);
    const amount = Math.abs(toFinancialNumber(record.amount));
    const operationType = String(record.operation_type ?? record.operationType ?? "");
    const signedAmount = operationType === "expense" ? -amount : amount;

    return {
      id: String(record.id ?? index),
      date: String(record.payment_date ?? record.paymentDate ?? record.createdAt ?? record.created_at ?? ""),
      sourceType: String(record.source_type ?? record.sourceType ?? ""),
      operationType,
      actor: getActorName(record),
      amount,
      signedAmount,
    };
  });

const buildBuckets = (
  rows: LedgerRow[],
  direction: "positive" | "negative",
  t: (key: string) => string,
): SourceBucket[] => {
  const filtered = rows.filter((row) => direction === "positive" ? row.signedAmount > 0 : row.signedAmount < 0);
  const total = filtered.reduce((sum, row) => sum + Math.abs(row.signedAmount), 0);
  const map = new Map<string, number>();

  filtered.forEach((row) => {
    const key = row.sourceType || "unknown";
    map.set(key, (map.get(key) ?? 0) + Math.abs(row.signedAmount));
  });

  return Array.from(map.entries())
    .map(([sourceType, amount]) => ({
      sourceType,
      label: sourceTypeLabel(sourceType === "unknown" ? "" : sourceType, t),
      amount,
      percent: total > 0 ? (amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
};

const StatCard = ({
  icon,
  label,
  value,
  currencyLabel,
  description,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  currencyLabel: string;
  description?: string;
  tone: "positive" | "negative" | "neutral";
}) => {
  const toneClass = {
    positive: "text-emerald-400 bg-emerald-500/15",
    negative: "text-red-400 bg-red-500/15",
    neutral: "text-main bg-main/15",
  }[tone];
  const valueClass =
    tone === "positive" ? "text-emerald-500" : tone === "negative" ? "text-red-500" : "text-main";

  return (
    <div className="rounded-2xl border border-gray-200 bg-primary p-5 shadow-sm dark:border-glass-border dark:bg-maindark">
      <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${toneClass}`}>
        {icon}
      </div>
      <p className="text-sm font-medium text-maindark/60 dark:text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-black tabular-nums ${valueClass}`}>
        {value > 0 && tone === "positive" ? "+" : value < 0 ? "-" : ""}
        {formatFinancialAmount(Math.abs(value), "comma")} {currencyLabel}
      </p>
      {description ? <p className="mt-2 text-xs font-semibold text-maindark/50 dark:text-slate-400">{description}</p> : null}
    </div>
  );
};

const SourcePanel = ({
  title,
  rows,
  tone,
  currencyLabel,
}: {
  title: string;
  rows: SourceBucket[];
  tone: "positive" | "negative";
  currencyLabel: string;
}) => {
  const color = tone === "positive" ? "bg-emerald-500 text-emerald-400" : "bg-red-500 text-red-400";

  return (
    <div className="rounded-2xl border border-gray-200 bg-primary p-5 shadow-sm dark:border-glass-border dark:bg-maindark">
      <div className="mb-5 flex items-center gap-2">
        {tone === "positive" ? <TrendingUp size={16} className="text-emerald-400" /> : <TrendingDown size={16} className="text-red-400" />}
        <p className="text-base font-bold text-maindark dark:text-white">{title}</p>
      </div>
      <div className="space-y-4">
        {rows.length ? rows.map((row) => (
          <div key={row.sourceType}>
            <div className="mb-2 flex items-center justify-between gap-4">
              <p className="min-w-0 truncate text-sm font-medium text-maindark/70 dark:text-slate-300">{row.label}</p>
              <div className="flex shrink-0 items-center gap-4 text-right">
                <p className={`text-sm font-black tabular-nums ${color.split(" ")[1]}`}>
                  {tone === "positive" ? "+" : "-"}
                  {formatFinancialAmount(row.amount, "comma")} {currencyLabel}
                </p>
                <p className="w-12 text-xs font-semibold text-maindark/45 dark:text-slate-400">{row.percent.toFixed(2)}%</p>
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-primarydark/40">
              <div className={`h-full rounded-full ${color.split(" ")[0]}`} style={{ width: `${Math.max(2, row.percent)}%` }} />
            </div>
          </div>
        )) : (
          <p className="py-6 text-center text-sm text-maindark/50 dark:text-slate-400">-</p>
        )}
      </div>
    </div>
  );
};

const AnalysisTab = () => {
  const { t } = useTranslation("payments");
  const currencyLabel = t("currency");
  const { useGetFinanceHistory } = useCashBox();
  const today = useMemo(() => new Date(), []);
  const [fromDate, setFromDate] = useState(toDateInputValue(today));
  const [toDate, setToDate] = useState(toDateInputValue(today));
  const [page, setPage] = useState(1);

  const queryParams = useMemo(() => {
    const params: Record<string, string | number> = { page: 1, limit: 10000 };

    if (fromDate) params.from_date = `${fromDate}T00:00:00.000Z`;
    if (toDate) params.to_date = `${toDate}T23:59:59.999Z`;

    return params;
  }, [fromDate, toDate]);

  const { data, isLoading } = useGetFinanceHistory(queryParams);
  const rows = useMemo(
    () => normalizeRows(((data?.data?.items ?? []) as unknown[])),
    [data?.data?.items],
  );
  const positiveTotal = rows.reduce((sum, row) => row.signedAmount > 0 ? sum + row.signedAmount : sum, 0);
  const negativeTotal = rows.reduce((sum, row) => row.signedAmount < 0 ? sum + Math.abs(row.signedAmount) : sum, 0);
  const netTotal = positiveTotal - negativeTotal;
  const positiveBuckets = useMemo(() => buildBuckets(rows, "positive", t), [rows, t]);
  const negativeBuckets = useMemo(() => buildBuckets(rows, "negative", t), [rows, t]);
  const topRows = useMemo(
    () => [...rows].sort((a, b) => Math.abs(b.signedAmount) - Math.abs(a.signedAmount)),
    [rows],
  );
  const totalPages = Math.max(1, Math.ceil(topRows.length / PAGE_SIZE));
  const paginatedRows = topRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const setPeriod = (period: "today" | "week" | "month" | "year") => {
    const end = new Date();
    const start = new Date();

    if (period === "week") start.setDate(end.getDate() - 6);
    if (period === "month") start.setMonth(end.getMonth() - 1);
    if (period === "year") start.setFullYear(end.getFullYear() - 1);

    setFromDate(toDateInputValue(period === "today" ? end : start));
    setToDate(toDateInputValue(end));
    setPage(1);
  };

  const dateChange = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-primary p-3 shadow-sm dark:border-glass-border dark:bg-maindark sm:flex-row sm:items-end">
        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
          <FilterDateInput
            label={t("startDate")}
            value={fromDate}
            onChange={dateChange(setFromDate)}
            placement="bottom"
          />
          <FilterDateInput
            label={t("endDate")}
            value={toDate}
            onChange={dateChange(setToDate)}
            minDate={fromDate || undefined}
            placement="bottom"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          {[
            ["today", t("today")],
            ["week", t("week")],
            ["month", t("month")],
            ["year", t("year")],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setPeriod(key as "today" | "week" | "month" | "year")}
              className="h-10 rounded-xl border border-purple-200 bg-white px-4 text-sm font-semibold text-purple-700 shadow-sm transition hover:border-main hover:bg-main/10 hover:text-main dark:border-purple-400/25 dark:bg-[#2f2946] dark:text-purple-100 dark:hover:border-main dark:hover:bg-main/20 dark:hover:text-white"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatCard icon={<TrendingUp size={20} />} label={t("financialBalancePositiveImpact")} value={positiveTotal} currencyLabel={currencyLabel} tone="positive" />
        <StatCard icon={<TrendingDown size={20} />} label={t("financialBalanceNegativeImpact")} value={-negativeTotal} currencyLabel={currencyLabel} tone="negative" />
        <StatCard
          icon={<Bolt size={20} />}
          label={t("financialBalanceNetChange")}
          value={netTotal}
          currencyLabel={currencyLabel}
          tone="neutral"
          description={t("financialBalanceTransactionsCount", { count: rows.length })}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SourcePanel title={t("financialBalancePositiveSources")} rows={positiveBuckets} tone="positive" currencyLabel={currencyLabel} />
        <SourcePanel title={t("financialBalanceNegativeSources")} rows={negativeBuckets} tone="negative" currencyLabel={currencyLabel} />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-primary p-5 shadow-sm dark:border-glass-border dark:bg-maindark">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sigma size={17} className="text-main" />
            <p className="text-base font-bold text-maindark dark:text-white">{t("financialBalanceTopTransactions")}</p>
          </div>
          <p className="text-xs font-semibold text-maindark/45 dark:text-slate-400">{t("financialBalanceTotalTransactions", { count: rows.length })}</p>
        </div>

        <div className="min-h-64">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-12 animate-pulse rounded-xl bg-gray-100 dark:bg-white/5" />
              ))}
            </div>
          ) : paginatedRows.length ? (
            <div className="overflow-hidden rounded-xl">
              {paginatedRows.map((row, index) => {
                const isExpense = row.signedAmount < 0;
                return (
                  <div
                    key={`${row.id}-${index}`}
                    className="grid grid-cols-[40px_34px_minmax(0,1fr)_auto] items-center gap-3 border-b border-gray-100 px-2 py-3 last:border-b-0 hover:bg-main/5 dark:border-white/5 dark:hover:bg-white/5"
                  >
                    <p className="text-xs font-bold text-maindark/45 dark:text-slate-400">#{(page - 1) * PAGE_SIZE + index + 1}</p>
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full ${isExpense ? "bg-red-500/15 text-red-400" : "bg-emerald-500/15 text-emerald-400"}`}>
                      {isExpense ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${isExpense ? "bg-red-500/15 text-red-400" : "bg-emerald-500/15 text-emerald-400"}`}>
                          {sourceTypeLabel(row.sourceType, t)}
                        </span>
                        {row.actor ? <span className="truncate text-xs font-medium text-maindark/50 dark:text-slate-400">{row.actor}</span> : null}
                      </div>
                      <p className="mt-1 text-xs text-maindark/45 dark:text-slate-500">{formatDateTime(row.date)}</p>
                    </div>
                    <p className={`text-right text-sm font-black tabular-nums ${isExpense ? "text-red-400" : "text-emerald-400"}`}>
                      {isExpense ? "-" : "+"}
                      {formatFinancialAmount(row.amount, "comma")} {currencyLabel}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-gray-300 text-sm text-maindark/50 dark:border-white/10 dark:text-slate-400">
              {t("financialBalanceHistoryEmpty")}
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            disabled={page <= 1}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-maindark/50 transition hover:bg-main/10 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-white/10"
          >
            <ChevronLeft size={16} />
          </button>
          {Array.from({ length: Math.min(totalPages, 5) }).map((_, index) => {
            const pageNumber = index + 1;
            return (
              <button
                key={pageNumber}
                type="button"
                onClick={() => setPage(pageNumber)}
                className={`h-8 min-w-8 rounded-lg px-2 text-sm font-bold transition ${page === pageNumber ? "bg-main text-white" : "bg-purple-50 text-purple-700 hover:bg-main/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"}`}
              >
                {pageNumber}
              </button>
            );
          })}
          {totalPages > 5 ? <span className="text-maindark/45 dark:text-slate-500">...</span> : null}
          {totalPages > 5 ? (
            <button
              type="button"
              onClick={() => setPage(totalPages)}
              className={`h-8 min-w-8 rounded-lg px-2 text-sm font-bold transition ${page === totalPages ? "bg-main text-white" : "bg-purple-50 text-purple-700 hover:bg-main/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"}`}
            >
              {totalPages}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            disabled={page >= totalPages}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-maindark/50 transition hover:bg-main/10 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-white/10"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default memo(AnalysisTab);
