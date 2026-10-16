// dizayn-v2: tizim-errors
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Compass, House } from "lucide-react";
import { Button, EmptyState } from "./primitives";
import { ErrorPageFrame, ErrorPageLink } from "./error-page/ErrorPageFrame";

/**
 * 404 — mavjud bo'lmagan manzil (taxta `tizim-errors` 01): kulrang `Compass`, «Xato kodi 404»,
 * asosiy — «Bosh sahifaga qaytish», ikkinchisi — «Orqaga» (brauzer tarixi).
 * Shell ichida (`*`) va shell'siz `/404` (`standalone`) route'larida.
 */
const NotFoundPage = ({ standalone = false }: { standalone?: boolean }) => {
  const { t } = useTranslation("ui");
  const navigate = useNavigate();

  return (
    <ErrorPageFrame standalone={standalone}>
      <EmptyState
        framed
        size="page"
        titleAs="h1"
        icon={Compass}
        overline={t("states.page.notFound.overline")}
        title={t("states.page.notFound.title")}
        description={t("states.page.notFound.description")}
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

export default memo(NotFoundPage);
