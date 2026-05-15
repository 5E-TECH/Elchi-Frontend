import { memo, useRef } from "react";
import { CameraOff } from "lucide-react";
import Popup from "../ui/Popup";
import { useCameraQrScanner } from "../lib/useCameraQrScanner";

type ScannerCameraModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onDecode: (value: string) => void;
  title: string;
  subtitle: string;
  waitingText: string;
  closeLabel: string;
  torchOnLabel: string;
  torchOffLabel: string;
  invalidQrMessage: string;
  loading?: boolean;
  loadingText?: string;
  error?: string;
};

const ScannerCameraModal = ({
  isOpen,
  onClose,
  onDecode,
  title,
  subtitle,
  waitingText,
  closeLabel,
  torchOnLabel,
  torchOffLabel,
  invalidQrMessage,
  loading = false,
  loadingText,
  error,
}: ScannerCameraModalProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const {
    torchEnabled,
    hasTorch,
    cameraError,
    stopScanner,
    toggleTorch,
  } = useCameraQrScanner({
    isActive: isOpen,
    videoRef,
    onDecode,
    startErrorMessage: invalidQrMessage,
  });

  const handleClose = () => {
    stopScanner();
    onClose();
  };

  const shownError = error || cameraError;

  return (
    <Popup isShow={isOpen} onClose={handleClose}>
      <section className="w-[92vw] max-w-5xl overflow-hidden rounded-[28px] border border-[color:var(--color-border-soft)] bg-primary shadow-[0_30px_70px_rgba(0,0,0,0.28)] dark:border-white/10 dark:bg-primarydark">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--color-border-soft)] px-5 py-4 dark:border-white/10">
          <div>
            <h3 className="m-0 text-xl font-extrabold text-maindark dark:text-white">
              {title}
            </h3>
            <p className="m-0 mt-1 text-sm text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
              {subtitle}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasTorch ? (
              <button
                type="button"
                onClick={() => void toggleTorch()}
                className="cursor-pointer rounded-2xl border border-[color:var(--color-border-soft)] px-4 py-2 text-sm font-semibold text-maindark transition hover:border-main/40 hover:text-main dark:border-white/10 dark:text-white"
              >
                {torchEnabled ? torchOffLabel : torchOnLabel}
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleClose}
              className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-white/80 px-4 py-2 text-sm font-extrabold text-maindark transition hover:bg-white dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
              aria-label={closeLabel}
            >
              <CameraOff size={16} />
              {closeLabel}
            </button>
          </div>
        </div>

        <div className="p-5">
          <div className="relative overflow-hidden rounded-[28px] border border-[color:var(--color-border-soft)] bg-maindark dark:border-white/10">
            <div className="relative aspect-[16/9] max-h-[68vh]">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="h-full w-full object-cover opacity-95"
              />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="relative h-[58%] w-[68%] max-w-[440px] rounded-[34px] border border-white/10 bg-white/[0.04] shadow-[0_0_0_9999px_rgba(7,10,24,0.34)]">
                  <div className="absolute left-0 top-0 h-14 w-14 rounded-tl-[30px] border-l-4 border-t-4 border-[#7c8cff]" />
                  <div className="absolute right-0 top-0 h-14 w-14 rounded-tr-[30px] border-r-4 border-t-4 border-[#7c8cff]" />
                  <div className="absolute bottom-0 left-0 h-14 w-14 rounded-bl-[30px] border-b-4 border-l-4 border-[#7c8cff]" />
                  <div className="absolute bottom-0 right-0 h-14 w-14 rounded-br-[30px] border-b-4 border-r-4 border-[#7c8cff]" />
                  <div
                    className="absolute left-[8%] right-[8%] h-[2px] -translate-y-1/2 bg-[linear-gradient(90deg,transparent,rgba(124,140,255,0.98),transparent)] shadow-[0_0_24px_rgba(124,140,255,0.78)]"
                    style={{ animation: "scanner-scan-line-y 2.2s ease-in-out infinite alternate" }}
                  />
                  <div
                    className="absolute left-[14%] right-[14%] h-10 -translate-y-1/2 bg-[radial-gradient(circle,rgba(124,140,255,0.18),transparent_72%)] blur-md"
                    style={{ animation: "scanner-scan-line-y 2.2s ease-in-out infinite alternate" }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-[color:var(--color-border-soft)] bg-white/70 px-4 py-4 text-sm font-semibold text-[color:var(--color-text-muted)] dark:border-white/10 dark:bg-white/[0.04] dark:text-[color:var(--color-text-muted-dark)]">
            {waitingText}
          </div>

          {loading ? (
            <div className="mt-4 rounded-2xl border border-main/20 bg-main/10 px-4 py-3 text-sm font-semibold text-main dark:text-white">
              {loadingText}
            </div>
          ) : null}

          {shownError ? (
            <div className="mt-4 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-600 dark:text-red-100">
              {shownError}
            </div>
          ) : null}
        </div>
      </section>
    </Popup>
  );
};

export default memo(ScannerCameraModal);
