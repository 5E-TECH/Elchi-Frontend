import { memo, useState } from "react";
import { RefreshCcw, ShieldCheck, TriangleAlert } from "lucide-react";
import HeaderName from "../../shared/components/headerName";
import { refreshAccessToken } from "../../auth/authService";

type RequestState = "idle" | "success" | "error";

const LogsPage = () => {
  const [requestState, setRequestState] = useState<RequestState>("idle");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [message, setMessage] = useState(
    "Refresh endpointga so'rov yuborish uchun tugmani bosing.",
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRequestState("idle");
    setMessage("Refresh so'rovi yuborilmoqda...");

    try {
      const accessToken = await refreshAccessToken();

      setRequestState("success");
      setMessage(
        `Refresh muvaffaqiyatli bajarildi. Yangi token olindi: ${accessToken.slice(0, 16)}...`,
      );
    } catch {
      setRequestState("error");
      setMessage("Refresh so'rovida xatolik yuz berdi.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const statusIcon =
    requestState === "success" ? (
      <ShieldCheck size={18} />
    ) : requestState === "error" ? (
      <TriangleAlert size={18} />
    ) : (
      <RefreshCcw size={18} />
    );

  const statusToneClassName =
    requestState === "success"
      ? "border-[color:var(--color-success)]/30 bg-[color:var(--color-success)]/12 text-[color:var(--color-success)]"
      : requestState === "error"
        ? "border-[color:var(--color-error)]/30 bg-[color:var(--color-error)]/12 text-[color:var(--color-error)]"
        : "border-[color:var(--color-border-soft)] bg-[color:var(--color-main-soft)] text-[var(--color-main)]";

  return (
    <div className="min-h-full rounded-2xl p-4 md:p-6">
      <div className="mb-4">
        <HeaderName
          name="Loglar"
          description="Refresh endpointga test so'rov yuborish sahifasi"
          icon={<RefreshCcw size={22} />}
        />
      </div>

      <div className="mx-auto max-w-3xl rounded-[1.75rem] border border-(--color-border-soft) bg-primary p-5 shadow-sm dark:bg-primarydark md:p-6">
        <div className="rounded-3xl border border-(--color-border-soft) bg-main-soft p-5 dark:bg-background-soft">
          <p className="text-sm font-semibold text-maindark dark:text-primary">
            Endpoint
          </p>
          <p className="mt-2 text-sm text-(--color-text-muted) dark:text-text-muted-dark">
            `POST /auth/refresh`
          </p>

          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={isRefreshing}
            className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,var(--color-main)_0%,var(--color-primarydark)_100%)] px-5 py-3 text-sm font-semibold text-primary shadow-[0_16px_30px_color-mix(in_srgb,var(--color-main)_28%,transparent)] transition-all hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <RefreshCcw
              size={16}
              className={isRefreshing ? "animate-spin" : ""}
            />
            {isRefreshing ? "Yuborilmoqda..." : "Refresh so'rov yuborish"}
          </button>
        </div>

        <div
          className={`mt-4 flex items-start gap-3 rounded-2xl border p-4 ${statusToneClassName}`}
        >
          <span className="mt-0.5 shrink-0">{statusIcon}</span>
          <p className="text-sm font-medium">{message}</p>
        </div>
      </div>
    </div>
  );
};

export default memo(LogsPage);
