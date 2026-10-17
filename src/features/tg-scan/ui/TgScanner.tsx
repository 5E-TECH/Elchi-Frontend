// dizayn-v2: courier-scan-active, courier-scan-starting, courier-scan-permission-denied, courier-scan-success-flash, courier-scan-other-courier, courier-scan-invalid
import { useCallback, useRef, useState } from "react";
import {
  Ban,
  CameraOff,
  Check,
  Flashlight,
  History,
  Info,
  List,
  RefreshCw,
  ScanLine,
  ScanQrCode,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import { useCameraQrScanner } from "../../../shared/lib/useCameraQrScanner";
import { useKeyboardScanner } from "../../../shared/lib/useKeyboardScanner";
import { Button, Spinner } from "../../../shared/ui/primitives";
import { finishScanSession } from "../api/tgScanApi";
import { describeTgScanError, type TgScanErrorInfo } from "../model/scanError";
import {
  canUseTelegramQrPopup,
  closeTelegramWebApp,
  openTelegramQrPopup,
  type TelegramWebApp,
} from "../model/telegramWebApp";
import { useScanAssign, type ScanFeedback } from "../model/useScanAssign";
import { useScanEntryText } from "../model/useScanEntryText";
import {
  CameraBottom,
  CameraButton,
  CameraCard,
  CameraChip,
  CameraHint,
  CameraLastScan,
  CameraStatus,
  CameraSurface,
  CameraToast,
  CameraToasts,
  ScanFinder,
  type CameraTone,
} from "./CameraSurface";
import { ScanListSheet } from "./ScanListSheet";

/**
 * TELEGRAM SKAN MINI APP — faol skaner (`/tg/scan`, MWYaqprw).
 *
 * Maketlar (telefon): `courier-scan-active` (kamera, «Skanerlash faol», oxirgi skan), `-starting`,
 * `-success-flash`, `-other-courier` / `-invalid` (xato xabarlari), `-permission-denied`
 * (kamera ochilmadi). Hisoblagich «N ta qabul qilindi», «Ro'yxat» va «Tayyor» maketda yo'q (kartada
 * so'ralgan) — eng yaqin namuna `courier-courier-bulk-scanner-camera(-list)`: hisoblagich qatori + bitta
 * asosiy amal; chiroq o'sha maketdagidek yuqori panelda.
 *
 * - Kamera uzluksiz ishlaydi; har skan → `scan-assign` → tebranish + ramka chaqnashi + xabar + qator.
 *   Xatoda ham kamera to'xtamaydi (TC: oqim to'xtamaydi).
 * - iOS: kamera ochilmasa va Telegram skaneri bor bo'lsa — «Telegram skaneri» (`showScanQrPopup`).
 *   Har skandan keyin oyna YOPILADI (`true`): natija (tuman, mijoz yoki xato matni) Telegram oynasi
 *   ortida qolib ketmasin; keyingi posilka uchun tugma qayta bosiladi.
 * - «Tayyor» → yo'ldagi skanlar tugashini kutadi → `POST /telegram/scan/done` (qabul qilingan id'lar;
 *   bo'lmasa so'rovsiz) → `Telegram.WebApp.close()`. Xato bo'lsa — xabar, qayta urinish yoki baribir yopish.
 */

type FinishState = { status: "idle" } | { status: "sending" } | { status: "error"; error: TgScanErrorInfo };

const FEEDBACK_TONE: Record<ScanFeedback["kind"], CameraTone> = {
  assigned: "success",
  already: "info",
  repeat: "info",
  failed: "error",
  invalid: "error",
};

const FEEDBACK_ICON: Record<ScanFeedback["kind"], LucideIcon> = {
  assigned: Check,
  already: Info,
  repeat: Info,
  failed: X,
  invalid: Ban,
};

type TgScannerProps = {
  webApp: TelegramWebApp;
  accessToken: string;
  onSessionExpired: () => void;
};

export const TgScanner = ({ webApp, accessToken, onSessionExpired }: TgScannerProps) => {
  const { t } = useTranslation("tgScan");
  const { numberOf, titleOf, placeOf, errorText, statusOf } = useScanEntryText();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [finish, setFinish] = useState<FinishState>({ status: "idle" });
  const [listOpen, setListOpen] = useState(false);
  const [feedLive, setFeedLive] = useState(false);
  const finishing = finish.status !== "idle";

  const { entries, acceptedOrderIds, pendingCount, feedback, flash, handleScan, settle } = useScanAssign({
    accessToken,
    webApp,
    // Ro'yxat varag'i ochiq bo'lsa skanlar e'tiborsiz (natija varaq ortida ko'rinmay qolmasin); kamera ishlayveradi.
    enabled: !finishing && !listOpen,
    onSessionExpired,
  });

  const handleCameraDecode = useCallback((value: string) => handleScan(value, "camera"), [handleScan]);
  const handleKeyboardScan = useCallback(
    (value: string) => {
      handleScan(value, "keyboard");
      return true;
    },
    [handleScan],
  );

  const camera = useCameraQrScanner({
    isActive: !finishing,
    videoRef,
    onDecode: handleCameraDecode,
    startErrorMessage: t("fallback.startError"),
  });

  // Bluetooth/USB skaner (klaviatura sifatida) — kamera bilan bir xil oqim.
  useKeyboardScanner({ enabled: !finishing && !listOpen, onScan: handleKeyboardScan });

  const cameraFailed = Boolean(camera.cameraError) || camera.cameraUnavailable;
  const starting = !cameraFailed && (camera.isStarting || !feedLive);
  const popupAvailable = canUseTelegramQrPopup(webApp);

  const openTelegramScanner = () => {
    openTelegramQrPopup(webApp, t("fallback.popupText"), (text) => {
      handleScan(text, "telegram");
      return true;
    });
  };

  const retryCamera = () => {
    setFeedLive(false);
    camera.restartScanner();
  };

  const handleDone = async () => {
    if (finish.status === "sending") return;
    setListOpen(false);
    setFinish({ status: "sending" });
    const orderIds = await settle();
    if (orderIds.length > 0) {
      try {
        await finishScanSession(accessToken, orderIds);
      } catch (error) {
        const info = describeTgScanError(error);
        if (info.kind === "session") {
          onSessionExpired();
          return;
        }
        setFinish({ status: "error", error: info });
        return;
      }
    }
    closeTelegramWebApp(webApp);
  };

  const backToScanning = () => {
    setFeedLive(false);
    setFinish({ status: "idle" });
  };

  const renderToast = (item: ScanFeedback) => {
    const tone = FEEDBACK_TONE[item.kind];
    const icon = FEEDBACK_ICON[item.kind];
    if (item.kind === "assigned") {
      const place = placeOf(item.entry.order);
      const name = item.entry.order?.customer?.name ?? t("entry.orderNoun");
      return (
        <CameraToast
          key={item.key}
          tone={tone}
          icon={icon}
          title={t("toast.assignedTitle", { number: numberOf(item.entry.order) })}
          text={place ? `${name} · ${place}` : name}
        />
      );
    }
    if (item.kind === "already" || item.kind === "repeat") {
      return (
        <CameraToast
          key={item.key}
          tone={tone}
          icon={icon}
          title={t(item.kind === "already" ? "toast.alreadyTitle" : "toast.repeatTitle")}
          text={titleOf(item.entry.order)}
        />
      );
    }
    if (item.kind === "failed") {
      return (
        <CameraToast key={item.key} tone={tone} icon={icon} title={errorText(item.entry.error)} text={t("toast.failedText")} />
      );
    }
    return <CameraToast key={item.key} tone={tone} icon={icon} title={t("toast.invalidTitle")} text={t("toast.invalidText")} />;
  };

  // Ramka belgisi — xabar bilan bir xil ikonka (maket: topildi ✓, yaroqsiz ⦸).
  const FlashIcon = flash && feedback ? FEEDBACK_ICON[feedback.kind] : null;
  const latest = entries[0];
  const lastScan =
    pendingCount > 0 ? (
      <CameraLastScan icon={<Spinner />} title={t("last.pendingTitle")} subtitle={t("last.pendingText")} />
    ) : latest ? (
      latest.status === "failed" ? (
        <CameraLastScan icon={<X aria-hidden="true" size={18} />} tone="error" title={errorText(latest.error)} subtitle={statusOf(latest)} />
      ) : (
        <CameraLastScan
          icon={latest.status === "assigned" ? <Check aria-hidden="true" size={18} /> : <Info aria-hidden="true" size={18} />}
          tone={latest.status === "assigned" ? "success" : "info"}
          title={titleOf(latest.order)}
          subtitle={[statusOf(latest), placeOf(latest.order)].filter(Boolean).join(" · ")}
        />
      )
    ) : (
      <CameraLastScan icon={<History aria-hidden="true" size={18} />} title={t("last.emptyTitle")} subtitle={t("last.emptyText")} />
    );

  const stage = (() => {
    if (finish.status === "error") {
      const message = errorText(finish.error);
      return (
        <CameraCard
          tone="error"
          icon={TriangleAlert}
          title={t("done.errorTitle")}
          text={t("done.errorText", { message: /[.!?]$/u.test(message) ? message : `${message}.` })}
          actions={
            <>
              <Button size="lg" leftIcon={RefreshCw} onClick={() => void handleDone()}>
                {t("action.retry")}
              </Button>
              <Button variant="secondary" size="lg" onClick={() => closeTelegramWebApp(webApp)}>
                {t("action.close")}
              </Button>
              <Button variant="ghost" size="lg" leftIcon={ScanLine} onClick={backToScanning}>
                {t("done.backToScan")}
              </Button>
            </>
          }
        />
      );
    }
    if (finish.status === "sending") {
      return (
        <>
          <CameraStatus>
            <CameraChip dot="info">{t("chip.sending")}</CameraChip>
          </CameraStatus>
          <ScanFinder paused mark={<Spinner size="lg" />} />
          <CameraHint live>{t("hint.sending")}</CameraHint>
        </>
      );
    }
    if (cameraFailed) {
      return (
        <CameraCard
          tone="error"
          icon={CameraOff}
          title={t("fallback.cameraTitle")}
          text={popupAvailable ? t("fallback.cameraTextPopup") : t("fallback.cameraText")}
          actions={
            popupAvailable || !camera.cameraUnavailable ? (
              <>
                {popupAvailable ? (
                  <Button variant="secondary" size="lg" leftIcon={ScanQrCode} onClick={openTelegramScanner}>
                    {t("fallback.telegramScanner")}
                  </Button>
                ) : null}
                {!camera.cameraUnavailable ? (
                  <Button variant={popupAvailable ? "ghost" : "secondary"} size="lg" leftIcon={RefreshCw} onClick={retryCamera}>
                    {t("action.retry")}
                  </Button>
                ) : null}
              </>
            ) : undefined
          }
        />
      );
    }
    return (
      <>
        <CameraStatus>
          {starting ? (
            <CameraChip dot="info">{t("chip.starting")}</CameraChip>
          ) : (
            <CameraChip dot="live">{flash === "success" ? t("chip.found") : t("chip.live")}</CameraChip>
          )}
          {camera.torchEnabled ? <CameraChip icon={Flashlight}>{t("chip.torchOn")}</CameraChip> : null}
        </CameraStatus>
        <ScanFinder
          tone={starting ? null : flash}
          paused={starting}
          mark={
            starting ? (
              <Spinner size="lg" />
            ) : FlashIcon ? (
              <FlashIcon aria-hidden="true" focusable="false" size={24} strokeWidth={2.5} />
            ) : null
          }
        />
        {starting ? <CameraHint live>{t("hint.starting")}</CameraHint> : !feedback ? <CameraHint>{t("hint.aim")}</CameraHint> : null}
      </>
    );
  })();

  const surfaceLabel = finish.status === "error" ? t("done.errorTitle") : cameraFailed ? t("fallback.cameraTitle") : starting ? t("chip.starting") : t("surfaceLabel");

  return (
    <>
      <CameraSurface
        label={surfaceLabel}
        busy={finish.status === "sending" || starting}
        title={t("title")}
        context={t("context")}
        tools={
          camera.hasTorch && !finishing && !cameraFailed ? (
            <CameraButton
              icon={Flashlight}
              label={t("torch")}
              aria-pressed={camera.torchEnabled}
              onClick={() => void camera.toggleTorch()}
            />
          ) : null
        }
        feed={
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            aria-hidden="true"
            onPlaying={() => setFeedLive(true)}
            className={cx("absolute inset-0 z-0 size-full object-cover", (cameraFailed || finishing) && "opacity-0")}
          />
        }
        bottom={
          finish.status === "error" ? null : (
            <CameraBottom>
              <div className="flex min-w-0 items-center gap-3">
                <p className="flex min-w-0 flex-1 items-baseline gap-1.5">
                  <span data-testid="tg-scan-count" className="text-[28px] leading-8 font-bold tracking-[-0.01em]">
                    {acceptedOrderIds.length}
                  </span>{" "}
                  <span className="min-w-0 truncate text-[13px] leading-[18px] text-text/75">{t("meter.label")}</span>
                </p>
                {entries.length > 0 ? (
                  <Button variant="ghost" size="sm" leftIcon={List} aria-haspopup="dialog" onClick={() => setListOpen(true)}>
                    {t("list.open")}
                  </Button>
                ) : null}
              </div>
              {lastScan}
              <Button
                size="lg"
                fullWidth
                leftIcon={Check}
                loading={finish.status === "sending"}
                loadingText={t("done.sending")}
                onClick={() => void handleDone()}
              >
                {t("done.action")}
              </Button>
            </CameraBottom>
          )
        }
      >
        {stage}
        {finish.status === "idle" ? <CameraToasts>{feedback ? renderToast(feedback) : null}</CameraToasts> : null}
      </CameraSurface>
      <ScanListSheet
        open={listOpen}
        entries={entries}
        acceptedCount={acceptedOrderIds.length}
        onClose={() => setListOpen(false)}
        onDone={() => void handleDone()}
        doneLoading={finish.status === "sending"}
      />
    </>
  );
};
