import type { BranchSetting } from "../../../entities/branch";
import { BranchSettingsWidget } from "../../branch-settings";

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
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-[var(--color-maindark)] dark:text-white">
          Filial sozlamalari
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-text-muted-dark)]">
          Filialga tegishli kalit-qiymat sozlamalarini shu joydan boshqaring.
        </p>
      </div>

      <BranchSettingsWidget branchId={branchId} data={data} loading={loading} />
    </div>
  );
};

export default BranchSettingsSection;
