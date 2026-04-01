import { memo } from "react";
import { AlertTriangle, House, RefreshCw, ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ErrorActions from "./error-page/ErrorActions";
import ErrorCode from "./error-page/ErrorCode";
import ErrorInfoCard from "./error-page/ErrorInfoCard";
import ErrorPageLayout from "./error-page/ErrorPageLayout";

export interface RuntimeErrorPayload {
  message?: string;
  stack?: string;
  componentStack?: string;
}

interface ErrorBoundaryPageProps {
  error?: RuntimeErrorPayload | null;
}

const ErrorBoundaryPage = ({ error }: ErrorBoundaryPageProps) => {
  const navigate = useNavigate();
  const runtimeError = error ?? (() => {
    try {
      const payload = sessionStorage.getItem("elchi_runtime_error");
      return payload ? (JSON.parse(payload) as RuntimeErrorPayload) : null;
    } catch {
      return null;
    }
  })();
  const errorMessage = runtimeError?.message?.trim();
  const errorStack = [runtimeError?.stack, runtimeError?.componentStack].filter(Boolean).join("\n\n");

  return (
    <ErrorPageLayout>
      <ErrorCode leftDigit="5" rightDigit="0" subtitle="SOMETHING WENT WRONG" />

      <div className="mt-10 text-center">
        <h1 className="text-4xl font-black text-primary sm:text-5xl">
          Kutilmagan xato
        </h1>
        <p className="error-page-muted mx-auto mt-5 max-w-3xl text-sm leading-7 sm:text-base">
          Ilovada xato yuz berdi. Sahifani yangilang yoki biz bilan bog'laning.
        </p>
      </div>

      <div className="mt-10 grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
        <ErrorInfoCard icon={<AlertTriangle size={22} />} label="HOLAT" value="Komponent xatosi" />
        <ErrorInfoCard icon={<ShieldAlert size={22} />} label="KOD" value="Runtime Error" />
        <ErrorInfoCard icon={<RefreshCw size={22} />} label="TAVSIYA" value="Sahifani yangilang" />
      </div>

      {errorMessage && (
        <details className="error-page-card mt-8 w-full max-w-4xl rounded-3xl p-5 text-left">
          <summary className="cursor-pointer text-sm font-semibold text-primary">
            Xato tafsilotlari
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

      <ErrorActions
        primary={{
          label: "Sahifani yangilash",
          icon: <RefreshCw size={17} />,
          onClick: () => {
            sessionStorage.removeItem("elchi_runtime_error");
            window.location.reload();
          },
        }}
        secondary={{
          label: "Asosiy sahifaga qaytish",
          icon: <House size={17} />,
          onClick: () => {
            sessionStorage.removeItem("elchi_runtime_error");
            navigate("/");
          },
        }}
      />
    </ErrorPageLayout>
  );
};

export default memo(ErrorBoundaryPage);
