import { Empty, Spin } from "antd";
import { useTranslation } from "react-i18next";
import { BranchCard, type Branch } from "../../../entities/branch";

type BranchCardsProps = {
  data: Branch[];
  loading?: boolean;
  onEdit: (branch: Branch) => void;
};

const BranchCards = ({ data, loading, onEdit }: BranchCardsProps) => {
  const { t } = useTranslation("branches");

  if (loading) {
    return <Spin />;
  }

  if (!data.length) {
    return <Empty description={t("list.notFound")} />;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {data.map((branch) => (
        <BranchCard key={branch.id} branch={branch} onEdit={onEdit} />
      ))}
    </div>
  );
};

export default BranchCards;
