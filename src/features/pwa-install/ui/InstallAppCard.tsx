// dizayn-v2: courier-inbox-pwa-install, courier-dashboard-pwa-install
import { useId, useState } from "react";
import { Download, SquarePlus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import { Button, Card, IconButton } from "../../../shared/ui/primitives";
import { readDashboardDismissed, writeDashboardDismissed } from "../lib/dismissal";
import { focusPageHeading } from "../lib/focus";
import { useAppInstall } from "../model/useAppInstall";
import { AppMark } from "./AppMark";
import { IosInstallDialog } from "./IosInstallDialog";

export type InstallAppCardPlacement = "inbox" | "dashboard";

/**
 * «ELCHI'NI ILOVA SIFATIDA O'RNATING» — taklif kartasi (maketlar `courier-inbox-pwa-install`,
 * `courier-dashboard-pwa-install`; iOS varianti — `courier-inbox-pwa-ios-dialog` fonidagi karta).
 *
 * Faqat ilova o'rnatilmagan va o'rnatish mumkin bo'lsa chiziladi (`installable` — «O'rnatish», brauzer oynasi;
 * `ios` — «Qanday qo'shiladi», yo'riqnoma oynasi). `installed` va `unsupported` da — hech narsa (holat faqat
 * Sozlamalar → Bildirishnomalar → «Ilova» kartasida).
 *
 * Joylari (ega javobi KI-S3): `/inbox` — doim, yopishsiz; kuryer bosh sahifasi (`placement="dashboard"`) — bir marta,
 * «Taklifni yopish» bilan (shu qurilmada localStorage, izohda «taklif Sozlamalar va Bildirishnomalarda qoladi»).
 */
export const InstallAppCard = ({ placement }: { placement: InstallAppCardPlacement }) => {
  const { t } = useTranslation("pwaInstall");
  const titleId = useId();
  const { status, busy, install, iosOpen, openIos, closeIos } = useAppInstall();
  const dismissible = placement === "dashboard";
  const [dismissed, setDismissed] = useState(() => dismissible && readDashboardDismissed());

  if (dismissed || (status !== "installable" && status !== "ios")) return null;

  const isIos = status === "ios";
  const dismiss = () => {
    writeDashboardDismissed();
    setDismissed(true);
    // Karta (va fokusdagi X) yo'qoladi — fokus sahifa sarlavhasiga.
    focusPageHeading();
  };
  const onInstall = async () => {
    // Qabul qilinsa holat `installed` — karta yo'qoladi, fokus sarlavhaga o'tadi.
    if ((await install()) === "accepted") focusPageHeading();
  };

  return (
    <>
      <Card
        padding="none"
        aria-labelledby={titleId}
        data-testid={`pwa-install-card-${placement}`}
        bodyClassName="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4 max-md:px-4"
      >
        <AppMark size="lg" />
        <div className="flex min-w-0 flex-[100_1_240px] flex-col gap-0.5">
          <h2 id={titleId} className="text-sm font-semibold text-text">
            {isIos ? t("card.iosTitle") : t("card.title")}
          </h2>
          {isIos ? (
            <p className="text-[13px] text-text-muted">
              {dismissible ? t("card.iosBodyDashboard") : t("card.iosBody")}
            </p>
          ) : (
            <>
              <p className="text-[13px] text-text-muted max-md:hidden">{t(`card.${placement}.desktop`)}</p>
              <p className="text-[13px] text-text-muted md:hidden">{t(`card.${placement}.phone`)}</p>
            </>
          )}
        </div>
        {/* Telefonda tugma kenglikni faqat bosh sahifa kartasida egallaydi (yonida X — maket
            `courier-dashboard-pwa-install`); `/inbox` da — o'z kengligida, o'ngda (`courier-inbox-pwa-*`). */}
        <div
          data-testid="pwa-install-card-actions"
          className={cx(
            "ml-auto flex flex-[0_1_auto] items-center gap-2",
            dismissible && "max-md:w-full max-md:flex-[1_1_auto]",
          )}
        >
          {isIos ? (
            <Button
              variant="secondary"
              leftIcon={SquarePlus}
              aria-haspopup="dialog"
              onClick={openIos}
              className={dismissible ? "max-md:flex-1" : undefined}
            >
              {t("howTo")}
            </Button>
          ) : (
            <Button
              variant="secondary"
              leftIcon={Download}
              loading={busy}
              onClick={() => void onInstall()}
              className={dismissible ? "max-md:flex-1" : undefined}
            >
              {t("install")}
            </Button>
          )}
          {dismissible ? (
            <IconButton icon={X} size="lg" label={t("card.dismiss")} onClick={dismiss} />
          ) : null}
        </div>
      </Card>
      {isIos ? <IosInstallDialog open={iosOpen} onClose={closeIos} /> : null}
    </>
  );
};
