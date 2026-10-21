// dizayn-v2: courier-inbox-pwa-ios-dialog
import { useId } from "react";
import { Check, Info, Share, SquarePlus, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, Dialog } from "../../../shared/ui/primitives";
import { AppMark } from "./AppMark";

type Step = { key: "share" | "add" | "confirm"; icon: LucideIcon };

const STEPS: readonly Step[] = [
  { key: "share", icon: Share },
  { key: "add", icon: SquarePlus },
  { key: "confirm", icon: Check },
];

/**
 * «BOSH EKRANGA QO'SHING» — iPhone / iPad uchun 3 qadamli yo'riqnoma (maket `courier-inbox-pwa-ios-dialog`; telefonda
 * `Dialog` o'zi pastki varaqa). iOS'da o'rnatish dasturiy chaqirilmaydi — faqat Safari «Ulashish» menyusi orqali.
 * Amallar: «Keyinroq» / «Tushunarli» (ikkalasi ham yopadi — oyna faqat tushuntiradi).
 */
export const IosInstallDialog = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const { t } = useTranslation("pwaInstall");
  const descId = useId();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      icon={<AppMark size="sm" />}
      title={t("ios.title")}
      // Izoh maketdagidek sarlavha ostida, butun kenglikda (14px) — Dialog `description` slotida emas (u ikonka
      // yonidagi ustunda, 13px); nom-izoh bog'lanishi `aria-describedby` orqali saqlanadi.
      aria-describedby={descId}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("ios.later")}
          </Button>
          <Button onClick={onClose}>{t("ios.gotIt")}</Button>
        </>
      }
    >
      <p id={descId} data-testid="pwa-ios-body" className="text-sm text-text-muted">
        {t("ios.body")}
      </p>
      <ol aria-label={t("ios.stepsLabel")} className="m-0 flex list-none flex-col gap-4 p-0">
        {STEPS.map(({ key, icon: Icon }, index) => (
          <li key={key} className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-sunken text-sm font-semibold text-text"
            >
              {index + 1}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5 pt-[3px]">
              <span className="text-sm font-semibold text-text">{t(`ios.steps.${key}.title`)}</span>
              <span className="text-[13px] text-text-muted">{t(`ios.steps.${key}.hint`)}</span>
            </span>
            <span
              aria-hidden="true"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-sunken text-text-muted"
            >
              <Icon size={20} />
            </span>
          </li>
        ))}
      </ol>
      <div className="flex items-start gap-3 rounded-xl bg-sunken px-4 py-3">
        <Info size={18} aria-hidden="true" className="mt-px shrink-0 text-info-fg" />
        <p className="min-w-0 flex-1 text-[13px] text-text">{t("ios.safariOnly")}</p>
      </div>
    </Dialog>
  );
};
