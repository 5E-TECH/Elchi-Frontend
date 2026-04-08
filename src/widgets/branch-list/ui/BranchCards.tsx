import { Empty, Spin } from "antd";
import { BranchCard, type Branch } from "../../../entities/branch";

const BranchCards = ({ data, loading }: { data: Branch[]; loading?: boolean }) => {
  if (loading) {
    return <Spin />;
  }

  if (!data.length) {
    return <Empty description="Filiallar topilmadi" />;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {data.map((branch) => (
        <BranchCard key={branch.id} branch={branch} />
      ))}
    </div>
  );
};

export default BranchCards;
