// dizayn-v2: superadmin-payments-main-cashbox-shift-dialog-accounts, superadmin-payments-shift-report
import { Ban, Check, CircleAlert, X, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ShiftAiStatus } from "../../../../entities/payments";
import { Badge } from "../../../../shared/ui/primitives";
import { AI_STATUS_TONE } from "./aiStatusMeta";

/**
 * AI tekshiruvi holati (kiZgTybn; maketlar `…-shift-dialog-accounts`, `…-shift-report`): «Mos keldi» — success,
 * «Mos kelmadi» — danger, «Tekshirilmoqda» — warning (nuqta), «O'qilmadi» — warning, «Xato» — danger,
 * «O'chirilgan» / «Tekshirilmagan» — neutral. Rang doim matn bilan birga.
 */

const AI_STATUS_ICON: Partial<Record<ShiftAiStatus, LucideIcon>> = {
  match: Check,
  mismatch: X,
  unreadable: CircleAlert,
  error: CircleAlert,
  disabled: Ban,
};

export const AiStatusBadge = ({ status }: { status: ShiftAiStatus }) => {
  const { t } = useTranslation("payments");
  const icon = AI_STATUS_ICON[status];
  return (
    <Badge tone={AI_STATUS_TONE[status]} icon={icon} dot={status === "pending"}>
      {t(`shiftCheck.ai.status.${status}`)}
    </Badge>
  );
};

/** Kiritilgan qiymat rasmdagidan farqli (`ai_entered_ok === false`) — alohida qizil belgi. */
export const EnteredMismatchBadge = () => {
  const { t } = useTranslation("payments");
  return (
    <Badge tone="danger" icon={CircleAlert}>
      {t("shiftCheck.ai.enteredBadge")}
    </Badge>
  );
};
