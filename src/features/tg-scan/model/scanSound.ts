import { useCallback, useEffect } from "react";
import {
  writeStoredScannerErrorSound,
  writeStoredScannerFeedbackPrefs,
  writeStoredScannerSuccessSound,
} from "../../../shared/lib/preferencesStorage";
import { playScanSignal, type ScanFeedbackType } from "../../../shared/lib/scanner/feedback";
import { fetchScannerSoundPrefs } from "../api/tgScanApi";
import type { ScanFeedback } from "./useScanAssign";

/** Natija → ovoz turi (asosiy ilovadagi kuryer «O'zimga olish» bilan bir xil — `pages/scan/model/useCourierTake`). */
const SOUND_OF: Record<ScanFeedback["kind"], ScanFeedbackType> = {
  assigned: "success",
  already: "duplicate",
  repeat: "duplicate",
  failed: "error",
  invalid: "error",
};

/**
 * JX0EBpa7: Mini App skanida ham asosiy ilovadagi ovoz (USB va kamera bilan bir xil `playScanSignal`). Hisobdagi
 * tanlov va «Ovoz» kaliti bir marta o'qilib qurilma ko'zgusiga yoziladi; so'rov o'tmasa — qurilmadagi qiymat
 * (sukut: `classic`, ovoz yoqiq). Tebranish avvalgidek Telegram `HapticFeedback` da — bu yerda faqat ovoz.
 */
export const useTgScanSound = (accessToken: string) => {
  useEffect(() => {
    let active = true;
    fetchScannerSoundPrefs(accessToken)
      .then((prefs) => {
        if (!active) return;
        if (prefs.success) writeStoredScannerSuccessSound(prefs.success);
        if (prefs.error) writeStoredScannerErrorSound(prefs.error);
        if (prefs.sound !== null) writeStoredScannerFeedbackPrefs({ sound: prefs.sound });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [accessToken]);

  return useCallback(
    (feedback: ScanFeedback) => playScanSignal(SOUND_OF[feedback.kind], { vibrate: false }),
    [],
  );
};
