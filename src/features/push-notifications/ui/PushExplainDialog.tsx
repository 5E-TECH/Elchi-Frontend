// dizayn-v2: superadmin-notifications-push-explain-dialog, courier-inbox-push-explain-dialog
import { BellRing, Info } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { Button, Dialog } from "../../../shared/ui/primitives";

type PushExplainDialogProps = {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  /** «Yoqish» — brauzer ruxsat oynasi shu bosish (user gesture) ichida ochiladi. */
  onConfirm: () => void;
};

/**
 * «BILDIRISHNOMALARNI YOQASIZMI?» — brauzer oynasidan OLDIN bizning tushuntirish (maketlar
 * `superadmin-notifications-push-explain-dialog`, `courier-inbox-push-explain-dialog`; telefonda pastki varaqa).
 * Ikonka — `info` doira, pastda «Keyingi qadamda brauzer ruxsat so'raydi…» bloki, amallar «Hozir emas» / «Yoqish».
 */
export const PushExplainDialog = ({ open, busy, onClose, onConfirm }: PushExplainDialogProps) => {
  const { t } = useTranslation("notifications");
  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={busy}
      size="sm"
      icon={BellRing}
      iconTone="info"
      iconShape="circle"
      title={t("push.explainTitle")}
      description={t("push.explainBody")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t("push.explainCancel")}
          </Button>
          <Button leftIcon={BellRing} loading={busy} onClick={onConfirm}>
            {t("push.explainConfirm")}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3 rounded-xl bg-sunken px-4 py-3">
        <Info size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-info-fg" />
        <p className="min-w-0 text-[13px] text-text">
          <Trans
            t={t}
            i18nKey="push.explainNext"
            components={{ b: <span className="font-semibold" /> }}
          />
        </p>
      </div>
    </Dialog>
  );
};
