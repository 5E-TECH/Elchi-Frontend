import { Button } from "antd";
import { EditOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";
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
  const { t } = useTranslation("branches");
  const { t: tCommon } = useTranslation("common");
  const navigate = useNavigate();
  const actionButtonClassName =
    "!flex !h-8 !w-8 !items-center !justify-center !rounded-lg !border !border-border-soft !bg-main-soft !p-0 !font-medium !text-maindark transition-colors hover:!border-main hover:!bg-main-soft hover:!text-main dark:!border-primarydark/60 dark:!bg-primarydark/40 dark:!text-white/85 dark:hover:!border-main dark:hover:!bg-primarydark/70 dark:hover:!text-white";
  const deleteButtonClassName =
    `${actionButtonClassName} !border-rose-200/80 !bg-rose-50 !text-rose-600 hover:!border-rose-400 hover:!bg-rose-100 hover:!text-rose-700 dark:!border-rose-500/30 dark:!bg-rose-500/12 dark:!text-rose-300 dark:hover:!border-rose-400/60 dark:hover:!bg-rose-500/18 dark:hover:!text-rose-200`;

  const columns: ColumnConfig<Branch>[] = [
    {
      key: "name",
      label: t("table.name"),
      sortable: true,
      render: (_, record) => (
        <button
          type="button"
          className="font-semibold text-main transition-colors hover:text-primarydark dark:text-white dark:hover:text-main"
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
      label: t("table.area"),
      sortable: true,
      sortValue: (row) => `${row.region?.name ?? "—"} ${row.district?.name ?? "—"}`,
      render: (_, record) => `${record.region?.name ?? "—"}, ${record.district?.name ?? "—"}`,
    },
    {
      key: "address",
      label: t("fields.address"),
      sortable: true,
    },
    {
      key: "status",
      label: t("fields.status"),
      sortable: true,
      render: (status: Branch["status"]) => <BranchStatusBadge status={status} />,
    },
    {
      key: "employees_count",
      label: t("table.employees"),
      sortable: true,
      className: "text-center",
    },
    {
      key: "created_at",
      label: t("table.date"),
      sortable: true,
      sortValue: (row) => new Date(row.created_at ?? 0).getTime(),
      render: (value: string) => (value ? formatDate(value, "DD.MM.YYYY") : "—"),
    },
    {
      key: "id",
      label: t("table.actions"),
      render: (_, record) => (
        <div className="flex flex-wrap items-center gap-2" onClick={(event) => event.stopPropagation()}>
          <Button
            size="small"
            icon={<ArrowRight size={15} />}
            className={actionButtonClassName}
            onClick={() => navigate(`/branches/${record.id}`)}
            aria-label={tCommon("open")}
            title={tCommon("open")}
          />
          <Button
            size="small"
            icon={<EditOutlined />}
            className={actionButtonClassName}
            onClick={() => onEdit(record)}
            aria-label={t("actions.edit")}
            title={t("actions.edit")}
          />
          <DeleteBranchButton id={record.id} className={deleteButtonClassName} />
        </div>
      ),
    },
  ];

  return (
    <Table
      className="text-maindark dark:text-white/85"
      keyExtractor={(branch) => branch.id}
      loading={loading}
      columns={columns}
      data={data}
      emptyMessage={t("list.notFound")}
      onRowClick={(branch) => navigate(`/branches/${branch.id}`)}
      preserveTableOnDesktop
      dense
    />
  );
};

export default BranchTable;
