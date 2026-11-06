import { useCallback, useEffect } from "react";
import {
  writeStoredScannerErrorSound,
  writeStoredScannerFeedbackPrefs,
  writeStoredScannerSuccessSound,
} from "../../../shared/lib/preferencesStorage";
import {
  playScanSignal,
  preloadScanFeedbackAudio,
  type ScanFeedbackType,
  type ScanVoicePhrase,
} from "../../../shared/lib/scanner/feedback";
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

/** «Ovozli xabar»: kuryer buyurtmani o'ziga oldi — «Biriktirildi» (qolganlari tur bo'yicha). */
const VOICE_OF: Partial<Record<ScanFeedback["kind"], ScanVoicePhrase>> = {
  assigned: "assigned",
};

/**
 * JX0EBpa7: Mini App skanida ham asosiy ilovadagi ovoz (USB va kamera bilan bir xil `playScanSignal`). Hisobdagi
 * tanlov, «Ovoz» va «Ovozli xabar» kalitlari bir marta o'qilib qurilma ko'zgusiga yoziladi; so'rov o'tmasa —
 * qurilmadagi qiymat (sukut: `beepost`, ovoz va ovozli xabar yoqiq). Fayllar (BeePost, iboralar) ochilishdayoq
 * oldindan yuklanadi. Tebranish avvalgidek Telegram `HapticFeedback` da — bu yerda faqat ovoz.
 */
export const useTgScanSound = (accessToken: string) => {
  useEffect(() => {
    let active = true;
    preloadScanFeedbackAudio();
    fetchScannerSoundPrefs(accessToken)
      .then((prefs) => {
        if (!active) return;
        if (prefs.success) writeStoredScannerSuccessSound(prefs.success);
        if (prefs.error) writeStoredScannerErrorSound(prefs.error);
        if (prefs.sound !== null) writeStoredScannerFeedbackPrefs({ sound: prefs.sound });
        if (prefs.voice !== null) writeStoredScannerFeedbackPrefs({ voice: prefs.voice });
        // Hisobdagi tanlov boshqa bo'lsa — o'sha fayllar (yuklanganlari qayta so'ralmaydi).
        preloadScanFeedbackAudio();
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [accessToken]);

  return useCallback(
    (feedback: ScanFeedback) => {
      const voice = VOICE_OF[feedback.kind];
      playScanSignal(SOUND_OF[feedback.kind], voice ? { vibrate: false, voice } : { vibrate: false });
    },
    [],
  );
};
