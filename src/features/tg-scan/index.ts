// dizayn-v2: courier-scan-active
export { TgScanner } from "./ui/TgScanner";
export {
  CameraCard,
  CameraChip,
  CameraHint,
  CameraStatus,
  CameraSurface,
  ScanFinder,
} from "./ui/CameraSurface";
export { useTelegramAuth } from "./model/useTelegramAuth";
export type { TelegramAuthState } from "./model/useTelegramAuth";
export { describeTgScanError } from "./model/scanError";
export type { TgScanErrorInfo } from "./model/scanError";
export { closeTelegramWebApp, getTelegramWebApp } from "./model/telegramWebApp";
export type { TelegramWebApp } from "./model/telegramWebApp";
