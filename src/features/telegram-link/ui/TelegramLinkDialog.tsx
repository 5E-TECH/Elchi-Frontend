// dizayn-v2: common-profile-telegram-link-dialog, common-profile-telegram-command-dialog, common-profile-telegram-expired-dialog
import { Clock, ExternalLink, RefreshCw, Send } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatTimeLocalized } from "../../../shared/lib/formatDateTime";
import { Button, Dialog, EmptyState, Spinner, buttonClasses } from "../../../shared/ui/primitives";
import { useIsPhone } from "../../../shared/ui/primitives/date/useIsPhone";
import type { TelegramLinkCode } from "../model/types";
import { LinkCountdown } from "./LinkCountdown";
import { LinkQrPanel } from "./LinkQrPanel";

/** Qadamlar: kompyuterda QR bilan, telefonda — havolani shu telefonda ochish, buyruq rejimida — nusxalash. */
const STEPS = {
  desktop: ["step1", "step2", "step3"],
  phone: ["phoneStep1", "step2", "phoneStep3"],
  command: ["commandStep1", "commandStep2", "step3"],
} as const;

type StepsMode = keyof typeof STEPS;

export type TelegramLinkDialogProps = {
  open: boolean;
  code: TelegramLinkCode;
  /** Havola amal qiladigan oxirgi lahza (ms, mahalliy soat bo'yicha). */
  expiresAtMs: number;
  expired: boolean;
  renewing: boolean;
  onRenew: () => void;
  onClose: () => void;
};

const Steps = ({ mode }: { mode: StepsMode }) => {
  const { t } = useTranslation("telegramLink");
  return (
    <ol aria-label={t("stepsLabel")} className="m-0 flex list-none flex-col gap-2.5 p-0">
      {STEPS[mode].map((key, index) => (
        <li key={key} className="flex items-start gap-2.5 text-sm text-text">
          <span
            aria-hidden="true"
            className="inline-flex size-6 flex-none items-center justify-center rounded-full bg-sunken text-xs font-bold text-text-muted"
          >
            {index + 1}
          </span>
          <span className="min-w-0 pt-0.5">{t(key)}</span>
        </li>
      ))}
    </ol>
  );
};

/**
 * «Telegram'ni ulash» oynasi (maketlar `common-profile-telegram-{link,command,expired}-dialog`):
 * - havola bor: kompyuter/planshetda QR ramkada → muddat sanog'i → qadamlar; telefonda sanoq → «Telegram'da
 *   ochish» qadamlari → «Boshqa telefondan — QR kod» (yig'ilgan). Pastda «Ulanish kutilmoqda…», asosiy amal —
 *   «Telegram'da ochish»;
 * - buyruq rejimi (`deep_link` yo'q — bot nomi sozlanmagan): buyruq, muddat (sanoqsiz), o'z qadamlari, faqat «Yopish»;
 * - muddati tugadi: `sunken` ichida bo'sh holat va «Yangi havola olish».
 * Telefonda o'zi pastki varaqa (`Dialog`).
 */
export const TelegramLinkDialog = ({
  open,
  code,
  expiresAtMs,
  expired,
  renewing,
  onRenew,
  onClose,
}: TelegramLinkDialogProps) => {
  const { t } = useTranslation("telegramLink");
  const isPhone = useIsPhone();
  const deepLink = code.deepLink;

  const footer = (
    <>
      <Button variant="secondary" disabled={renewing} onClick={onClose}>
        {t("close")}
      </Button>
      {expired ? (
        <Button leftIcon={RefreshCw} loading={renewing} onClick={onRenew}>
          {t("renew")}
        </Button>
      ) : deepLink ? (
        <a
          href={deepLink}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClasses({ variant: "primary" })}
        >
          <ExternalLink aria-hidden="true" size={18} strokeWidth={2} className="shrink-0" />
          <span className="min-w-0 truncate">{t("open")}</span>
        </a>
      ) : null}
    </>
  );

  const body = expired ? (
    <EmptyState
      size="chart"
      role="status"
      icon={Clock}
      title={t("expiredTitle")}
      description={t("expiredText")}
      className="px-2 [&_[data-state-icon]]:bg-surface"
    />
  ) : (
    <>
      {deepLink ? (
        isPhone ? (
          <>
            <LinkCountdown expiresAtMs={expiresAtMs} />
            <Steps mode="phone" />
            <LinkQrPanel collapsible value={deepLink} alt={t("qrAlt")} />
          </>
        ) : (
          <>
            <LinkQrPanel value={deepLink} alt={t("qrAlt")} />
            <LinkCountdown expiresAtMs={expiresAtMs} />
            <Steps mode="desktop" />
          </>
        )
      ) : (
        <>
          <div className="flex flex-col gap-2 rounded-[14px] bg-sunken p-4">
            <p className="m-0 text-[13px] leading-[18px] text-text-muted">{t("commandHint")}</p>
            <code className="break-all font-mono text-sm font-semibold text-text select-all">{code.command}</code>
            <p className="m-0 text-[13px] leading-[18px] text-text-muted">
              {t("expiresAt", { time: formatTimeLocalized(expiresAtMs) })}
            </p>
          </div>
          <Steps mode="command" />
        </>
      )}
      <p role="status" className="m-0 flex items-center gap-2 text-[13px] leading-[18px] font-semibold text-text-muted">
        <Spinner size="sm" />
        {t("waiting")}
      </p>
    </>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={renewing}
      size="md"
      icon={Send}
      title={t("dialogTitle")}
      description={t("dialogDescription")}
      footer={footer}
    >
      {body}
    </Dialog>
  );
};
