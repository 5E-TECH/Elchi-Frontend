import { Button, message } from "antd";
import { useState } from "react";
import type { BranchSetting } from "../../../entities/branch";
import { ConfirmButton } from "../../../shared/ui/ConfirmButton";
import { Table } from "../../../shared/components/Table/Table";
import type { ColumnConfig } from "../../../shared/components/Table/Table.types";
import { useDeleteSetting } from "../api/useDeleteSetting";
import SettingFormModal from "./SettingFormModal";

const SettingsTable = ({ branchId, data, loading }: { branchId: string; data: BranchSetting[]; loading?: boolean }) => {
  const [editingSetting, setEditingSetting] = useState<BranchSetting | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const deleteSetting = useDeleteSetting(branchId);
  const actionButtonClassName =
    "!h-8 !rounded-lg !border !border-[color:var(--color-border-soft)] !bg-[color:var(--color-main-soft)] !px-3 !font-medium !text-[var(--color-maindark)] transition-colors hover:!border-[var(--color-main)] hover:!bg-[color:color-mix(in_srgb,var(--color-main)_22%,white)] hover:!text-[var(--color-main)] dark:!border-primarydark/60 dark:!bg-primarydark/40 dark:!text-white/85 dark:hover:!border-[var(--color-main)] dark:hover:!bg-primarydark/70 dark:hover:!text-white";
  const deleteButtonClassName =
    `${actionButtonClassName} !border-rose-200/80 !bg-rose-50 !text-rose-600 hover:!border-rose-400 hover:!bg-rose-100 hover:!text-rose-700 dark:!border-rose-500/30 dark:!bg-rose-500/12 dark:!text-rose-300 dark:hover:!border-rose-400/60 dark:hover:!bg-rose-500/18 dark:hover:!text-rose-200`;

  const columns: ColumnConfig<BranchSetting>[] = [
    { key: "key", label: "Kalit", sortable: true },
    { key: "value", label: "Qiymat", sortable: true },
    {
      key: "id",
      label: "Amallar",
      render: (_, record) => (
        <div className="flex flex-wrap items-center gap-2" onClick={(event) => event.stopPropagation()}>
          <Button size="small" className={actionButtonClassName} onClick={() => {
            setEditingSetting(record);
            setIsModalOpen(true);
          }}>
            Tahrirlash
          </Button>
          <ConfirmButton
            size="small"
            className={deleteButtonClassName}
            confirmTitle="Sozlamani o'chirmoqchimisiz?"
            loading={deleteSetting.isPending}
            onConfirm={async () => {
              await deleteSetting.mutateAsync(record.id);
              message.success("Sozlama o'chirildi");
            }}
          >
            O'chirish
          </ConfirmButton>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button
          type="primary"
          className="!h-10 !rounded-xl !border-none !bg-[linear-gradient(90deg,var(--color-main)_0%,var(--color-primarydark)_100%)] !px-4 !font-medium !shadow-[0_14px_28px_rgba(87,106,219,0.24)] hover:!opacity-95"
          onClick={() => {
          setEditingSetting(null);
          setIsModalOpen(true);
        }}>
          Sozlama qo'shish
        </Button>
      </div>
      <Table
        keyExtractor={(setting) => setting.id}
        loading={loading}
        columns={columns}
        data={data}
        emptyMessage="Sozlamalar topilmadi"
        className="text-[var(--color-maindark)] dark:text-white/85"
      />
      <SettingFormModal
        branchId={branchId}
        open={isModalOpen}
        initialData={editingSetting}
        onClose={() => {
          setIsModalOpen(false);
          setEditingSetting(null);
        }}
      />
    </>
  );
};

export default SettingsTable;
