// dizayn-v2: superadmin-batches-detail, admin-batches-detail, manager-batches-detail-send, manager-batches-detail-readonly, manager-returns-batch-detail
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { ReceiptQr } from "../../../features/print-receipts";

interface BatchQrCodeProps {
  token?: string | null;
  fallbackLabel: string;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  /** Zaxira yozuvidagi paket raqami klassi. */
  fallbackLabelClassName?: string;
}

/**
 * Paket QR kodi — ilova ichida chiziladi (HJ5sLHiz: `ReceiptQr`, paket cheki bilan bir xil kod; tashqi QR
 * xizmati yo'q). Token yo'q — zaxira yozuv («QR kod» + paket raqami). Sahifadagi «QR kod» kartasi ishlatadi.
 */
const BatchQrCode = ({
  token,
  fallbackLabel,
  alt,
  className,
  fallbackClassName,
  fallbackLabelClassName,
}: BatchQrCodeProps) => {
  const { t } = useTranslation("batches");
  const normalizedToken = token?.trim() ?? "";

  if (!normalizedToken) {
    return (
      <div role="img" aria-label={alt} className={fallbackClassName}>
        <span>{t("detail.qrFallback")}</span>
        <small className={fallbackLabelClassName}>{fallbackLabel}</small>
      </div>
    );
  }

  return <ReceiptQr token={normalizedToken} label={alt} className={className} />;
};

export default memo(BatchQrCode);
