import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarDays, Funnel } from "lucide-react";
import { Table } from "../../../shared/components/Table/Table";
import type { ColumnConfig } from "../../../shared/components/Table/Table.types";
import FilterSelect from "../../../shared/ui/FilterSelect";
import CustomDatePicker from "../../../shared/ui/CustomDatePicker";
import Pagination from "../../../shared/components/pagination";
import { useCashBox } from "../../../entities/payments";
import { usePagination } from "../../../shared/lib/usePagination";

interface HistoryRow {
  id: string;
  date: string;
  sourceType: string;
  changeAmount: number;
  previousBalance: number;
  nextBalance: number;
  comment: string;
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

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";

  try {
    const date = new Date(value);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  } catch {
    return value;
  }
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
  const { getFinanceHistory } = useCashBox();
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
    if (fromDate) params.from_date = `${fromDate}T00:00:00.000Z`;
    if (toDate) params.to_date = `${toDate}T23:59:59.999Z`;

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

  const { data, isLoading } = getFinanceHistory(queryParams);

  const rows = useMemo<HistoryRow[]>(
    () =>
      ((data?.data?.items ?? []) as Record<string, unknown>[]).map((item) => {
        const amount = Math.abs(Number(item.amount ?? 0));
        const operationType = String(item.operation_type ?? "");
        const signedChange = operationType === "expense" ? -amount : amount;
        const nextBalance = Number(item.balance_after ?? 0);
        const previousBalance = nextBalance - signedChange;

        return {
          id: String(item.id ?? ""),
          date: String(item.payment_date ?? item.createdAt ?? item.created_at ?? ""),
          sourceType: String(item.source_type ?? ""),
          changeAmount: signedChange,
          previousBalance,
          nextBalance,
          comment: String(item.comment ?? "").trim() || "-",
        };
      }),
    [data?.data?.items],
  );

  const pagination = useMemo(
    () =>
      normalizePagination(
        (data?.data?.pagination ?? data?.data?.meta) as Record<string, unknown> | undefined,
        page,
        limit,
      ),
    [data?.data?.meta, data?.data?.pagination, limit, page],
  );

  const columns = useMemo<ColumnConfig<HistoryRow>[]>(
    () => [
      {
        key: "date",
        label: t("financialBalanceDate"),
        width: "180px",
        render: (value) => (
          <span className="text-sm text-gray-700 dark:text-white/80">
            {formatDateTime(value)}
          </span>
        ),
      },
      {
        key: "sourceType",
        label: t("financialBalanceSource"),
        width: "180px",
        render: (value) => (
          <span className="text-sm font-medium text-main/85">
            {toSourceTypeLabel(value, t)}
          </span>
        ),
      },
      {
        key: "changeAmount",
        label: t("financialBalanceChange"),
        width: "170px",
        render: (value) => (
          <span
            className={`text-sm font-bold ${
              value < 0 ? "text-rose-400" : "text-emerald-400"
            }`}
          >
            {value < 0 ? "-" : "+"}
            {toDisplayAmount(Math.abs(value))} UZS
          </span>
        ),
      },
      {
        key: "previousBalance",
        label: t("financialBalancePreviousBalance"),
        width: "180px",
        render: (value) => (
          <span className="text-sm text-gray-700 dark:text-white/80">
            {toDisplayAmount(value)} UZS
          </span>
        ),
      },
      {
        key: "nextBalance",
        label: t("financialBalanceNextBalance"),
        width: "180px",
        render: (value) => (
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {toDisplayAmount(value)} UZS
          </span>
        ),
      },
      {
        key: "comment",
        label: t("financialBalanceComment"),
        render: (value) => (
          <span className="text-sm text-gray-600 dark:text-white/70">
            {value || "-"}
          </span>
        ),
      },
    ],
    [t],
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
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-primary p-4 shadow-sm dark:border-primarydark/60 dark:bg-maindark">
        <div className="mb-4 flex items-center gap-2">
          <Funnel size={16} className="text-main" />
          <p className="text-sm font-semibold text-gray-800 dark:text-white">
            {t("filters")}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <CustomDatePicker
            value={fromDate}
            onChange={setFromDate}
            placeholder={t("startDate")}
          />
          <CustomDatePicker
            value={toDate}
            onChange={setToDate}
            minDate={fromDate || undefined}
            placeholder={t("endDate")}
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

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-primary shadow-sm dark:border-primarydark/60 dark:bg-maindark">
        <Table<HistoryRow>
          data={rows}
          columns={columns}
          loading={isLoading}
          dense
          keyExtractor={(row) => row.id}
          emptyMessage={t("financialBalanceHistoryEmpty")}
        />

        <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-4 dark:border-primarydark/60 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <span className="text-xs text-gray-500 dark:text-white/45">
            {pagination.page}-sahifa / {pagination.totalPages}
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
