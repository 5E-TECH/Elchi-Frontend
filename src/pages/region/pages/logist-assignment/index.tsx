import { memo } from "react";
import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import type { RootState } from "../../../../app/config/store";
import PageContainer from "../../../../shared/ui/PageContainer";
import BackButton from "../../../../shared/ui/BackButton";

const RegionLogistAssignmentPage = () => {
  const { t } = useTranslation("region");
  const role = useSelector((state: RootState) => state.role.role);
  const canAccess = role === "admin" || role === "superadmin";

  if (!canAccess) {
    return <Navigate to="/regions" replace />;
  }

  return (
    <PageContainer>
        <BackButton to="/regions" className="mb-4 h-10 min-w-10 rounded-xl px-3" />
        <div className="rounded-2xl border border-primarydark/20 bg-primary p-5">
          <h1 className="text-xl font-bold text-main dark:text-primary">{t("logist.title")}</h1>
          <p className="mt-2 text-sm text-main/65 dark:text-primary/65">
            {t("logist.description")}
          </p>
        </div>
    </PageContainer>
  );
};

export default memo(RegionLogistAssignmentPage);
