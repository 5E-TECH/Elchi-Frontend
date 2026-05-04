import { memo, useState } from "react";
import { getBatchQrUrl } from "../lib/batchFormat";

interface BatchQrCodeProps {
  token?: string | null;
  fallbackLabel: string;
  alt: string;
  className?: string;
  fallbackClassName?: string;
}

const BatchQrCode = ({
  token,
  fallbackLabel,
  alt,
  className,
  fallbackClassName,
}: BatchQrCodeProps) => {
  const [failedToken, setFailedToken] = useState<string | null>(null);
  const normalizedToken = token?.trim() ?? "";
  const canRenderQr = normalizedToken && failedToken !== normalizedToken;

  if (!canRenderQr) {
    return (
      <div className={fallbackClassName}>
        <span>QR KOD</span>
        <small>{fallbackLabel}</small>
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
