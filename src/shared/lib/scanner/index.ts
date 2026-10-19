// Skaner infratuzilmasi (1-bosqich, Trello v1eLN2tV): skan maqsadlari reyestri, kontekstli skaner tugmasi
// va natija signali (ovoz, tebranish, `SCAN_FEEDBACK_EVENT`).
export {
  getActiveScanTarget,
  registerScanTarget,
  resetScanTargets,
  subscribeScanTargets,
  unregisterScanTarget,
  updateScanTarget,
  useActiveScanTarget,
  useScanTarget,
} from "./scanTargets";
export type {
  ScanSource,
  ScanTarget,
  ScanTargetLayer,
  ScanTargetListItem,
  ScanTargetMode,
  ScanTargetStat,
  ScanTargetSwitcher,
  ScanTargetSwitcherOption,
  ScanTargetTone,
} from "./scanTargets";
export {
  closeScanner,
  isScannerCameraMounted,
  isScannerOverlayOpen,
  markScannerCameraMounted,
  openScanner,
  registerScannerNavigator,
  resetScannerHost,
  SCANNER_TARGET_SWITCH_GRACE_MS,
  UNIVERSAL_SCANNER_PATH,
  useScannerCameraMounted,
  useScannerOverlayOpen,
} from "./scannerHost";
export type { OpenScannerResult } from "./scannerHost";
export {
  playMissingOrderFeedback,
  playScanFeedback,
  playScanSignal,
  SCAN_FEEDBACK_EVENT,
  SCANNER_SOUND_IDS,
} from "./feedback";
export type { ScanFeedbackDetail, ScanFeedbackType, ScannerSoundId } from "./feedback";
