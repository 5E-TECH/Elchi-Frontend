// dizayn-v2: superadmin-regions-logist-assignment, admin-regions-logist-assignment
import { memo } from "react";
import { ArrowLeft, Headset } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import type { RootState } from "../../../../app/config/store";
import {
  buttonClasses,
  ButtonIcon,
  EmptyState,
  PageHeader,
} from "../../../../shared/ui/primitives";

/**
 * LOGIST BIRIKTIRISH (superadmin, admin). Maketdagi bo'sh holat: bo'lim hali ishga tushmagan
 * (§9 savol 13 sukuti — backend'da `GET /logists`, `PATCH /region/{id}/logist` bor, ishlaydigan sahifa
 * uchun maket kerak).
 */
const RegionLogistAssignmentPage = () => {
  const { t } = useTranslation("region");
  const role = useSelector((state: RootState) => state.role.role);
  const canAccess = role === "admin" || role === "superadmin";

  if (!canAccess) {
    return <Navigate to="/regions" replace />;
  }

  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      <PageHeader
        back="/regions"
        backLabel={t("v2.page.title")}
        title={t("v2.logist.title")}
        description={t("v2.logist.subtitle")}
      />
      <EmptyState
        framed
        icon={Headset}
        title={t("v2.logist.empty.title")}
        description={t("v2.logist.empty.text")}
        action={
          <Link to="/regions" className={buttonClasses({ variant: "secondary" })}>
            <ButtonIcon icon={ArrowLeft} px={16} />
            {t("v2.logist.back")}
          </Link>
        }
      />
    </div>
  );
};

export default memo(RegionLogistAssignmentPage);
