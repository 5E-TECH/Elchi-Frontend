import { memo, useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { logoutAndRedirect } from "./authService";
import tokenStorage, { AUTH_SESSION_METADATA_EVENT } from "./tokenStorage";

const formatCountdown = (seconds: number) => {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
};

const SessionExpiryCountdown = () => {
  const { t } = useTranslation("common");
  const location = useLocation();
  const [now, setNow] = useState(() => Date.now());
  const [metadata, setMetadata] = useState(() => tokenStorage.getSessionMetadata());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    const onMetadataChange = () => setMetadata(tokenStorage.getSessionMetadata());

    window.addEventListener(AUTH_SESSION_METADATA_EVENT, onMetadataChange);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(AUTH_SESSION_METADATA_EVENT, onMetadataChange);
    };
  }, []);

  const { refreshTokenExpiresAt, refreshTokenWarnAt } = metadata;
  const remainingSeconds = refreshTokenExpiresAt
    ? Math.max(0, Math.ceil((refreshTokenExpiresAt - now) / 1000))
    : 0;
  const isExpired = Boolean(refreshTokenExpiresAt && remainingSeconds <= 0);

  useEffect(() => {
    if (!isExpired || location.pathname === "/login") return;

    const logoutOnNextAction = (event: Event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      void logoutAndRedirect();
    };

    window.addEventListener("pointerdown", logoutOnNextAction, { capture: true, once: true });
    window.addEventListener("keydown", logoutOnNextAction, { capture: true, once: true });

    return () => {
      window.removeEventListener("pointerdown", logoutOnNextAction, { capture: true });
      window.removeEventListener("keydown", logoutOnNextAction, { capture: true });
    };
  }, [isExpired, location.pathname]);

  if (location.pathname === "/login") {
    return null;
  }

  if (!refreshTokenExpiresAt || !refreshTokenWarnAt || now < refreshTokenWarnAt) {
    return null;
  }

  return (
    <div className="fixed left-1/2 top-24 z-[10040] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-2xl border border-amber-300/25 bg-[#1f1938]/95 px-4 py-3 text-white shadow-2xl shadow-amber-500/15 backdrop-blur-xl dark:bg-[#1f1938]/95">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-amber-200">
          <Clock3 size={20} />
        </div>
        <div className="min-w-0">
          <p className="m-0 text-[10px] font-black uppercase tracking-[0.16em] text-amber-100/75">
            {isExpired
              ? t("sessionExpired", { defaultValue: "Sessiya tugadi" })
              : t("sessionExpiresIn", { defaultValue: "Sessiya tugashiga" })}
          </p>
          <p className="m-0 mt-1 font-mono text-3xl font-black leading-none tracking-normal">
            {formatCountdown(remainingSeconds)}
          </p>
        </div>
      </div>
    </div>
  );
};

export default memo(SessionExpiryCountdown);
