// dizayn-v2: superadmin-batches-detail, admin-batches-detail, manager-batches-detail-send, manager-batches-detail-readonly, manager-returns-batch-detail
import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getBatchQrUrl } from "../lib/batchFormat";

interface BatchQrCodeProps {
  token?: string | null;
  fallbackLabel: string;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  /** Zaxira yozuvidagi paket raqami klassi (ekranda 13 px; chop etishda `.batch-print-qr-fallback small`). */
  fallbackLabelClassName?: string;
}

/**
 * Paket QR kodi: `api.qrserver.com` rasmi (token bo'yicha). Token yo'q yoki rasm yuklanmasa — zaxira yozuv
 * («QR kod» + paket raqami). Sahifadagi «QR kod» kartasi va A5 chop etish varag'i ishlatadi.
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
  const [failedToken, setFailedToken] = useState<string | null>(null);
  const normalizedToken = token?.trim() ?? "";
  const canRenderQr = normalizedToken && failedToken !== normalizedToken;

  if (!canRenderQr) {
    return (
      <div role="img" aria-label={alt} className={fallbackClassName}>
        <span>{t("detail.qrFallback")}</span>
        <small className={fallbackLabelClassName}>{fallbackLabel}</small>
      </div>
    );
  }

  return (
    <img
      src={getBatchQrUrl(normalizedToken)}
      alt={alt}
      onError={() => setFailedToken(normalizedToken)}
      className={className}
    />
  );
};

export default memo(BatchQrCode);
