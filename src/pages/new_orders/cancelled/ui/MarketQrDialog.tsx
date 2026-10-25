// dizayn-v2: market-new-orders-cancelled-qr-dialog
import { useEffect, useState } from "react";
import { QRCode } from "antd";
import { Clock, QrCode } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../../shared/lib/cx";
import { Badge, Button, Dialog } from "../../../../shared/ui/primitives";
import {
  formatCountdown,
  formatHandoverPin,
  spellHandoverPin,
  splitCountdown,
  type CancelledMarketQr,
} from "../cancelledModel";

/**
 * «Bekor qilingan buyurtmalar QR kodi» oynasi — market roli (maket `market-new-orders-cancelled-qr-dialog`;
 * telefonda pastki varaqa). QR — backend rasmi (`image`), bo'lmasa token/matndan chiziladi; ikkalasi ham
 * yo'q bo'lsa — «QR kod ma'lumoti topilmadi».
 *
 * QR ostida — 6 xonali kod (zkRab9M2, BG6; maketdagi «QR o'qilmasa — PIN kod» bloki): xodim QR'ni skanerlay
 * olmasa, uni yozadi. Katta, «482 913» ko'rinishida; o'ngda amal qilish vaqti (QR bilan bir xil, 2 daqiqa),
 * tugasa — «Muddati tugadi». Maketdagi «Taklif · backend kerak» belgisi o'rnida — taymer (backend tayyor).
 * «Qabul qilish» qayta bosilsa yangi QR va yangi kod keladi (eski ikkalasi ham yaroqsiz).
 *
 * QR har ikki mavzuda oq fonda to'q navy (`on-nav` / `nav` tokenlari) — skaner kontrastni yo'qotmasin.
 * Modullar rangi `currentColor` orqali (SVG atributida CSS o'zgaruvchisi emas); antd ildizining `color` i
 * `inherit` — aks holda tungi mavzuda antd matn rangi (och) olinardi.
 */

type MarketQrDialogProps = {
  open: boolean;
  qr: CancelledMarketQr | null;
  onClose: () => void;
};

/** Kod muddatigacha qolgan soniyalar (oyna ochiq paytda har soniya); muddat yo'q bo'lsa — `null`. */
const useRemainingSeconds = (expiresAt: number | undefined, active: boolean) => {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!active || expiresAt === undefined) return;
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [active, expiresAt]);

  if (expiresAt === undefined || now === null) return null;
  return Math.max(0, Math.ceil((expiresAt - now) / 1000));
};

export const MarketQrDialog = ({ open, qr, onClose }: MarketQrDialogProps) => {
  const { t } = useTranslation("newOrders");
  const image = qr?.image || "";
  const value = (qr?.payload || qr?.token || "").trim();
  const pin = qr?.pin ?? "";
  const remaining = useRemainingSeconds(pin ? qr?.pinExpiresAt : undefined, open);
  const expired = remaining === 0;
  const parts = splitCountdown(remaining ?? 0);

  return (
    <Dialog
      open={open && qr !== null}
      onClose={onClose}
      size="md"
      icon={QrCode}
      iconShape="circle"
      title={t("cancelled.qrDialog.title")}
      description={t("cancelled.qrDialog.description")}
      footer={
        <Button variant="secondary" onClick={onClose}>
          {t("cancelled.qrDialog.close")}
        </Button>
      }
    >
      <div className="flex items-center justify-center rounded-[14px] border border-dashed border-border-strong bg-sunken p-5">
        {image ? (
          <img
            src={image}
            alt={t("cancelled.qrDialog.imageLabel")}
            className="size-64 max-w-full rounded-xl bg-on-nav object-contain p-3"
          />
        ) : value ? (
          <div role="img" aria-label={t("cancelled.qrDialog.imageLabel")} className="rounded-xl bg-on-nav p-3 text-nav">
            <QRCode
              type="svg"
              value={value}
              size={232}
              errorLevel="M"
              bordered={false}
              color="currentColor"
              bgColor="transparent"
              // antd ildizi o'z matn rangini beradi (tungi mavzuda och) — `currentColor` o'ramdagi `nav` dan olinsin.
              style={{ color: "inherit" }}
            />
          </div>
        ) : (
          <p className="py-16 text-center text-sm font-semibold text-text-muted">{t("cancelled.qrDialog.empty")}</p>
        )}
      </div>

      {pin ? (
        <div
          data-testid="market-qr-pin"
          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl bg-sunken px-4 py-3"
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[13px] text-text-muted">{t("cancelled.qrDialog.pinLabel")}</span>
            {/* Ko'rinishi «482 913»; ekran o'quvchi raqamlarni alohida o'qiydi («4 8 2 9 1 3»), son sifatida emas. */}
            <span
              aria-hidden="true"
              data-testid="market-qr-pin-value"
              className={cx(
                "text-2xl/8 font-bold tracking-[4px] whitespace-nowrap tabular-nums",
                expired ? "text-text-subtle line-through" : "text-text",
              )}
            >
              {formatHandoverPin(pin)}
            </span>
            <span className="sr-only">{t("cancelled.qrDialog.pinAria", { digits: spellHandoverPin(pin) })}</span>
          </div>
          {remaining === null ? null : expired ? (
            <Badge tone="warning" icon={Clock} role="status">
              {t("cancelled.qrDialog.pinExpired")}
            </Badge>
          ) : (
            <Badge
              tone="neutral"
              icon={Clock}
              role="timer"
              aria-label={t("cancelled.qrDialog.pinTimerAria", { minutes: parts.minutes, seconds: parts.seconds })}
            >
              {t("cancelled.qrDialog.pinTimer", { time: formatCountdown(remaining) })}
            </Badge>
          )}
        </div>
      ) : null}
    </Dialog>
  );
};
