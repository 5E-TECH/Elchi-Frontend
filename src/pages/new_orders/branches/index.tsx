import { memo, useMemo, useState, useEffect } from "react";
import { Building2, ChevronRight, PackageCheck, Phone, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Table } from "../../../shared/components/Table/Table";
import type { ColumnConfig } from "../../../shared/components/Table/Table.types";
import { GlobalSearchInput, useDebounce } from "../../../features/search";
import { useSelector } from "react-redux";
import type { RootState } from "../../../app/config/store";
import { useBranchesWithSentBatches } from "../../../entities/branch";
import { useNavigate } from "react-router-dom";

interface BranchBatchRow {
  branch_id: string;
  name: string;
  phone_number: string;
  batches_count: number;
  total_price_sum: number;
}

const fmt = (n: number) => `${n.toLocaleString("uz-UZ")} so'm`;

const columns: ColumnConfig<BranchBatchRow>[] = [
  {
    key: "branch_id",
    label: "#",
    width: "6%",
    render: (_v, _row, index) => (
      <span className="font-medium text-maindark dark:text-gray-500">{index + 1}</span>
    ),
  },
  {
    key: "name",
    label: "Filial nomi",
    width: "24%",
    sortable: true,
    render: (v) => (
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-main/10 text-main dark:bg-main/20">
          <Building2 size={14} />
        </div>
        <span className="font-semibold text-maindark dark:text-white">{v}</span>
      </div>
    ),
  },
  {
    key: "phone_number",
    label: "Telefon",
    width: "18%",
    render: (v) => <span className="font-medium text-maindark dark:text-slate-300">{v}</span>,
  },
  {
    key: "batches_count",
    label: "Batchlar",
    width: "24%",
    sortable: true,
    render: (v) => (
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-main/10 dark:bg-main/20">
          <PackageCheck size={12} className="text-main" />
        </span>
        <span className="font-bold text-maindark dark:text-white">{v} ta</span>
      </div>
    ),
  },
  {
    key: "total_price_sum",
    label: "Jami summa",
    width: "28%",
    sortable: true,
    render: (v) => (
      <span className="tabular-nums font-bold text-emerald-600 dark:text-emerald-400">{fmt(v)}</span>
    ),
  },
];

const StatCard = ({ icon, label, value, iconCls }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  iconCls: string;
}) => (
  <div className="flex w-full items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3.5 dark:border-white/10 dark:bg-primarydark sm:p-4">
    <div className={`rounded-xl p-2.5 ${iconCls}`}>{icon}</div>
    <div className="flex min-w-0 flex-col">
      <span className="text-xs font-medium text-maindark dark:text-white/75">{label}</span>
      <strong className="truncate text-base leading-tight text-maindark dark:text-white sm:text-lg">{value}</strong>
    </div>
  </div>
);

const BranchBatchesPage = () => {
  const { t } = useTranslation("newOrders");
  const navigate = useNavigate();

  const searchQuery = useSelector((state: RootState) =>
    (state.search["branch_batches_search"] as string) || "",
  );

  const [debouncedSearch, setDebouncedSearch] = useState("");
  const applyDebounce = useDebounce((val: string) => setDebouncedSearch(val), 500);

  useEffect(() => {
    applyDebounce(searchQuery);
  }, [searchQuery, applyDebounce]);

  const { data: response, isLoading } = useBranchesWithSentBatches({
    side: "source",
    direction: "FORWARD",
  });
  const apiRows = (response ?? []) as BranchBatchRow[];

  const rows = useMemo(() => {
    if (!debouncedSearch.trim()) return apiRows;
    const q = debouncedSearch.trim().toLowerCase();

    return apiRows.filter((row) =>
      row.name.toLowerCase().includes(q) || row.phone_number.toLowerCase().includes(q),
    );
  }, [apiRows, debouncedSearch]);

  const totalBatches = rows.reduce((sum, row) => sum + row.batches_count, 0);
  const totalSum = rows.reduce((sum, row) => sum + row.total_price_sum, 0);

  const renderMobileCard = (row: BranchBatchRow, index: number) => (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-transform active:scale-[0.98] dark:border-primarydark/70 dark:bg-primarydark/70">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-maindark dark:text-gray-400">#{index + 1}</span>
        <ChevronRight size={16} className="text-maindark dark:text-gray-400" />
      </div>

      <div className="mb-3 flex items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-main/10 text-main dark:bg-main/20">
          <Building2 size={15} />
        </div>
        <p className="truncate text-base font-bold text-maindark dark:text-primary">{row.name}</p>
      </div>

      <div className="grid grid-cols-1 gap-2 border-t border-gray-100 pt-3 dark:border-primarydark/70">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-maindark dark:text-gray-300">{t("phone")}</span>
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-maindark dark:text-gray-200">
            <Phone size={13} className="text-main/70" />
            {row.phone_number}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-maindark dark:text-gray-300">{t("batches")}</span>
          <span className="font-bold text-maindark dark:text-primary">{t("totalCount", { count: row.batches_count })}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-maindark dark:text-gray-300">{t("totalAmount")}</span>
          <span className="tabular-nums font-extrabold text-emerald-600 dark:text-emerald-400">{fmt(row.total_price_sum)}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 pb-28 sm:space-y-6 sm:pb-24 md:pb-4">
      <div>
        <GlobalSearchInput
          searchKey="branch_batches_search"
          placeholder={t("branchNameOrPhoneSearch")}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          icon={<Building2 size={20} />}
          label={t("branchesCount")}
          value={t("totalCount", { count: rows.length })}
          iconCls="bg-main/10 text-main dark:bg-main/20"
        />
        <StatCard
          icon={<PackageCheck size={20} />}
          label={t("totalBatches")}
          value={t("totalCount", { count: totalBatches })}
          iconCls="bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20"
        />
        <StatCard
          icon={<TrendingUp size={20} />}
          label={t("totalAmount")}
          value={fmt(totalSum)}
          iconCls="bg-amber-500/10 text-amber-500 dark:bg-amber-500/20"
        />
      </div>

      <Table<BranchBatchRow>
        data={rows}
        loading={isLoading}
        columns={columns.map((column) => {
          if (column.key === "name") return { ...column, label: t("branchName") };
          if (column.key === "phone_number") return { ...column, label: t("phone") };
          if (column.key === "batches_count") return { ...column, label: t("batches") };
          if (column.key === "total_price_sum") return { ...column, label: t("totalAmount") };
          return column;
        })}
        keyExtractor={(item) => item.branch_id}
        hoverable
        mobileRowRender={renderMobileCard}
        onRowClick={(row) => navigate(`/new-orders/branches/${row.branch_id}`)}
        emptyMessage={t("noBranchBatchesToday")}
      />
    </div>
  );
};

export default memo(BranchBatchesPage);
