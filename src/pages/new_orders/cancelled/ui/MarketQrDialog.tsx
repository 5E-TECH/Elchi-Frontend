// dizayn-v2: market-new-orders-cancelled-qr-dialog
import { QRCode } from "antd";
import { QrCode } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, Dialog } from "../../../../shared/ui/primitives";
import type { CancelledMarketQr } from "../cancelledModel";

/**
 * «Bekor qilingan buyurtmalar QR kodi» oynasi — market roli (maket `market-new-orders-cancelled-qr-dialog`;
 * telefonda pastki varaqa). QR — backend rasmi (`image`), bo'lmasa token/matndan chiziladi; ikkalasi ham
 * yo'q bo'lsa — «QR kod ma'lumoti topilmadi».
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

export const MarketQrDialog = ({ open, qr, onClose }: MarketQrDialogProps) => {
  const { t } = useTranslation("newOrders");
  const image = qr?.image || "";
  const value = (qr?.payload || qr?.token || "").trim();

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
    </Dialog>
  );
};
