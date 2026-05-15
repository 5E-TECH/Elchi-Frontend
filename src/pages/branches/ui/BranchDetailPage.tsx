import { Spin } from "antd";
import { useParams } from "react-router-dom";
import { useBranchDetail, useBranchEmployees } from "../../../entities/branch";
import BackButton from "../../../shared/ui/BackButton";
import PageContainer from "../../../shared/ui/PageContainer";
import { BranchDetailWidget } from "../../../widgets/branch-detail";

const BranchDetailPage = () => {
  const { id = "" } = useParams();
  const { data: branch, isLoading: branchLoading } = useBranchDetail(id);
  const { data: employees = [], isLoading: employeesLoading } = useBranchEmployees(id);

  if (branchLoading) {
    return <Spin />;
  }

  return (
    <PageContainer className="space-y-4">
      <BackButton to="/branches" className="w-fit" />
      <BranchDetailWidget
        branchId={id}
        branch={branch ?? null}
        employees={employees}
        employeesLoading={employeesLoading}
      />
    </PageContainer>
  );
};

export default BranchDetailPage;
