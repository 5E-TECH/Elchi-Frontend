import { Button, message } from "antd";
import { useState } from "react";
import type { BranchSetting } from "../../../entities/branch";
import { useDeleteSetting, SettingFormModal } from "../../../features/branch-settings-manage";
import { Table } from "../../../shared/components/Table/Table";
import type { ColumnConfig } from "../../../shared/components/Table/Table.types";
import { ConfirmButton } from "../../../shared/ui/ConfirmButton";
import { useTranslation } from "react-i18next";

interface BranchSettingsWidgetProps {
  branchId: string;
  data: BranchSetting[];
  loading?: boolean;
}

const BranchSettingsWidget = ({
  branchId,
  data,
  loading,
}: BranchSettingsWidgetProps) => {
  const { t } = useTranslation("branches");
  const [editingSetting, setEditingSetting] = useState<BranchSetting | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const deleteSetting = useDeleteSetting(branchId);

  const columns: ColumnConfig<BranchSetting>[] = [
    { key: "key", label: t("settings.key"), sortable: true },
    { key: "value", label: t("settings.value"), sortable: true },
    {
      key: "id",
      label: t("table.actions"),
      render: (_, record) => (
        <div
          className="flex flex-wrap items-center gap-2"
          onClick={(event) => event.stopPropagation()}
        >
          <Button
            size="small"
            className="branch-settings-action"
            onClick={() => {
              setEditingSetting(record);
              setIsModalOpen(true);
            }}
          >
            {t("actions.edit")}
          </Button>
          <ConfirmButton
            size="small"
            className="branch-settings-action branch-settings-action-danger"
            confirmTitle={t("settings.deleteConfirm")}
            popupTheme="branch"
            loading={deleteSetting.isPending}
            onConfirm={async () => {
              await deleteSetting.mutateAsync(record.id);
              message.success(t("settings.deleted"));
            }}
          >
            {t("actions.delete")}
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
          className="branch-settings-primary-action"
          onClick={() => {
            setEditingSetting(null);
            setIsModalOpen(true);
          }}
        >
          {t("settings.add")}
        </Button>
      </div>

      <Table
        keyExtractor={(setting) => setting.id}
        loading={loading}
        columns={columns}
        data={data}
        emptyMessage={t("settings.notFound")}
        className="text-maindark dark:text-white/85"
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

export default BranchSettingsWidget;
