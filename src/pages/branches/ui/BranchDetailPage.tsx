import { Spin } from "antd";
import { useParams } from "react-router-dom";
import { useBranchDetail, useBranchEmployees } from "../../../entities/branch";
import BackButton from "../../../shared/ui/BackButton";
import PageContainer from "../../../shared/ui/PageContainer";
import QueryErrorState from "../../../shared/ui/QueryErrorState";
import { BranchDetailWidget } from "../../../widgets/branch-detail";

const BranchDetailPage = () => {
  const { id = "" } = useParams();
  const { data: branch, isLoading: branchLoading, isError: branchError, refetch } = useBranchDetail(id);
  const { data: employees = [], isLoading: employeesLoading } = useBranchEmployees(id);

  if (branchLoading) {
    return <Spin />;
  }

  if (branchError) {
    return (
      <PageContainer className="space-y-4">
        <BackButton to="/branches" className="w-fit" />
        <QueryErrorState onRetry={() => refetch()} />
      </PageContainer>
    );
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
