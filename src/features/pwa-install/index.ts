export {
  captureInstallPrompt,
  isIosDevice,
  isStandaloneDisplay,
  type AppInstallStatus,
  type InstallOutcome,
} from "./lib/installPrompt";
export { useAppInstall, useAppInstallStatus } from "./model/useAppInstall";
export type { AppInstallControl } from "./model/useAppInstall";
export { InstallAppCard } from "./ui/InstallAppCard";
export type { InstallAppCardPlacement } from "./ui/InstallAppCard";
export { AppInstallStatusBlock } from "./ui/AppInstallStatusBlock";
export { IosInstallDialog } from "./ui/IosInstallDialog";
