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
  readScannerArrival,
  registerScannerNavigator,
  resetScannerHost,
  SCANNER_ARRIVAL_STATE_KEY,
  SCANNER_ARRIVAL_TIMEOUT_MS,
  SCANNER_TARGET_SWITCH_GRACE_MS,
  scannerArrivalState,
  UNIVERSAL_SCANNER_PATH,
  useScannerCameraMounted,
  useScannerOverlayOpen,
  withoutScannerArrival,
} from "./scannerHost";
export type { OpenScannerResult, ScannerArrival } from "./scannerHost";
export type { ScanFormats } from "./barcodeCodes";
export {
  playScanFeedback,
  playScanSignal,
  SCAN_FEEDBACK_EVENT,
  SCANNER_SOUND_IDS,
} from "./feedback";
export type { ScanFeedbackDetail, ScanFeedbackOptions, ScanFeedbackType, ScannerSoundId } from "./feedback";
export { orderByRecent, scanNotify, useRecentScans } from "./scanSession";
