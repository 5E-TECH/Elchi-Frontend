import { Empty, Spin } from "antd";
import { useTranslation } from "react-i18next";
import { BranchCard, type Branch } from "../../../entities/branch";

const BranchCards = ({ data, loading }: { data: Branch[]; loading?: boolean }) => {
  const { t } = useTranslation("branches");

  if (loading) {
    return <Spin />;
  }

  if (!data.length) {
    return <Empty description={t("list.notFound")} />;
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
