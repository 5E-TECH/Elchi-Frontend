// dizayn-v2: superadmin-payments-overview-receipts, superadmin-payments-main-cashbox-receipts, superadmin-payments-history-detail-receipt-states
import { Check, CircleAlert, Clock, Receipt, X, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toReceiptRef, type ReceiptAiStatus } from "../../../../entities/payments/receipt";
import { Badge, type Tone } from "../../../../shared/ui/primitives";

/**
 * Chek holati belgilari (QlLf33Ma). Tonlar: mos — success; farq bor / xato — danger; o'qib bo'lmadi / tahlilda —
 * warning; AI o'chiq — neutral. Rang doim matn bilan birga.
 *  - `ReceiptRowBadge` — ro'yxat qatori (`Receipt` + holat, «Chek: …» ekran o'quvchiga). Belgisiz qator — chek yo'q.
 *  - `ReceiptStatusBadge` — tafsilotdagi «Chek» bo'limi (holat ikonkasi; 3 daqiqadan oshgan `pending` — «Natija kelmadi»).
 */

const STATUS_TONE: Record<ReceiptAiStatus, Tone> = {
  match: "success",
  mismatch: "danger",
  error: "danger",
  unreadable: "warning",
  pending: "warning",
  disabled: "neutral",
};

const ICON: Partial<Record<ReceiptAiStatus, LucideIcon>> = {
  match: Check,
  mismatch: X,
  unreadable: CircleAlert,
  error: CircleAlert,
};

export const ReceiptRowBadge = ({ receipt }: { receipt: unknown }) => {
  const { t } = useTranslation("payments");
  const ref = toReceiptRef(receipt);
  if (!ref) return null;
  const status = t(`receipt.status.${ref.ai_status}`);
  return (
    <Badge tone={STATUS_TONE[ref.ai_status]} icon={Receipt} title={t("receipt.status.aria", { status })} data-receipt-status={ref.ai_status}>
      <span className="sr-only">{t("receipt.status.prefix")} </span>
      {status}
    </Badge>
  );
};

export const ReceiptStatusBadge = ({ status, stale = false }: { status: ReceiptAiStatus; stale?: boolean }) => {
  const { t } = useTranslation("payments");
  if (stale) {
    return (
      <Badge tone="warning" icon={Clock}>
        {t("receipt.status.stale")}
      </Badge>
    );
  }
  return (
    <Badge tone={STATUS_TONE[status]} icon={ICON[status]} dot={status === "pending"}>
      {t(`receipt.status.${status}`)}
    </Badge>
  );
};
