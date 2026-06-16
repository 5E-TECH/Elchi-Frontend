import { memo, useEffect, useRef, useState } from "react";
import { Check, SearchX, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  SCAN_FEEDBACK_EVENT,
  type ScanFeedbackDetail,
  type ScanFeedbackType,
} from "../../pages/scan/lib/scanShared";

const feedbackConfig: Record<
  ScanFeedbackType,
  {
    icon: React.ReactNode;
    labelKey: "scannerFeedbackSuccess" | "scannerFeedbackError" | "scannerFeedbackMissing";
    surface: string;
    glow: string;
  }
> = {
  success: {
    icon: <Check className="h-[42%] w-[42%]" strokeWidth={3.5} />,
    labelKey: "scannerFeedbackSuccess",
    surface: "from-emerald-400 to-emerald-600",
    glow: "shadow-[0_0_90px_rgba(16,185,129,0.48)]",
  },
  error: {
    icon: <X className="h-[42%] w-[42%]" strokeWidth={3.5} />,
    labelKey: "scannerFeedbackError",
    surface: "from-red-400 to-red-600",
    glow: "shadow-[0_0_90px_rgba(239,68,68,0.48)]",
  },
  missing: {
    icon: <SearchX className="h-[42%] w-[42%]" strokeWidth={3} />,
    labelKey: "scannerFeedbackMissing",
    surface: "from-amber-400 to-orange-500",
    glow: "shadow-[0_0_90px_rgba(245,158,11,0.48)]",
  },
};

const ScanFeedbackOverlay = () => {
  const { t } = useTranslation("common");
  const [feedback, setFeedback] = useState<(ScanFeedbackDetail & { id: number }) | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleFeedback = (event: Event) => {
      const detail = (event as CustomEvent<ScanFeedbackDetail>).detail;
      if (!detail?.type) return;

      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      setFeedback({ ...detail, id: Date.now() });
      hideTimerRef.current = setTimeout(
        () => setFeedback(null),
        detail.type === "success" ? 900 : 1350,
      );
    };

    window.addEventListener(SCAN_FEEDBACK_EVENT, handleFeedback);
    return () => {
      window.removeEventListener(SCAN_FEEDBACK_EVENT, handleFeedback);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  if (!feedback || typeof document === "undefined") return null;

  const config = feedbackConfig[feedback.type];

  return createPortal(
    <div
      key={feedback.id}
      role="status"
      aria-live="assertive"
      className="pointer-events-none fixed inset-0 z-[10050] flex items-center justify-center bg-[rgba(9,12,25,0.38)] px-5 backdrop-blur-[3px] animate-[scan-feedback-backdrop_180ms_ease-out]"
    >
      <div className="flex max-w-[90vw] flex-col items-center text-center animate-[scan-feedback-pop_420ms_cubic-bezier(0.16,1,0.3,1)]">
        <div
          className={`flex h-[clamp(150px,24vw,260px)] w-[clamp(150px,24vw,260px)] items-center justify-center rounded-[38%] bg-linear-to-br ${config.surface} ${config.glow} text-white ring-[clamp(8px,1.5vw,16px)] ring-white/18`}
        >
          {config.icon}
        </div>
        <h2 className="m-0 mt-7 text-[clamp(28px,5vw,58px)] font-black tracking-tight text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.45)]">
          {feedback.message ?? t(config.labelKey)}
        </h2>
      </div>
    </div>,
    document.body,
  );
};

export default memo(ScanFeedbackOverlay);
