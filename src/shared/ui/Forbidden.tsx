// dizayn-v2: tizim-errors
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, House, Lock } from "lucide-react";
import { Button, EmptyState } from "./primitives";
import { ErrorPageFrame, ErrorPageLink } from "./error-page/ErrorPageFrame";

/**
 * 403 — rolga ruxsat berilmagan bo'lim (taxta `tizim-errors` 01): KULRANG `Lock` (xato emas — qizil yo'q),
 * «Xato kodi 403», asosiy — «Bosh sahifaga qaytish», ikkinchisi — «Orqaga».
 */
const ForbiddenPage = ({ standalone = false }: { standalone?: boolean }) => {
  const { t } = useTranslation("ui");
  const navigate = useNavigate();

  return (
    <ErrorPageFrame standalone={standalone}>
      <EmptyState
        framed
        size="page"
        titleAs="h1"
        icon={Lock}
        overline={t("states.page.forbidden.overline")}
        title={t("states.page.forbidden.title")}
        description={t("states.page.forbidden.description")}
        action={
          <>
            <ErrorPageLink to="/" icon={House}>
              {t("states.page.home")}
            </ErrorPageLink>
            <Button variant="secondary" leftIcon={ArrowLeft} onClick={() => navigate(-1)}>
              {t("states.page.back")}
            </Button>
          </>
        }
      />
    </ErrorPageFrame>
  );
};

export default memo(ForbiddenPage);
