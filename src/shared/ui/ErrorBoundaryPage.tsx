import { memo, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { House, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import EmptyState from "./EmptyState";
import {
  clearRuntimeError,
  getRuntimeError,
  getRuntimeErrorRecoveryPath,
  type RuntimeErrorPayload,
} from "../lib/runtimeError";

interface ErrorBoundaryPageProps {
  error?: RuntimeErrorPayload | null;
}

const ErrorBoundaryPage = ({ error }: ErrorBoundaryPageProps) => {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const runtimeError = useMemo(() => error ?? getRuntimeError(), [error]);
  const recoveryPath = getRuntimeErrorRecoveryPath(runtimeError);
  const errorMessage = runtimeError?.message?.trim();
  const errorStack = [runtimeError?.stack, runtimeError?.componentStack].filter(Boolean).join("\n\n");

  useEffect(() => {
    if (!runtimeError) {
      navigate("/", { replace: true });
    }
  }, [navigate, runtimeError]);

  if (!runtimeError) return null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4 dark:bg-background">
      <div className="w-full max-w-3xl">
        <EmptyState
          icon="😵"
          title={t("runtimeErrorTitle")}
          description={errorMessage ? <>{t("technicalInfo")}: <span className="font-mono">{errorMessage}</span></> : t("runtimeErrorDescription")}
          className="border-white/10 bg-primary/95 py-14 dark:bg-maindark"
          action={(
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  clearRuntimeError();
                  window.location.replace(recoveryPath);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-main px-5 py-3 text-sm font-bold text-white shadow-lg shadow-main/25 transition hover:bg-main/90"
              >
                <RefreshCw size={16} />
                {t("reload")}
              </button>
              <button
                type="button"
                onClick={() => {
                  clearRuntimeError();
                  navigate("/", { replace: true });
                }}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[color:var(--color-border-soft)] bg-white px-5 py-3 text-sm font-bold text-maindark transition hover:border-main/50 hover:text-main dark:border-white/10 dark:bg-white/5 dark:text-white"
              >
                <House size={16} />
                {t("homePage")}
              </button>
            </div>
          )}
        />

        {errorMessage && (
        <details className="mt-5 w-full rounded-3xl border border-[color:var(--color-border-soft)] bg-primary p-5 text-left shadow-sm dark:border-white/10 dark:bg-maindark">
          <summary className="cursor-pointer text-sm font-semibold text-primary">
            {t("errorDetails")}
          </summary>
          <div className="mt-4 rounded-2xl border border-[color:var(--color-glass-border)] bg-[color:var(--color-glass)] p-4">
            <p className="font-mono text-xs leading-6 text-primary">
              {errorMessage}
            </p>
            {errorStack && (
              <pre className="mt-4 overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs leading-6 text-[color:var(--color-error-page-text-muted)]">
                {errorStack}
              </pre>
            )}
          </div>
        </details>
        )}
      </div>
    </main>
  );
};

export default memo(ErrorBoundaryPage);
