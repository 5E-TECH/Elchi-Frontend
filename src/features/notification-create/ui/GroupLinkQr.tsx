// dizayn-v2: superadmin-notifications-create-dialog
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { cx } from "../../../shared/lib/cx";
import { Skeleton } from "../../../shared/ui/primitives";

type QrState = { value: string; src: string | null };

/**
 * Havolaning QR kodi — `qrcode` paketi → PNG data URL `<img>`. Ranglar paket sukuti (qora modullar, OQ fon):
 * skaner har ikki mavzuda o'qiy olishi uchun fon ataylab oq qoladi. Yaratib bo'lmasa — hech narsa chizilmaydi
 * (havola tugmasi baribir bor).
 */
const GroupLinkQr = ({ value, alt, className }: { value: string; alt: string; className?: string }) => {
  const [state, setState] = useState<QrState | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, { width: 352, margin: 1, errorCorrectionLevel: "M" })
      .then((src) => {
        if (!cancelled) setState({ value, src });
      })
      .catch(() => {
        if (!cancelled) setState({ value, src: null });
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

  if (!state || state.value !== value) {
    return <Skeleton shape="block" width={176} height={176} className={cx("shrink-0 rounded-lg", className)} />;
  }
  if (!state.src) return null;
  return (
    <img src={state.src} alt={alt} width={176} height={176} className={cx("size-44 shrink-0 rounded-lg", className)} />
  );
};

export default GroupLinkQr;
