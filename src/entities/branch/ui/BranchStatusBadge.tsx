import { Badge } from "antd";
import { memo } from "react";

const BranchStatusBadge = ({ status }: { status: "active" | "inactive" }) => {
  const isActive = status === "active";

  return (
    <Badge
      color={isActive ? "#22c55e" : "#ef4444"}
      text={<span className="text-[var(--color-maindark)] dark:text-white">{isActive ? "Faol" : "Nofaol"}</span>}
    />
  );
};

export default memo(BranchStatusBadge);
