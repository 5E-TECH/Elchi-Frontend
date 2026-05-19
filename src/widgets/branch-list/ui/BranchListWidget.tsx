import { ApartmentOutlined, AppstoreOutlined, BarsOutlined } from "@ant-design/icons";
import { Empty, Spin } from "antd";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useBranches, type Branch, type BranchParams } from "../../../entities/branch";
import Pagination from "../../../shared/components/pagination";
import FilterSearch from "../../../shared/ui/FilterSearch";
import FilterSelect from "../../../shared/ui/FilterSelect";
import BranchCards from "./BranchCards";
import BranchTable from "./BranchTable";
import BranchTree from "./BranchTree";

type ViewMode = "table" | "card" | "tree";

interface BranchListWidgetProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onEdit: (branch: Branch) => void;
}

const BranchListWidget = ({
  viewMode,
  onViewModeChange,
  onEdit,
}: BranchListWidgetProps) => {
  const { t } = useTranslation("branches");
  const [params, setParams] = useState<BranchParams>({
    page: 1,
    limit: 12,
    search: "",
    status: "",
  });
  const queryParams = useMemo(
    () => (viewMode === "tree" ? { ...params, page: 1, limit: 100 } : params),
    [params, viewMode],
  );
  const { data, isLoading } = useBranches(queryParams);
  const currentPage = data?.page ?? params.page ?? 1;
  const currentLimit = data?.limit ?? params.limit ?? 12;
  const totalItems = data?.total ?? 0;
  const from = totalItems === 0 ? 0 : (currentPage - 1) * currentLimit + 1;
  const to = totalItems === 0 ? 0 : Math.min(currentPage * currentLimit, totalItems);
  const statusOptions = useMemo(
    () => [
      { value: "active", label: t("status.active") },
      { value: "inactive", label: t("status.inactive") },
    ],
    [t],
  );
  const viewModeOptions: { value: ViewMode; icon: ReactNode; label: string }[] = useMemo(
    () => [
      { value: "tree", icon: <ApartmentOutlined />, label: t("list.treeView") },
      { value: "table", icon: <BarsOutlined />, label: t("list.tableView") },
      { value: "card", icon: <AppstoreOutlined />, label: t("list.cardView") },
    ],
    [t],
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-primary shadow-sm dark:border-primarydark/60 dark:bg-maindark">
      <div className="border-b border-gray-200 p-4 dark:border-primarydark/60 sm:p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
          <div className="min-w-0 xl:flex-1">
            <FilterSearch
              value={params.search ?? ""}
              placeholder={t("list.searchPlaceholder")}
              onChange={(search) => setParams((prev) => ({ ...prev, search, page: 1 }))}
              debounceDelay={400}
            />
          </div>
          <div className="w-full xl:w-[280px]">
            <FilterSelect
              name="branch_status"
              label={t("fields.status")}
              value={params.status ?? ""}
              onChange={(status) => setParams((prev) => ({ ...prev, status: status as BranchParams["status"], page: 1 }))}
              options={statusOptions}
              placeholder={t("list.allStatuses")}
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
                        ? "bg-main text-white shadow-[0_10px_25px_rgba(109,72,217,0.28)]"
                        : "text-text-muted hover:bg-main-soft hover:text-main dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
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
          ) : viewMode === "card" ? (
            <BranchCards data={data?.data ?? []} loading={isLoading} onEdit={onEdit} />
          ) : (
            <BranchTree data={data?.data ?? []} loading={isLoading} onEdit={onEdit} />
          )}
        </Spin>

        {viewMode === "card" && data && !data.data.length ? <Empty description={t("list.notFound")} /> : null}
      </div>

      {viewMode !== "tree" ? (
        <div className="border-t border-gray-200 px-4 py-4 sm:px-6 dark:border-primarydark/60">
          <Pagination
            totalItems={totalItems}
            itemsPerPage={currentLimit}
            currentPage={currentPage}
            onPageChange={(page) => setParams((prev) => ({ ...prev, page }))}
            onItemsPerPageChange={(limit) => setParams((prev) => ({ ...prev, limit, page: 1 }))}
            summary={
              totalItems > 0
                ? t("list.paginationSummary", { from, to, total: totalItems })
                : t("list.emptyCount")
            }
            pageSizeOptions={[12, 24, 48, 96]}
          />
        </div>
      ) : null}
    </div>
  );
};

export default BranchListWidget;
