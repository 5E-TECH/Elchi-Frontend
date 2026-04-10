import { Spin } from "antd";
import { useParams } from "react-router-dom";
import {
  useBranchDetail,
  useBranchEmployees,
  useBranchSettings,
} from "../../../entities/branch";
import { BranchDetailWidget } from "../../../widgets/branch-detail";

const BranchDetailPage = () => {
  const { id = "" } = useParams();
  const { data: branch, isLoading: branchLoading } = useBranchDetail(id);
  const { data: employees = [], isLoading: employeesLoading } = useBranchEmployees(id);
  const { data: settings = [], isLoading: settingsLoading } = useBranchSettings(id);

  if (branchLoading) {
    return <Spin />;
  }

  return (
    <BranchDetailWidget
      branchId={id}
      branch={branch ?? null}
      employees={employees}
      employeesLoading={employeesLoading}
      settings={settings}
      settingsLoading={settingsLoading}
    />
  );
};

export default BranchDetailPage;
