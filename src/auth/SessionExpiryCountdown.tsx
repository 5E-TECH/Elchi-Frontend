// dizayn-v2: tizim-feedback
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Clock, Lock } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cx } from "../shared/lib/cx";
import { useShellBannerSlot } from "../shared/lib/shellBannerSlot";
import { Button } from "../shared/ui/primitives";
import { logoutAndRedirect } from "./authService";
import tokenStorage, { AUTH_SESSION_METADATA_EVENT } from "./tokenStorage";

/**
 * ────────────────────────────────────────────────────────────────────────────
 *  SESSIYA BANNERI — dizayn v2 (taxta `tizim-feedback` 04 «Sahifa bannerlari»: «Sessiya tugashiga oz qoldi»,
 *  «Sessiya tugadi»; `.el-banner` + ton)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  Ilovada bir marta (`app/lib/provider.tsx`) — ENTRY chunk'da: faqat entry'da bor primitivlar (`Button`, `cx`),
 *  og'ir import yo'q (`npm run check:bundle`).
 *
 *  - `refreshTokenWarnAt` dan boshlab — ogohlantirish (`warning`, `Clock`): «Sessiya N daqiqadan keyin tugaydi.» +
 *    o'ngda `role="timer"` «mm:ss» (har soniya yangilanadi, o'zi e'lon qilinmaydi — `aria-live="off"`).
 *  - Muddat tugagach — `danger`, `role="alert"`, `Lock`: «Sessiya tugadi.» + «Qayta kirish». Keyingi har qanday
 *    bosish yoki tugma chiqishni bajaradi (shu tugma ham) — `logoutAndRedirect({ reason: "sessionExpired" })`,
 *    login sahifasida «Sessiya tugadi» ekrani.
 *  - `/login` da va `warnAt` dan oldin ko'rinmaydi.
 *  - Joyi (taxta: «sahifani pastga suradi — hech narsani yopmaydi»): `DashboardLayout` da shell slotiga
 *    (`[data-shell-slot=banner]`, yuqori panel ostida, `<main>` dan tashqarida) portal — oqimda, o'sha ustun
 *    kengligida (yon menyu yopilmaydi), skrollda panel bilan birga qoladi. Sloti yo'q qobiqda (`ScanLayout` —
 *    oyna o'zi aylanadi) — o'z joyida, `sticky top-0 z-[35]`: sahifani suradi, skrollda tepada qoladi. Yuqori
 *    panelning ochiladigan menyulari (`z-40`), suriluvchi menyu va dialoglar banner ustida.
 */

const formatCountdown = (seconds: number) => {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
};

const SessionExpiryCountdown = () => {
  const { t } = useTranslation("auth");
  const location = useLocation();
  const [now, setNow] = useState(() => Date.now());
  const [metadata, setMetadata] = useState(() => tokenStorage.getSessionMetadata());
  const shellSlot = useShellBannerSlot();
  const loggingOutRef = useRef(false);

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
  const isLoginPage = location.pathname === "/login";
  const isVisible = !isLoginPage && Boolean(refreshTokenExpiresAt && refreshTokenWarnAt && now >= refreshTokenWarnAt);

  const logoutExpired = useCallback(() => {
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;
    void logoutAndRedirect({ reason: "sessionExpired" });
  }, []);

  useEffect(() => {
    if (!isExpired || isLoginPage) return;

    const logoutOnNextAction = (event: Event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      logoutExpired();
    };

    window.addEventListener("pointerdown", logoutOnNextAction, { capture: true, once: true });
    window.addEventListener("keydown", logoutOnNextAction, { capture: true, once: true });

    return () => {
      window.removeEventListener("pointerdown", logoutOnNextAction, { capture: true });
      window.removeEventListener("keydown", logoutOnNextAction, { capture: true });
    };
  }, [isExpired, isLoginPage, logoutExpired]);

  if (!isVisible) {
    return null;
  }

  const minutesLeft = Math.max(1, Math.ceil(remainingSeconds / 60));

  const banner = (
    <div
      data-session-banner={isExpired ? "expired" : "warning"}
      role={isExpired ? "alert" : "status"}
      // `*-soft` tungi mavzuda yarim shaffof — tagida `surface` (sticky holatda ostidan sahifa ko'rinmasin).
      className={cx("bg-surface", !shellSlot && "sticky top-0 z-[35]")}
    >
      <div
        className={cx(
          "flex flex-wrap items-center gap-3 border-b border-border px-8 py-2.5 text-sm max-lg:px-4",
          isExpired ? "bg-danger-soft text-danger-fg" : "bg-warning-soft text-warning-fg",
        )}
      >
        {isExpired ? (
          <Lock aria-hidden="true" focusable="false" size={20} className="shrink-0" />
        ) : (
          <Clock aria-hidden="true" focusable="false" size={20} className="shrink-0" />
        )}
        <p className="m-0 min-w-0 flex-[1_1_260px] text-text">
          <span className="font-semibold">
            {isExpired ? t("sessionBanner.expiredTitle") : t("sessionBanner.warningTitle", { count: minutesLeft })}
          </span>{" "}
          <span className="text-text-muted">
            {isExpired ? t("sessionBanner.expiredText") : t("sessionBanner.warningText")}
          </span>
        </p>
        {isExpired ? (
          <Button size="sm" className="ml-auto" onClick={logoutExpired}>
            {t("sessionBanner.relogin")}
          </Button>
        ) : (
          <span
            role="timer"
            aria-live="off"
            aria-label={t("sessionBanner.timerLabel", {
              minutes: Math.floor(remainingSeconds / 60),
              seconds: remainingSeconds % 60,
            })}
            className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg bg-surface px-2.5 text-text"
          >
            <Clock aria-hidden="true" focusable="false" size={16} className="shrink-0 text-warning-fg" />
            <span className="font-semibold tabular-nums">{formatCountdown(remainingSeconds)}</span>
          </span>
        )}
      </div>
    </div>
  );

  return shellSlot ? createPortal(banner, shellSlot) : banner;
};

export default memo(SessionExpiryCountdown);
