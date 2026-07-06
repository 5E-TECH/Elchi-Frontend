import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarDays, Funnel } from "lucide-react";
import { Table } from "../../../shared/components/Table/Table";
import type { ColumnConfig } from "../../../shared/components/Table/Table.types";
import FilterSelect from "../../../shared/ui/FilterSelect";
import FilterDateInput from "../../../shared/ui/FilterDateInput";
import Pagination from "../../../shared/components/pagination";
import { useFinanceCoverage } from "../../../entities/payments/financeCoverage";
import { usePagination } from "../../../shared/lib/usePagination";
import {
  extractFinancialLedgerItems,
  extractFinancialLedgerPagination,
} from "../lib/financialBalance";

interface HistoryRow {
  id: string;
  date: unknown;
  sourceType: string;
  changeAmount: number;
  previousBalance: number;
  nextBalance: number;
}

const toPositiveNumber = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return Math.floor(parsed);
};

const normalizePagination = (
  raw: Record<string, unknown> | undefined,
  fallbackPage: number,
  fallbackLimit: number,
) => {
  const total = toPositiveNumber(
    raw?.total ??
      raw?.totalItems ??
      raw?.itemCount ??
      raw?.count,
  ) ?? 0;

  const currentPage = toPositiveNumber(
    raw?.page ??
      raw?.currentPage,
  ) ?? fallbackPage;

  const limit = toPositiveNumber(
    raw?.limit ??
      raw?.perPage ??
      raw?.pageSize,
  ) ?? fallbackLimit;

  const totalPages = toPositiveNumber(
    raw?.totalPages ??
      raw?.lastPage,
  ) ?? Math.max(1, Math.ceil(total / Math.max(1, limit)));

  return {
    total,
    page: currentPage,
    limit,
    totalPages,
  };
};

const formatDateTime = (value?: unknown) => {
  if (!value) return "-";

  try {
    const date = new Date(typeof value === "number" ? value : String(value));
    if (Number.isNaN(date.getTime())) return String(value);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  } catch {
    return String(value);
  }
};

const getSignedChange = (item: Record<string, unknown>) => {
  const amount = Math.abs(Number(item.amount ?? 0));
  const before = Number(item.balance_before ?? item.balanceBefore);
  const after = Number(item.balance_after ?? item.balanceAfter);

  if (Number.isFinite(before) && Number.isFinite(after) && before !== after) {
    return after - before;
  }

  const operationType = String(item.operation_type ?? item.operationType ?? "").toLowerCase();
  const sourceType = String(item.source_type ?? item.sourceType ?? "").toLowerCase();

  if (operationType === "expense" || ["manual_expense", "salary", "correction"].includes(sourceType)) {
    return -amount;
  }

  return amount;
};

const toDisplayAmount = (value: number) =>
  value.toLocaleString("ru-RU").replace(/\s/g, " ");

const toSourceTypeLabel = (value: string, t: (key: string) => string) => {
  if (value === "sell") return t("financialBalanceSourceProfit");
  if (value === "manual_income") return t("financialBalanceSourceManualIncome");
  if (value === "manual_expense") return t("financialBalanceSourceManualExpense");
  if (value === "salary") return t("financialBalanceSourceSalary");
  if (value === "correction") return t("financialBalanceSourceCorrection");
  if (value === "bills") return t("financialBalanceSourceBills");
  return value || "-";
};

const HistoryTab = () => {
  const { t } = useTranslation("payments");
  const currencyLabel = t("currency");
  const { useGetFinancialBalanceHistory } = useFinanceCoverage();
  const { page, limit, setPage, setLimit, resetPagination } = usePagination({
    key: "payments",
    defaultLimit: 10,
    pageParam: "financialBalanceHistoryPage",
    limitParam: "financialBalanceHistoryLimit",
  });

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sourceType, setSourceType] = useState("");
  const previousFiltersRef = useRef({
    fromDate: "",
    toDate: "",
    sourceType: "",
  });

  const queryParams = useMemo(() => {
    const params: Record<string, string | number> = { page, limit };

    if (sourceType) params.source_type = sourceType;
    if (fromDate) params.fromDate = `${fromDate}T00:00:00.000Z`;
    if (toDate) params.toDate = `${toDate}T23:59:59.999Z`;

    return params;
  }, [fromDate, limit, page, sourceType, toDate]);

  useEffect(() => {
    const previous = previousFiltersRef.current;
    const hasChanged =
      previous.fromDate !== fromDate ||
      previous.toDate !== toDate ||
      previous.sourceType !== sourceType;

    if (!hasChanged) return;

    previousFiltersRef.current = { fromDate, toDate, sourceType };
    resetPagination(limit);
  }, [fromDate, toDate, sourceType, limit, resetPagination]);

  const { data, isLoading } = useGetFinancialBalanceHistory(true, queryParams);

  const rows = useMemo<HistoryRow[]>(
    () =>
      (extractFinancialLedgerItems(data) as Record<string, unknown>[]).map((item) => {
        const signedChange = getSignedChange(item);
        const previousBalance = Number(item.balance_before ?? item.balanceBefore ?? 0);
        const nextBalance = Number(item.balance_after ?? item.balanceAfter ?? previousBalance + signedChange);

        return {
          id: String(item.id ?? ""),
          date: item.payment_date ?? item.paymentDate ?? item.createdAt ?? item.created_at ?? "",
          sourceType: String(item.source_type ?? ""),
          changeAmount: signedChange,
          previousBalance,
          nextBalance,
        };
      }),
    [data],
  );

  const pagination = useMemo(
    () =>
      normalizePagination(
        extractFinancialLedgerPagination(data),
        page,
        limit,
      ),
    [data, limit, page],
  );

  const columns = useMemo<ColumnConfig<HistoryRow>[]>(
    () => [
      {
        key: "id",
        label: "#",
        width: "50px",
        render: (_, __, index) => (
          <span className="text-xs font-semibold text-gray-400">
            {(pagination.page - 1) * pagination.limit + index + 1}
          </span>
        ),
      },
      {
        key: "date",
        label: t("financialBalanceDate"),
        width: "170px",
        render: (value) => (
          <span className="block whitespace-nowrap text-[13px] font-medium text-gray-700 dark:text-gray-200">
            {formatDateTime(value)}
          </span>
        ),
      },
      {
        key: "sourceType",
        label: t("financialBalanceSource"),
        width: "190px",
        render: (value) => (
          <span className="block truncate text-sm font-medium text-main">
            {toSourceTypeLabel(value, t)}
          </span>
        ),
      },
      {
        key: "changeAmount",
        label: t("financialBalanceChange"),
        width: "180px",
        render: (value) => (
          <span
            className={`block whitespace-nowrap text-sm font-bold font-mono ${
              value < 0 ? "text-rose-400" : "text-emerald-400"
            }`}
          >
            {value < 0 ? "-" : "+"}
            {toDisplayAmount(Math.abs(value))} {currencyLabel}
          </span>
        ),
      },
      {
        key: "previousBalance",
        label: t("financialBalancePreviousBalance"),
        width: "190px",
        render: (value) => (
          <span className="block whitespace-nowrap text-sm font-medium text-gray-700 dark:text-white/80">
            {toDisplayAmount(value)} {currencyLabel}
          </span>
        ),
      },
      {
        key: "nextBalance",
        label: t("financialBalanceNextBalance"),
        width: "190px",
        render: (value) => (
          <span className="block whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">
            {toDisplayAmount(value)} {currencyLabel}
          </span>
        ),
      },
    ],
    [currencyLabel, pagination.limit, pagination.page, t],
  );

  const sourceTypeOptions = useMemo(
    () => [
      { value: "sell", label: t("financialBalanceSourceProfit") },
      { value: "manual_income", label: t("financialBalanceSourceManualIncome") },
      { value: "manual_expense", label: t("financialBalanceSourceManualExpense") },
      { value: "salary", label: t("financialBalanceSourceSalary") },
      { value: "correction", label: t("financialBalanceSourceCorrection") },
      { value: "bills", label: t("financialBalanceSourceBills") },
    ],
    [t],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border border-gray-200 bg-primary p-4 shadow-sm dark:border-primarydark/60 dark:bg-maindark">
        <div className="mb-4 flex items-center gap-2">
          <Funnel size={16} className="text-main" />
          <p className="text-sm font-semibold text-gray-800 dark:text-white">
            {t("filters")}
          </p>
        </div>

        <div className="grid grid-cols-1 items-end gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(280px,0.95fr)]">
          <FilterDateInput
            label={t("startDate")}
            value={fromDate}
            onChange={setFromDate}
            placement="bottom"
          />
          <FilterDateInput
            label={t("endDate")}
            value={toDate}
            onChange={setToDate}
            minDate={fromDate || undefined}
            placement="bottom"
          />
          <FilterSelect
            name="financial_balance_source_type"
            label={t("financialBalanceSourceType")}
            value={sourceType}
            onChange={setSourceType}
            options={sourceTypeOptions}
            placeholder={t("financialBalanceAllSources")}
            icon={CalendarDays}
          />
        </div>
      </div>

      <div>
        <Table<HistoryRow>
          data={rows}
          columns={columns}
          loading={isLoading}
          keyExtractor={(row) => row.id}
          emptyMessage={t("financialBalanceHistoryEmpty")}
        />

        <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-primary px-4 py-4 shadow-sm dark:border-primarydark/60 dark:bg-maindark sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <span className="text-xs text-gray-500 dark:text-white/45">
            {t("pageLabel", { page: pagination.page, totalPages: pagination.totalPages })}
          </span>

          <Pagination
            totalItems={pagination.total}
            itemsPerPage={pagination.limit}
            currentPage={pagination.page}
            onPageChange={setPage}
            onItemsPerPageChange={setLimit}
            className="w-full pt-0 sm:w-auto"
            summary={null}
          />
        </div>
      </div>
    </div>
  );
};

export default memo(HistoryTab);
