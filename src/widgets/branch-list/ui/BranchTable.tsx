import { Button } from "antd";
import { EditOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { BranchStatusBadge, type Branch } from "../../../entities/branch";
import { DeleteBranchButton } from "../../../features/branch-delete";
import { Table } from "../../../shared/components/Table/Table";
import type { ColumnConfig } from "../../../shared/components/Table/Table.types";
import { formatDate } from "../../../shared/lib/formatDate";

interface BranchTableProps {
  data: Branch[];
  loading?: boolean;
  onEdit: (branch: Branch) => void;
}

const BranchTable = ({ data, loading, onEdit }: BranchTableProps) => {
  const navigate = useNavigate();
  const actionButtonClassName =
    "!flex !h-8 !w-8 !items-center !justify-center !rounded-lg !border !border-[color:var(--color-border-soft)] !bg-[color:var(--color-main-soft)] !p-0 !font-medium !text-[var(--color-maindark)] transition-colors hover:!border-[var(--color-main)] hover:!bg-[color:color-mix(in_srgb,var(--color-main)_22%,white)] hover:!text-[var(--color-main)] dark:!border-primarydark/60 dark:!bg-primarydark/40 dark:!text-white/85 dark:hover:!border-[var(--color-main)] dark:hover:!bg-primarydark/70 dark:hover:!text-white";
  const deleteButtonClassName =
    `${actionButtonClassName} !border-rose-200/80 !bg-rose-50 !text-rose-600 hover:!border-rose-400 hover:!bg-rose-100 hover:!text-rose-700 dark:!border-rose-500/30 dark:!bg-rose-500/12 dark:!text-rose-300 dark:hover:!border-rose-400/60 dark:hover:!bg-rose-500/18 dark:hover:!text-rose-200`;

  const columns: ColumnConfig<Branch>[] = [
    {
      key: "name",
      label: "Nomi",
      sortable: true,
      render: (_, record) => (
        <button
          type="button"
          className="font-semibold text-[var(--color-main)] transition-colors hover:text-[var(--color-primarydark)] dark:text-white dark:hover:text-[var(--color-main)]"
          onClick={(event) => {
            event.stopPropagation();
            navigate(`/branches/${record.id}`);
          }}
        >
          {record.name}
        </button>
      ),
    },
    {
      key: "region",
      label: "Hudud",
      sortable: true,
      sortValue: (row) => `${row.region.name} ${row.district.name}`,
      render: (_, record) => `${record.region.name}, ${record.district.name}`,
    },
    {
      key: "address",
      label: "Manzil",
      sortable: true,
    },
    {
      key: "status",
      label: "Holat",
      sortable: true,
      render: (status: Branch["status"]) => <BranchStatusBadge status={status} />,
    },
    {
      key: "employees_count",
      label: "Xodimlar",
      sortable: true,
      className: "text-center",
    },
    {
      key: "created_at",
      label: "Sana",
      sortable: true,
      sortValue: (row) => new Date(row.created_at).getTime(),
      render: (value: string) => formatDate(value, "DD.MM.YYYY"),
    },
    {
      key: "id",
      label: "Amallar",
      render: (_, record) => (
        <div className="flex flex-wrap items-center gap-2" onClick={(event) => event.stopPropagation()}>
          <Button
            size="small"
            icon={<EditOutlined />}
            className={actionButtonClassName}
            onClick={() => onEdit(record)}
            aria-label="Tahrirlash"
            title="Tahrirlash"
          />
          <DeleteBranchButton id={record.id} className={deleteButtonClassName} />
        </div>
      ),
    },
  ];

  return (
    <Table
      className="text-[var(--color-maindark)] dark:text-white/85"
      keyExtractor={(branch) => branch.id}
      loading={loading}
      columns={columns}
      data={data}
      emptyMessage="Filiallar topilmadi"
      onRowClick={(branch) => navigate(`/branches/${branch.id}`)}
    />
  );
};

export default BranchTable;
