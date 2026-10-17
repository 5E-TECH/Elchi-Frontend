// dizayn-v2: courier-scan-active, courier-scan-starting, courier-scan-permission-denied, courier-scan-success-flash, courier-scan-other-courier, courier-scan-invalid
import { memo, useCallback, useRef } from "react";
import { Clock, LockKeyhole, RefreshCw, Send, UserX } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  CameraCard,
  CameraChip,
  CameraHint,
  CameraStatus,
  CameraSurface,
  ScanFinder,
  TgScanner,
  closeTelegramWebApp,
  describeTgScanError,
  getTelegramWebApp,
  useTelegramAuth,
  type TelegramAuthState,
} from "../../features/tg-scan";
import { Button, Spinner } from "../../shared/ui/primitives";

/**
 * `/tg/scan` — kuryerning Telegram skan Mini App'i (MWYaqprw). Bot «📷 Skaner» `web_app` tugmasi shu
 * manzilni ochadi (URL'da token YO'Q). Oddiy kirishsiz ochiq route (`<Auth/>` dan tashqarida): kirish
 * faqat Telegram `initData` orqali, asosiy sessiya va uning interceptorlariga tegilmaydi.
 *
 * Telegram'dan tashqarida (`initData` bo'sh) — «Bu sahifa faqat Telegram ichida ochiladi», kamera ochilmaydi.
 */
const TgScanPage = () => {
  const { t } = useTranslation("tgScan");
  const surfaceRef = useRef<HTMLElement | null>(null);
  // Telegram sarlavhasi kamera yuzasi rangida bo'lsin — rang tungi `nav` tokenidan o'qiladi (literal yo'q).
  const readSurfaceColor = useCallback(
    () => (surfaceRef.current ? getComputedStyle(surfaceRef.current).getPropertyValue("--color-nav") : null),
    [],
  );
  const { state, retry, expire } = useTelegramAuth({ surfaceColor: readSurfaceColor });

  if (state.status === "ready") {
    return <TgScanner key={state.accessToken} webApp={state.webApp} accessToken={state.accessToken} onSessionExpired={expire} />;
  }

  const close = () => {
    const webApp = state.status === "not-courier" || state.status === "expired" ? state.webApp : getTelegramWebApp();
    if (webApp) closeTelegramWebApp(webApp);
  };

  const authErrorText = (current: Extract<TelegramAuthState, { status: "error" }>) => {
    const info = describeTgScanError(current.error);
    if (info.kind === "message" || info.kind === "session") return info.message ?? t("state.authErrorText");
    if (info.kind === "offline") return t("error.offline");
    if (info.kind === "timeout") return t("error.timeout");
    return t("state.authErrorText");
  };

  return (
    <CameraSurface
      surfaceRef={surfaceRef}
      label={state.status === "loading" ? t("chip.signingIn") : t("surfaceLabel")}
      busy={state.status === "loading"}
      title={t("title")}
      context={t("context")}
    >
      {state.status === "loading" ? (
        <>
          <CameraStatus>
            <CameraChip dot="info">{t("chip.signingIn")}</CameraChip>
          </CameraStatus>
          <ScanFinder paused mark={<Spinner size="lg" />} />
          <CameraHint live>{t("hint.signingIn")}</CameraHint>
        </>
      ) : state.status === "outside" ? (
        <CameraCard tone="neutral" icon={Send} alert={false} title={t("state.outsideTitle")} text={t("state.outsideText")} />
      ) : state.status === "error" ? (
        <CameraCard
          tone="error"
          icon={LockKeyhole}
          title={t("state.authErrorTitle")}
          text={authErrorText(state)}
          actions={
            <>
              <Button size="lg" leftIcon={RefreshCw} onClick={retry}>
                {t("action.retry")}
              </Button>
              <Button variant="secondary" size="lg" onClick={close}>
                {t("action.close")}
              </Button>
            </>
          }
        />
      ) : state.status === "not-courier" ? (
        <CameraCard
          tone="warning"
          icon={UserX}
          title={t("state.notCourierTitle")}
          text={t("state.notCourierText")}
          actions={
            <Button variant="secondary" size="lg" onClick={close}>
              {t("action.close")}
            </Button>
          }
        />
      ) : (
        <CameraCard
          tone="warning"
          icon={Clock}
          title={t("state.expiredTitle")}
          text={t("state.expiredText")}
          actions={
            <Button size="lg" onClick={close}>
              {t("action.close")}
            </Button>
          }
        />
      )}
    </CameraSurface>
  );
};

export default memo(TgScanPage);
