import { AppstoreOutlined, BarsOutlined } from "@ant-design/icons";
import { Empty, Spin } from "antd";
import { useState, type ReactNode } from "react";
import { useBranches, type Branch, type BranchParams } from "../../../entities/branch";
import FilterSearch from "../../../shared/ui/FilterSearch";
import FilterSelect from "../../../shared/ui/FilterSelect";
import BranchCards from "./BranchCards";
import BranchTable from "./BranchTable";

type ViewMode = "table" | "card";

interface BranchListWidgetProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onEdit: (branch: Branch) => void;
}

const statusOptions = [
  { value: "active", label: "Faol" },
  { value: "inactive", label: "Nofaol" },
];

const viewModeOptions: { value: ViewMode; icon: ReactNode; label: string }[] = [
  { value: "table", icon: <BarsOutlined />, label: "Jadval" },
  { value: "card", icon: <AppstoreOutlined />, label: "Kartalar" },
];

const BranchListWidget = ({
  viewMode,
  onViewModeChange,
  onEdit,
}: BranchListWidgetProps) => {
  const [params, setParams] = useState<BranchParams>({
    page: 1,
    limit: 12,
    search: "",
    status: "",
  });
  const { data, isLoading } = useBranches(params);
  const totalPages = Math.max(Math.ceil((data?.total ?? 0) / (data?.limit ?? params.limit ?? 12)), 1);

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-primary shadow-sm dark:border-primarydark/60 dark:bg-maindark">
      <div className="border-b border-gray-200 p-4 dark:border-primarydark/60 sm:p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
          <div className="min-w-0 flex-1">
            <FilterSearch
              value={params.search ?? ""}
              placeholder="Filial nomi yoki manzil bo'yicha qidirish"
              onChange={(search) => setParams((prev) => ({ ...prev, search, page: 1 }))}
              debounceDelay={400}
            />
          </div>
          <div className="w-full xl:w-[180px]">
            <FilterSelect
              name="branch_status"
              label="Holat"
              value={params.status ?? ""}
              onChange={(status) => setParams((prev) => ({ ...prev, status: status as BranchParams["status"], page: 1 }))}
              options={statusOptions}
              placeholder="Barchasi"
            />
          </div>
          <div className="flex xl:pb-[1px]">
            <div className="inline-flex h-12 items-center rounded-xl border-2 border-gray-200 bg-white p-1 shadow-sm dark:border-primarydark/30 dark:bg-primarydark">
              {viewModeOptions.map((option) => {
                const isActive = viewMode === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onViewModeChange(option.value)}
                    aria-label={option.label}
                    title={option.label}
                    className={`flex h-10 w-10 items-center justify-center self-center rounded-lg text-base transition-all duration-200 ${
                      isActive
                        ? "bg-[linear-gradient(135deg,var(--color-main)_0%,var(--color-primarydark)_100%)] text-white shadow-[0_10px_25px_rgba(109,72,217,0.28)]"
                        : "text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-main-soft)] hover:text-[var(--color-main)] dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
                    }`}
                  >
                    {option.icon}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <Spin spinning={isLoading}>
          {viewMode === "table" ? (
            <BranchTable data={data?.data ?? []} loading={isLoading} onEdit={onEdit} />
          ) : (
            <BranchCards data={data?.data ?? []} loading={isLoading} />
          )}
        </Spin>

        {viewMode === "card" && data && !data.data.length ? <Empty description="Filiallar topilmadi" /> : null}
      </div>

      <div
        className="flex flex-col gap-3 border-t border-gray-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:border-primarydark/60"
        style={{
          background: "linear-gradient(90deg, var(--color-main) 0%, var(--color-primarydark) 100%)",
        }}
      >
        <span className="text-sm text-white">
          {data?.total
            ? `${(data.page - 1) * data.limit + 1}-${Math.min(data.page * data.limit, data.total)} dan ${data.total} tasi ko'rsatilmoqda`
            : "0 ta filial"}
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setParams((prev) => ({ ...prev, page: Math.max((data?.page ?? prev.page ?? 1) - 1, 1) }))
            }
            className="rounded-lg border border-white/30 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={(data?.page ?? params.page ?? 1) <= 1}
          >
            Oldingi
          </button>
          <span className="px-2 text-sm font-medium text-white">
            {data?.page ?? params.page ?? 1} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setParams((prev) => ({ ...prev, page: (data?.page ?? prev.page ?? 1) + 1 }))}
            className="rounded-lg border border-white/30 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={(data?.page ?? params.page ?? 1) >= totalPages}
          >
            Keyingi
          </button>
        </div>
      </div>
    </div>
  );
};

export default BranchListWidget;
