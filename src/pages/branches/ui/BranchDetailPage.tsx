// dizayn-v2: superadmin-branches-detail, superadmin-branches-add-employee-dialog
import { Building2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { useBranchDetail, useBranchEmployees } from "../../../entities/branch";
import { getErrorStatus } from "../../../shared/lib/errorKind";
import {
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  SkeletonLines,
  SkeletonTable,
} from "../../../shared/ui/primitives";
import { BranchDetailWidget } from "../../../widgets/branch-detail";
import BranchMetricsSection from "./BranchMetricsSection";

/**
 * FILIAL TAFSILOTI — `/branches/:id` (faqat superadmin). Filial va uning xodimlari parallel so'raladi;
 * yuklanishda skelet (sarlavha, ma'lumot kartasi, xodimlar jadvali), topilmasa — «Filial topilmadi»,
 * boshqa xatoda — `ErrorState` + «Qayta urinish»; har holatda «← Filiallar». Filial topilgach —
 * «Filial ko'rsatkichlari» (`BranchMetricsSection`, o'z so'rovi va holatlari bilan).
 */
const BranchDetailPage = () => {
  const { t } = useTranslation("branches");
  const { id = "" } = useParams();
  // 404 / xato sahifada (`ErrorState`), xodimlar xatosi o'z kartasida — global xabar (backend inglizcha
  // «Branch not found») takrorlanmaydi.
  const branchQuery = useBranchDetail(id, { silentError: true });
  const employeesQuery = useBranchEmployees(id, true, { silentError: true });
  const { data: branch, isLoading, error, refetch } = branchQuery;

  if (isLoading) {
    return (
      <div className="flex min-w-0 flex-col gap-6 max-md:gap-4" aria-busy="true">
        <span role="status" className="sr-only">
          {t("v2.detail.loading")}
        </span>
        <PageHeader
          back="/branches"
          backLabel={t("page.title")}
          title={<Skeleton width={220} height={32} />}
          description={<Skeleton width={300} height={14} />}
        />
        <Card>
          <SkeletonLines lines={3} />
        </Card>
        <Card title={t("employee.title")} padding="none" divided>
          <SkeletonTable
            framed={false}
            rows={4}
            columns={[t("employee.employee"), t("employee.position"), t("employee.joinedDate"), t("table.actions")]}
          />
        </Card>
      </div>
    );
  }

  if (!branch) {
    const notFound = !error || getErrorStatus(error) === 404;
    return (
      <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
        <PageHeader back="/branches" backLabel={t("page.title")} title={t("v2.detail.fallbackTitle")} />
        <Card padding="none">
          {notFound ? (
            <EmptyState icon={Building2} title={t("detail.notFound")} description={t("v2.detail.notFoundHint")} />
          ) : (
            <ErrorState error={error} title={t("v2.detail.loadFailed")} onRetry={() => void refetch()} />
          )}
        </Card>
      </div>
    );
  }

  return (
    <BranchDetailWidget
      branchId={id}
      branch={branch}
      employeesQuery={employeesQuery}
      metrics={<BranchMetricsSection branchId={id} branchName={branch.name} />}
    />
  );
};

export default BranchDetailPage;
