import { useTranslation } from "react-i18next";
import type { HandoverBatch, HandoverBatchMethod } from "../../../../entities/orders/cancelledHandovers";
import { formatNumberLocalized } from "../../../../shared/lib/formatMoney";
import { Badge, type Tone } from "../../../../shared/ui/primitives";

const METHOD: Record<HandoverBatchMethod, { tone: Tone; key: string }> = {
  qr: { tone: "success", key: "cancelReturn.method.qr" },
  pin: { tone: "info", key: "cancelReturn.method.pin" },
  no_qr: { tone: "neutral", key: "cancelReturn.method.no_qr" },
  manual: { tone: "warning", key: "cancelReturn.method.manualNoReason" },
};

/**
 * Topshirish usuli: asosiy (QR / parol / QR'siz; hammasi qo'lda — «Qo'lda tasdiq») va aralash partiyada qo'shimcha
 * «N ta qo'lda» (QR buzilgani uchun qo'lda tasdiqlanganlar). Eski partiyada usul yo'q — badge ham yo'q.
 */
export const HandoverMethodBadges = ({ batch }: { batch: HandoverBatch }) => {
  const { t, i18n } = useTranslation(["newOrders", "status"]);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const method = batch.method ? METHOD[batch.method] : null;
  const extraManual = batch.method !== "manual" && batch.manual_count > 0;
  return (
    <>
      {method ? <Badge tone={method.tone}>{t(method.key, { ns: "status" })}</Badge> : null}
      {extraManual ? (
        <Badge tone="warning" dot>
          {t("cancelled.handed.manualCount", {
            count: batch.manual_count,
            value: formatNumberLocalized(batch.manual_count, { language }),
          })}
        </Badge>
      ) : null}
    </>
  );
};
