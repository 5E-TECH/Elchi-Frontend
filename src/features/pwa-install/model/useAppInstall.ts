import { useCallback, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { notify } from "../../../shared/lib/notify";
import {
  getInstallSnapshot,
  promptInstall,
  subscribeInstall,
  type AppInstallStatus,
  type InstallOutcome,
} from "../lib/installPrompt";

const serverSnapshot = (): AppInstallStatus => "unsupported";

/** Faqat holat (`installed | installable | ios | unsupported`) — brauzer hodisalari bilan yangilanadi. */
export const useAppInstallStatus = (): AppInstallStatus =>
  useSyncExternalStore(subscribeInstall, getInstallSnapshot, serverSnapshot);

/**
 * `useAppInstall()` — holat + amallar bitta joyda:
 *  - `install()` — `installable` da brauzer oynasi; oyna ochilmasa (foydalanuvchi uni oldinroq yopgan) — brauzer
 *    menyusidan o'rnatish yo'riqnomasi (`notify.info`);
 *  - `ios` da tugma yo'riqnoma oynasini ochadi (`iosOpen` / `openIos` / `closeIos`).
 */
export const useAppInstall = () => {
  const { t } = useTranslation("pwaInstall");
  const status = useAppInstallStatus();
  const [busy, setBusy] = useState(false);
  const [iosOpen, setIosOpen] = useState(false);

  const install = useCallback(async (): Promise<InstallOutcome> => {
    setBusy(true);
    try {
      const outcome = await promptInstall();
      if (outcome === "unavailable") {
        notify.info(t("menuHint.title"), { description: t("menuHint.body") });
      }
      return outcome;
    } finally {
      setBusy(false);
    }
  }, [t]);

  return {
    status,
    busy,
    install,
    iosOpen,
    openIos: () => setIosOpen(true),
    closeIos: () => setIosOpen(false),
  };
};

export type AppInstallControl = ReturnType<typeof useAppInstall>;
