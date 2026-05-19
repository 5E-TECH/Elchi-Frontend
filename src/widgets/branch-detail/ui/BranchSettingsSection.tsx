import type { BranchSetting } from "../../../entities/branch";
import { BranchSettingsWidget } from "../../branch-settings";
import { useTranslation } from "react-i18next";

interface BranchSettingsSectionProps {
  branchId: string;
  data: BranchSetting[];
  loading?: boolean;
}

const BranchSettingsSection = ({
  branchId,
  data,
  loading,
}: BranchSettingsSectionProps) => {
  const { t } = useTranslation("branches");

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-maindark dark:text-white">
          {t("settings.title")}
        </h2>
        <p className="text-sm text-maindark/60 dark:text-white/60">
          {t("settings.description")}
        </p>
      </div>

      <BranchSettingsWidget branchId={branchId} data={data} loading={loading} />
    </div>
  );
};

export default BranchSettingsSection;
