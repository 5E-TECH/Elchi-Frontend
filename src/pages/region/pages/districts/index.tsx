import { memo } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { ArrowLeft } from "lucide-react";
import type { RootState } from "../../../../app/config/store";
import PageContainer from "../../../../shared/ui/PageContainer";

const RegionDistrictsPage = () => {
  const navigate = useNavigate();
  const role = useSelector((state: RootState) => state.role.role);

  if (role !== "superadmin") {
    return <Navigate to="/regions" replace />;
  }

  return (
    <PageContainer>
        <button
          type="button"
          onClick={() => navigate("/regions")}
          className="mb-4 inline-flex items-center gap-2 rounded-xl border border-primarydark/20 bg-primary px-4 py-2 text-sm font-medium text-main dark:text-primary"
        >
          <ArrowLeft size={16} />
          Orqaga
        </button>
        <div className="rounded-2xl border border-primarydark/20 bg-primary p-5">
          <h1 className="text-xl font-bold text-main dark:text-primary">Tumanlar boshqaruvi</h1>
          <p className="mt-2 text-sm text-main/65 dark:text-primary/65">
            Bu bo‘lim post_control_system dagi region moduliga mos route bilan ulandi.
          </p>
        </div>
    </PageContainer>
  );
};

export default memo(RegionDistrictsPage);
