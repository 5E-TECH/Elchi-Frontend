// dizayn-v2: common-settings-notifications-pwa
import { useId } from "react";
import { Download, SquarePlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge, Button } from "../../../shared/ui/primitives";
import type { AppInstallStatus } from "../lib/installPrompt";
import { useAppInstall } from "../model/useAppInstall";
import { AppMark } from "./AppMark";
import { IosInstallDialog } from "./IosInstallDialog";

const BADGE: Record<AppInstallStatus, { tone: "success" | "neutral"; key: string }> = {
  installed: { tone: "success", key: "status.installed" },
  installable: { tone: "neutral", key: "status.notInstalled" },
  ios: { tone: "neutral", key: "status.notInstalled" },
  unsupported: { tone: "neutral", key: "status.unsupported" },
};

/**
 * Sozlamalar → Bildirishnomalar → «Ilova» kartasining holat bloki (maket `common-settings-notifications-pwa`,
 * `sunken` fon): «Elchi ilovasi» + holat badge'i va izoh — 4 holat, ega javobi KI-S3 («Sozlamalarda doim»):
 *  - `installed` — «O'rnatilgan» (yashil), tugmasiz;
 *  - `installable` — «O'rnatilmagan» + «O'rnatish» (brauzer oynasi);
 *  - `ios` — «O'rnatilmagan» + «Qanday qo'shiladi» (yo'riqnoma oynasi);
 *  - `unsupported` — «Qo'llab-quvvatlanmaydi», tugmasiz.
 * Kartaning sarlavhasi va izohi sahifada (`NotificationsPanel`).
 */
export const AppInstallStatusBlock = () => {
  const { t } = useTranslation("pwaInstall");
  const titleId = useId();
  const { status, busy, install, iosOpen, openIos, closeIos } = useAppInstall();
  const badge = BADGE[status];

  return (
    <div
      data-testid="pwa-install-status"
      data-status={status}
      className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl bg-sunken p-4"
    >
      <AppMark size="md" />
      <span className="flex min-w-0 flex-[1_1_200px] flex-col gap-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span id={titleId} className="text-sm font-semibold text-text">
            {t("status.appName")}
          </span>
          <Badge tone={badge.tone} dot>
            {t(badge.key)}
          </Badge>
        </span>
        <span className="text-[13px] text-text-muted">{t(`status.hint.${status}`)}</span>
      </span>
      {status === "installable" ? (
        <Button
          variant="secondary"
          leftIcon={Download}
          loading={busy}
          aria-describedby={titleId}
          onClick={() => void install()}
          className="shrink-0 max-md:w-full"
        >
          {t("install")}
        </Button>
      ) : null}
      {status === "ios" ? (
        <Button
          variant="secondary"
          leftIcon={SquarePlus}
          aria-haspopup="dialog"
          onClick={openIos}
          className="shrink-0 max-md:w-full"
        >
          {t("howTo")}
        </Button>
      ) : null}
      {status === "ios" ? <IosInstallDialog open={iosOpen} onClose={closeIos} /> : null}
    </div>
  );
};
