// dizayn-v2: investor-dashboard-forbidden, investor-dashboard-not-linked
import { Lock, LogOut, RefreshCw, Unlink } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { InvestorAccessProblem } from "../../../entities/investors";
import { useLogout } from "../../../shared/lib/useLogout";
import { Button, EmptyState } from "../../../shared/ui/primitives";

/**
 * Kabinet ochilmadi (maketlar `investor-dashboard-forbidden`, `-not-linked`): 403 — profil nofaol (qulf),
 * 404 — login investor yozuviga bog'lanmagan, 409 — bir nechta yozuv (o'sha ko'rinish, o'z matni). Xato emas —
 * kulrang; «Qayta urinish» (administrator tuzatgach) va «Chiqish». Backend matni ko'rsatilmaydi.
 */
export const InvestorAccessState = ({
  problem,
  onRetry,
  retrying,
}: {
  problem: InvestorAccessProblem;
  onRetry: () => void;
  retrying?: boolean;
}) => {
  const { t } = useTranslation("investor");
  const { logout } = useLogout();

  return (
    <EmptyState
      framed
      size="page"
      data-investor-access={problem}
      icon={problem === "inactive" ? Lock : Unlink}
      overline={t(`access.${problem}.overline`)}
      title={t(`access.${problem}.title`)}
      description={t(`access.${problem}.text`)}
      action={
        <>
          <Button variant="secondary" leftIcon={RefreshCw} loading={retrying} onClick={onRetry}>
            {t("access.retry")}
          </Button>
          <Button variant="ghost" leftIcon={LogOut} onClick={() => void logout()}>
            {t("access.logout")}
          </Button>
        </>
      }
    />
  );
};
