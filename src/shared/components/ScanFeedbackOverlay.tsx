// dizayn-v2: (maket yo'q) tizim-scanner
import { memo, useEffect, useRef, useState } from "react";
import { Check, SearchCheck, SearchX, X, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../lib/cx";
import { SCAN_FEEDBACK_EVENT, type ScanFeedbackDetail, type ScanFeedbackType } from "../lib/scanner/feedback";
import { isScannerCameraMounted } from "../lib/scanner/scannerHost";
import { Portal, TONE_SOLID, type Tone } from "../ui/primitives";

const feedbackConfig: Record<
  ScanFeedbackType,
  {
    icon: LucideIcon;
    labelKey: "scannerFeedbackSuccess" | "scannerFeedbackError" | "scannerFeedbackMissing" | "scannerFeedbackDuplicate";
    tone: Tone;
  }
> = {
  success: { icon: Check, labelKey: "scannerFeedbackSuccess", tone: "success" },
  error: { icon: X, labelKey: "scannerFeedbackError", tone: "danger" },
  missing: { icon: SearchX, labelKey: "scannerFeedbackMissing", tone: "danger" },
  duplicate: { icon: SearchCheck, labelKey: "scannerFeedbackDuplicate", tone: "warning" },
};

/**
 * USB skan natijasi — ekran markazidagi qisqa xabar (ilova darajasida bir marta, `app/lib/provider.tsx`).
 * Maket yo'q — eng yaqini taxta `tizim-scanner` §07 (ovoz / tebranish jadvali) va §03 «Natija xabari»:
 * tonli ikonka (rang doim ikonka va matn bilan birga) + qalin matn, `raised` yuza ustida; ostidagi sahifa
 * `overlay` bilan xiralashadi. Muvaffaqiyat 0,9 s, qolgani 1,35 s.
 *
 * Kamera ochiq bo'lsa (`ScannerCamera` — universal `/scan` yoki oqim ustidagi oyna) bu xabar chiqmaydi: natija
 * kamera ichidagi xabarda ko'rinadi, ustma-ust ikkinchisi bo'lmaydi.
 *
 * Qatlam (skaner 2-bosqich): o'zboshimcha `z-[10050]` va `document.body` portali o'rniga umumiy `Portal` ning
 * `toast` qatlami (taxta `tizim-motion` §08: xabar bosishni to'smaydi, fokusni olmaydi, oyna ochiq turganda ham
 * ko'rinadi — `inert` uni chetlab o'tadi). Matn — skan natijasi (`playScanFeedback(type, message)`).
 */
const ScanFeedbackOverlay = () => {
  const { t } = useTranslation("common");
  const [feedback, setFeedback] = useState<(ScanFeedbackDetail & { id: number }) | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleFeedback = (event: Event) => {
      const detail = (event as CustomEvent<ScanFeedbackDetail>).detail;
      if (!detail?.type) return;
      if (isScannerCameraMounted()) return;

      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      setFeedback({ ...detail, id: Date.now() });
      hideTimerRef.current = setTimeout(() => setFeedback(null), detail.type === "success" ? 900 : 1350);
    };

    window.addEventListener(SCAN_FEEDBACK_EVENT, handleFeedback);
    return () => {
      window.removeEventListener(SCAN_FEEDBACK_EVENT, handleFeedback);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  if (!feedback) return null;

  const config = feedbackConfig[feedback.type];
  const Icon = config.icon;

  return (
    <Portal layer="toast">
      <div
        key={feedback.id}
        role="status"
        aria-live="assertive"
        className="pointer-events-none fixed inset-0 flex items-center justify-center bg-overlay px-5 animate-[scan-feedback-backdrop_180ms_ease-out] motion-reduce:animate-none"
      >
        <div className="flex max-w-[min(90vw,420px)] flex-col items-center gap-4 rounded-[20px] border border-border bg-raised px-8 py-7 text-center shadow-xl animate-[scan-feedback-pop_420ms_cubic-bezier(0.16,1,0.3,1)] motion-reduce:animate-none">
          <span
            aria-hidden="true"
            className={cx("inline-flex size-[clamp(88px,14vw,128px)] items-center justify-center rounded-full", TONE_SOLID[config.tone])}
          >
            <Icon className="size-[48%]" strokeWidth={3} />
          </span>
          <h2 className="text-[clamp(22px,3.4vw,32px)] leading-tight font-bold tracking-[-.01em] [overflow-wrap:anywhere] text-text">
            {feedback.message ?? t(config.labelKey)}
          </h2>
        </div>
      </div>
    </Portal>
  );
};

export default memo(ScanFeedbackOverlay);
