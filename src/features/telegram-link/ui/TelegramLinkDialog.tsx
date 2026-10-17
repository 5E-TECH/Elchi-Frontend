// dizayn-v2: (maket yo'q) common-profile
import { Clock, ExternalLink, RefreshCw, Send } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatTimeLocalized } from "../../../shared/lib/formatDateTime";
import { Button, Dialog, EmptyState, Skeleton, buttonClasses } from "../../../shared/ui/primitives";
import { useQrImage } from "../lib/useQrImage";
import type { TelegramLinkCode } from "../model/types";

/** QR tomoni (px): kompyuterda 192 (`size-48`), telefonda 176 (`max-md:size-44`) — kamera bemalol o'qiydi. */
const QR_PX = 192;

const STEP_KEYS = ["step1", "step2", "step3"] as const;

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

/**
 * «Telegram'ni ulash» oynasi: `deep_link` QR'i, «Telegram'da ochish» (asosiy amal), qisqa qadamlar va havola
 * muddati. Muddat tugasa — «Havola eskirdi» va «Yangi havola olish». Telefonda o'zi pastki varaqa (`Dialog`).
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
  const qrSrc = useQrImage(expired ? null : code.deepLink);

  const footer = (
    <>
      <Button variant="secondary" disabled={renewing} onClick={onClose}>
        {t("close")}
      </Button>
      {expired ? (
        <Button leftIcon={RefreshCw} loading={renewing} onClick={onRenew}>
          {t("renew")}
        </Button>
      ) : code.deepLink ? (
        <a
          href={code.deepLink}
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
      {expired ? (
        <EmptyState
          size="chart"
          icon={Clock}
          title={t("expiredTitle")}
          description={t("expiredText")}
        />
      ) : (
        <>
          {code.deepLink ? (
            <div className="flex flex-col items-center gap-3">
              {qrSrc ? (
                <img
                  src={qrSrc}
                  alt={t("qrAlt")}
                  width={QR_PX}
                  height={QR_PX}
                  className="size-48 rounded-xl border border-border max-md:size-44"
                />
              ) : (
                <Skeleton shape="block" className="size-48 rounded-xl max-md:size-44" />
              )}
              <p className="m-0 inline-flex items-center gap-1.5 text-[13px] leading-[18px] text-text-muted">
                <Clock aria-hidden="true" size={16} strokeWidth={2} className="shrink-0" />
                {t("expiresAt", { time: formatTimeLocalized(expiresAtMs) })}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 rounded-xl bg-sunken p-4">
              <p className="m-0 text-[13px] leading-[18px] text-text-muted">{t("commandHint")}</p>
              <code className="break-all font-mono text-sm font-semibold text-text select-all">
                {code.command}
              </code>
              <p className="m-0 text-[13px] leading-[18px] text-text-muted">
                {t("expiresAt", { time: formatTimeLocalized(expiresAtMs) })}
              </p>
            </div>
          )}
          <ol aria-label={t("stepsLabel")} className="m-0 flex list-none flex-col gap-2.5 p-0">
            {STEP_KEYS.map((key, index) => (
              <li key={key} className="flex items-start gap-2.5 text-sm text-text">
                <span className="inline-flex size-[22px] flex-none items-center justify-center rounded-full bg-sunken text-xs font-bold text-text-muted">
                  {index + 1}
                </span>
                <span className="min-w-0 pt-px">{t(key)}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </Dialog>
  );
};
