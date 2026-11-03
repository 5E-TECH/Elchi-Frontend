// dizayn-v2: superadmin-payments-overview-corrected, superadmin-payments-cash-detail-courier-corrected, market-cashbox-my-corrected, courier-cashbox-my-transfers-corrected, superadmin-payments-history-detail-dialog-corrected, superadmin-payments-history-detail-dialog-replacement
import { memo } from "react";
import { Pencil, RotateCcw, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { PaymentCorrectionBadgeKind } from "../../../entities/payments/paymentCorrection";
import { Badge, type BadgeSize, type Tone } from "../../../shared/ui/primitives";
import { correctionBadgeLabel } from "./lib/paymentCorrectionView";

/**
 * To'lov tuzatish belgisi (T6) — kassa tarixi ro'yxatlarida (sarlavha yonida) va tafsilot oynasida («Summa» yonida,
 * «Bog'liq yozuv» qatorida). Maketdagi `.el-badge` (24px), bosilmaydi, matn har doim bor (rang yolg'iz ma'no
 * bermaydi):
 *  - «Qaytarildi» — neytral + `RotateCcw` (asl to'lov to'liq qaytarilgan);
 *  - «Tahrirlangan» — warning + `Pencil` (summa tuzatilgan, asl yozuv o'zgarmagan);
 *  - «Teskari yozuv» — neytral, ikonkasiz (asl to'lovni bekor qiluvchi yozuv);
 *  - «Tuzatilgan» — info, ikonkasiz (tahrirdan keyingi yangi to'lov).
 * Ega qarori: tuzatilgan to'lov summasi chizilmaydi, xiralashmaydi — belgi yagona ishora.
 */
const LOOK: Record<PaymentCorrectionBadgeKind, { tone: Tone; icon?: LucideIcon }> = {
  reversed: { tone: "neutral", icon: RotateCcw },
  edited: { tone: "warning", icon: Pencil },
  reversal: { tone: "neutral" },
  replacement: { tone: "info" },
};

export const PaymentCorrectionBadge = memo(
  ({ kind, size }: { kind?: PaymentCorrectionBadgeKind | null; size?: BadgeSize }) => {
    const { t } = useTranslation("payments");
    if (!kind) return null;
    const look = LOOK[kind];
    return (
      <Badge tone={look.tone} icon={look.icon} size={size} data-payment-correction={kind}>
        {correctionBadgeLabel(kind, t)}
      </Badge>
    );
  },
);

PaymentCorrectionBadge.displayName = "PaymentCorrectionBadge";
