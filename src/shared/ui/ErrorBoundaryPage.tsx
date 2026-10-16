// dizayn-v2: tizim-errors
import { memo, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { House, TriangleAlert } from "lucide-react";
import { Button, ErrorState } from "./primitives";
import { ErrorPageFrame } from "./error-page/ErrorPageFrame";
import {
  clearRuntimeError,
  getRuntimeError,
  getRuntimeErrorRecoveryPath,
  type RuntimeErrorPayload,
} from "../lib/runtimeError";

interface ErrorBoundaryPageProps {
  error?: RuntimeErrorPayload | null;
  /** Shell'siz route (`/runtime-error` — global `ErrorBoundary` shu yerga to'liq qayta yuklash bilan o'tadi). */
  standalone?: boolean;
}

/**
 * Ilova xatosi — sahifa kodi ishdan chiqdi (taxta `tizim-errors` 01): qizil `TriangleAlert`, «Kutilmagan xato»,
 * asosiy — «Qayta urinish» (xato bo'lgan sahifaga qaytadi), ikkinchisi — «Bosh sahifaga qaytish»;
 * texnik matn (xabar + stek) — yopiq «Xato tafsilotlari» blokida. Xato yozuvi yo'q bo'lsa — bosh sahifaga.
 */
const ErrorBoundaryPage = ({ error, standalone = false }: ErrorBoundaryPageProps) => {
  const { t } = useTranslation("ui");
  const navigate = useNavigate();
  const runtimeError = useMemo(() => error ?? getRuntimeError(), [error]);
  const recoveryPath = getRuntimeErrorRecoveryPath(runtimeError);
  const errorMessage = runtimeError?.message?.trim();
  const errorDetails = [errorMessage, runtimeError?.stack, runtimeError?.componentStack]
    .filter(Boolean)
    .join("\n\n");

  useEffect(() => {
    if (!runtimeError) {
      navigate("/", { replace: true });
    }
  }, [navigate, runtimeError]);

  if (!runtimeError) return null;

  return (
    <ErrorPageFrame standalone={standalone}>
      <ErrorState
        framed
        size="page"
        titleAs="h1"
        kind="section"
        icon={TriangleAlert}
        overline={t("states.page.runtime.overline")}
        title={t("states.page.runtime.title")}
        description={t("states.page.runtime.description")}
        onRetry={() => {
          clearRuntimeError();
          window.location.replace(recoveryPath);
        }}
        actions={
          <Button
            variant="secondary"
            leftIcon={House}
            onClick={() => {
              clearRuntimeError();
              navigate("/", { replace: true });
            }}
          >
            {t("states.page.home")}
          </Button>
        }
        details={errorDetails || undefined}
      />
    </ErrorPageFrame>
  );
};

export default memo(ErrorBoundaryPage);
