import { Table } from "../../../shared/components/Table/Table";
import type { ColumnConfig } from "../../../shared/components/Table/Table.types";
import { RemoveEmployeeButton } from "../../../features/branch-remove-employee";
import type { Employee } from "../../../entities/branch";
import { formatDate } from "../../../shared/lib/formatDate";

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
  const actionButtonClassName =
    "!h-8 !rounded-lg !border !border-[color:var(--color-border-soft)] !bg-[color:var(--color-main-soft)] !px-3 !font-medium !text-[var(--color-maindark)] transition-colors hover:!border-[var(--color-main)] hover:!bg-[color:color-mix(in_srgb,var(--color-main)_22%,white)] hover:!text-[var(--color-main)] dark:!border-primarydark/60 dark:!bg-primarydark/40 dark:!text-white/85 dark:hover:!border-[var(--color-main)] dark:hover:!bg-primarydark/70 dark:hover:!text-white";
  const deleteButtonClassName =
    `${actionButtonClassName} !border-rose-200/80 !bg-rose-50 !text-rose-600 hover:!border-rose-400 hover:!bg-rose-100 hover:!text-rose-700 dark:!border-rose-500/30 dark:!bg-rose-500/12 dark:!text-rose-300 dark:hover:!border-rose-400/60 dark:hover:!bg-rose-500/18 dark:hover:!text-rose-200`;

  const columns: ColumnConfig<Employee>[] = [
    {
      key: "user",
      label: "Xodim",
      render: (_, record) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-[var(--color-maindark)] dark:text-white">
            {record.user.fullName}
          </span>
          <span className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-muted-dark)]">
            {record.user.phone}
          </span>
        </div>
      ),
    },
    { key: "position", label: "Lavozim", sortable: true },
    {
      key: "joined_at",
      label: "Qo'shilgan sana",
      sortable: true,
      sortValue: (row) => new Date(row.joined_at).getTime(),
      render: (value: string) => formatDate(value, "DD.MM.YYYY"),
    },
    {
      key: "id",
      label: "Amallar",
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
          <h2 className="text-lg font-bold text-[var(--color-maindark)] dark:text-white">
            Filial xodimlari
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-text-muted-dark)]">
            Biriktirilgan xodimlar ro'yxati va ularning lavozimlari.
          </p>
        </div>
      </div>

      <Table
        keyExtractor={(employee) => employee.id}
        loading={loading}
        columns={columns}
        data={data}
        emptyMessage="Xodimlar topilmadi"
        className="text-[var(--color-maindark)] dark:text-white/85"
      />
    </div>
  );
};

export default BranchEmployeesSection;
