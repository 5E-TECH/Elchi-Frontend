import { Table } from "../../../shared/components/Table/Table";
import type { ColumnConfig } from "../../../shared/components/Table/Table.types";
import { RemoveEmployeeButton } from "../../../features/branch-remove-employee";
import type { Employee } from "../../../entities/branch";
import { formatDate } from "../../../shared/lib/formatDate";
import { useTranslation } from "react-i18next";

interface BranchEmployeesSectionProps {
  branchId: string;
  data: Employee[];
  loading?: boolean;
}

const BranchEmployeesSection = ({
  branchId,
  data,
  loading,
}: BranchEmployeesSectionProps) => {
  const { t } = useTranslation("branches");
  const deleteButtonClassName =
    "!inline-flex !h-9 !w-9 !items-center !justify-center !rounded-lg !border !border-rose-200/80 !bg-rose-50 !p-0 !text-rose-600 transition-colors hover:!border-rose-400 hover:!bg-rose-100 hover:!text-rose-700 dark:!border-rose-500/30 dark:!bg-rose-500/12 dark:!text-rose-300 dark:hover:!border-rose-400/60 dark:hover:!bg-rose-500/18 dark:hover:!text-rose-200";

  const columns: ColumnConfig<Employee>[] = [
    {
      key: "user",
      label: t("employee.employee"),
      render: (_, record) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-maindark dark:text-white">
            {record.user.fullName}
          </span>
          <span className="text-xs text-text-muted dark:text-text-muted-dark">
            {record.user.phone}
          </span>
        </div>
      ),
    },
    { key: "position", label: t("employee.position"), sortable: true },
    {
      key: "joined_at",
      label: t("employee.joinedDate"),
      sortable: true,
      sortValue: (row) => new Date(row.joined_at).getTime(),
      render: (value: string) => formatDate(value, "DD.MM.YYYY"),
    },
    {
      key: "id",
      label: t("table.actions"),
      render: (_, record) => (
        <RemoveEmployeeButton
          branchId={branchId}
          userId={record.user.id}
          className={deleteButtonClassName}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-maindark dark:text-white">
            {t("employee.title")}
          </h2>
          <p className="text-sm text-text-muted dark:text-text-muted-dark">
            {t("employee.description")}
          </p>
        </div>
      </div>

      <Table
        keyExtractor={(employee) => employee.id}
        loading={loading}
        columns={columns}
        data={data}
        emptyMessage={t("employee.notFound")}
        className="text-maindark dark:text-white/85"
      />
    </div>
  );
};

export default BranchEmployeesSection;
