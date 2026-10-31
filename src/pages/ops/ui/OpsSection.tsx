import { Suspense, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Card, SkeletonLines } from "../../../shared/ui/primitives";
import { OpsTabBoundary } from "./OpsToolPage";

/**
 * Hub'dan ko'chgan ops vositasi boshqa sahifa ichida (F2NzXpMv): «Logistika» — `/returns`, «Filiallar» — `/batches`.
 * Kod alohida bo'lak, yiqilsa sahifaning qolgan qismi ishlayveradi. Ruxsatni sahifa tekshiradi: vosita faqat superadmin.
 */
export const OpsSection = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation("ops");
  return (
    <Suspense
      fallback={
        <Card>
          <SkeletonLines lines={4} />
        </Card>
      }
    >
      <OpsTabBoundary title={t("hub.tabError")} description={t("hub.tabErrorHint")} retryLabel={t("common.retry")}>
        {children}
      </OpsTabBoundary>
    </Suspense>
  );
};
