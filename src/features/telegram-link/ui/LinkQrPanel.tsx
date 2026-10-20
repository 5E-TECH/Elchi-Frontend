// dizayn-v2: common-profile-telegram-link-dialog
import { useId, useState } from "react";
import { ChevronDown, QrCode } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import { Pressable } from "../../../shared/ui/primitives";
import { useQrImage } from "../lib/useQrImage";

export type LinkQrImageProps = {
  /** QR'ga yoziladigan matn (`deep_link`). */
  value: string;
  /** Rasm nomi (ekran o'quvchi uchun). */
  alt: string;
  /** Tomoni, px (sukut 176). */
  size?: number;
  /** Burchaklar 8 px (sukut). Oq ramka ichida — `false`. */
  rounded?: boolean;
  className?: string;
};

/**
 * Havolaning QR rasmi (`useQrImage` — SVG, sinxron): oq fonda qora modullar, har ikki mavzuda kamera o'qiydi.
 * Yaratib bo'lmasa (juda uzun matn) — hech narsa chizilmaydi, havola tugmasi baribir bor.
 */
export const LinkQrImage = ({ value, alt, size = 176, rounded = true, className }: LinkQrImageProps) => {
  const src = useQrImage(value);
  if (!src) return null;
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={cx("block h-auto max-w-full shrink-0", rounded && "rounded-lg", className)}
    />
  );
};

export type LinkQrPanelProps = {
  value: string;
  alt: string;
  /**
   * Telefonda: QR yig'ilgan — «Boshqa telefondan — QR kod» tugmasi ostida (o'z telefonida havola
   * «Telegram'da ochish» bilan ochiladi; QR boshqa qurilmadan skanerlash uchun).
   */
  collapsible?: boolean;
  /** QR tomoni, px (sukut 192). */
  size?: number;
  className?: string;
};

/** QR oq ramkada (`bg-on-nav` — tungi mavzuda ham oq), ramka `sunken` maydon o'rtasida. */
const QrFrame = ({ value, alt, size }: { value: string; alt: string; size: number }) => (
  <div className="flex justify-center rounded-[14px] bg-sunken p-4">
    <div className="rounded-xl border border-border bg-on-nav p-2">
      <LinkQrImage value={value} alt={alt} size={size} rounded={false} />
    </div>
  </div>
);

/**
 * Havola QR paneli (maket `common-profile-telegram-link-dialog`): desktop va planshetda — ochiq ramka;
 * telefonda (`collapsible`) — `sunken` ichida ochib-yopiladigan «Boshqa telefondan — QR kod».
 */
export const LinkQrPanel = ({ value, alt, collapsible = false, size = 192, className }: LinkQrPanelProps) => {
  const { t } = useTranslation("telegramLink");
  const [open, setOpen] = useState(false);
  const panelId = useId();

  if (!collapsible) {
    return (
      <div className={className}>
        <QrFrame value={value} alt={alt} size={size} />
      </div>
    );
  }

  return (
    <div className={cx("flex flex-col rounded-xl bg-sunken p-0.5", className)}>
      <Pressable
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 w-full min-w-0 items-center justify-between gap-2 rounded-[10px] px-3 text-left text-sm font-semibold text-text"
      >
        <span className="inline-flex min-w-0 items-center gap-2">
          <QrCode aria-hidden="true" size={18} strokeWidth={2} className="shrink-0" />
          <span className="min-w-0">{t("qrOtherPhone")}</span>
        </span>
        <ChevronDown
          aria-hidden="true"
          size={18}
          strokeWidth={2}
          className={cx("shrink-0 transition-transform duration-150", open && "rotate-180")}
        />
      </Pressable>
      <div id={panelId} hidden={!open} className="px-3.5 pt-1.5 pb-3.5">
        {open ? (
          <div className="mx-auto w-fit rounded-xl border border-border bg-on-nav p-2">
            <LinkQrImage value={value} alt={alt} size={size} rounded={false} />
          </div>
        ) : null}
      </div>
    </div>
  );
};
