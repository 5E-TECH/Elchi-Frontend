import { Badge } from "antd";
import { memo } from "react";

const BranchStatusBadge = ({ status }: { status: "active" | "inactive" }) => {
  return (
    <Badge
      status={status === "active" ? "success" : "default"}
      text={<span className="text-[var(--color-maindark)] dark:text-white">{status === "active" ? "Faol" : "Nofaol"}</span>}
    />
  );
};

export default memo(BranchStatusBadge);
