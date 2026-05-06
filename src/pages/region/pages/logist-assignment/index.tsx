import { memo } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { ArrowLeft } from "lucide-react";
import type { RootState } from "../../../../app/config/store";

const RegionLogistAssignmentPage = () => {
  const navigate = useNavigate();
  const role = useSelector((state: RootState) => state.role.role);
  const canAccess = role === "admin" || role === "superadmin";

  if (!canAccess) {
    return <Navigate to="/regions" replace />;
  }

  return (
    <div className="h-full overflow-auto">
      <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <button
          type="button"
          onClick={() => navigate("/regions")}
          className="mb-4 inline-flex items-center gap-2 rounded-xl border border-primarydark/20 bg-primary px-4 py-2 text-sm font-medium text-main dark:text-primary"
        >
          <ArrowLeft size={16} />
          Orqaga
        </button>
        <div className="rounded-2xl border border-primarydark/20 bg-primary p-5">
          <h1 className="text-xl font-bold text-main dark:text-primary">Logist biriktirish</h1>
          <p className="mt-2 text-sm text-main/65 dark:text-primary/65">
            Bu bo‘lim post_control_system dagi region moduliga mos route bilan ulandi.
          </p>
        </div>
      </div>
    </div>
  );
};

export default memo(RegionLogistAssignmentPage);
