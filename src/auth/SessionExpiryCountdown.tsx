// dizayn-v2: tizim-feedback
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Clock, Lock } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cx } from "../shared/lib/cx";
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
 *  - Joyi: yuqori panel (`[data-shell-slot=topbar]`) ostida, o'sha ustun kengligida (yon menyu yopilmaydi);
 *    paneli yo'q qobiqda (`ScanLayout`) — oqimda, `sticky top-0` (sahifani suradi, yopmaydi). Qatlam: sahifa va pastki menyudan (`z-30`) yuqori,
 *    yuqori panel (`z-40`, ochiladigan menyulari), suriluvchi menyu va dialoglardan past.
 */

const TOPBAR_SELECTOR = "[data-shell-slot=topbar]";

const formatCountdown = (seconds: number) => {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
};

/**
 * Bannerni yuqori panel ostiga qo'yadi (to'g'ridan-to'g'ri DOM uslubi — holat va qayta chizish yo'q).
 * Panel topilmasa (`ScanLayout` — oyna o'zi aylanadi) — `sticky top-0`: banner oqimda, qobiq ustida turadi va
 * sahifani pastga suradi (taxta `tizim-feedback`: «hech narsani yopmaydi»), skrollda tepada qoladi. Shunda
 * skaner natijasining telefon sarlavhasi (orqaga tugmasi) 15 daqiqa banner ostida qolmaydi.
 */
const anchorUnderTopbar = (banner: HTMLElement) => {
  const bar = document.querySelector<HTMLElement>(TOPBAR_SELECTOR);
  const rect = bar?.getBoundingClientRect();
  const anchored = rect && rect.width > 0;
  banner.style.position = anchored ? "" : "sticky";
  banner.style.top = anchored ? `${Math.round(rect.bottom)}px` : "";
  banner.style.left = anchored ? `${Math.round(rect.left)}px` : "";
  banner.style.width = anchored ? `${Math.round(rect.width)}px` : "";
};

const SessionExpiryCountdown = () => {
  const { t } = useTranslation("auth");
  const location = useLocation();
  const [now, setNow] = useState(() => Date.now());
  const [metadata, setMetadata] = useState(() => tokenStorage.getSessionMetadata());
  const bannerRef = useRef<HTMLDivElement>(null);
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

  // Yuqori panel ostiga: o'lcham har soniyada (taymer bilan) va oyna o'zgarganda qayta olinadi — yon menyu
  // yig'ilsa yoki qobiq almashsa (`DashboardLayout` ↔ `ScanLayout`) banner o'zi suriladi.
  useLayoutEffect(() => {
    if (isVisible && bannerRef.current) anchorUnderTopbar(bannerRef.current);
  }, [isVisible, isExpired, now, location.pathname]);

  useEffect(() => {
    if (!isVisible) return;
    const onResize = () => {
      if (bannerRef.current) anchorUnderTopbar(bannerRef.current);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isVisible]);

  if (!isVisible) {
    return null;
  }

  const minutesLeft = Math.max(1, Math.ceil(remainingSeconds / 60));

  return (
    <div
      ref={bannerRef}
      data-session-banner={isExpired ? "expired" : "warning"}
      role={isExpired ? "alert" : "status"}
      // `*-soft` tungi mavzuda yarim shaffof — tagida `surface`, ostidagi sahifa ko'rinmasin.
      className="fixed inset-x-0 top-0 z-[35] bg-surface"
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
};

export default memo(SessionExpiryCountdown);
