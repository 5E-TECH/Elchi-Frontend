// dizayn-v2: tizim-errors
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { House } from "lucide-react";
import { ErrorState } from "./primitives";
import { ErrorPageFrame, ErrorPageLink } from "./error-page/ErrorPageFrame";

/**
 * 500 — server xato qaytardi (taxta `tizim-errors` 01): qizil `ServerCrash` (tizim xatosi), «Xato kodi 500»,
 * asosiy — «Qayta urinish» (sahifani qayta yuklash), ikkinchisi — «Bosh sahifaga qaytish».
 */
const ServerErrorPage = ({ standalone = false }: { standalone?: boolean }) => {
  const { t } = useTranslation("ui");

  return (
    <ErrorPageFrame standalone={standalone}>
      <ErrorState
        framed
        size="page"
        titleAs="h1"
        kind="server"
        overline={t("states.page.server.overline")}
        title={t("states.page.server.title")}
        description={t("states.page.server.description")}
        onRetry={() => window.location.reload()}
        actions={
          <ErrorPageLink to="/" icon={House} variant="secondary">
            {t("states.page.home")}
          </ErrorPageLink>
        }
      />
    </ErrorPageFrame>
  );
};

export default memo(ServerErrorPage);
