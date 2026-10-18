// dizayn-v2: superadmin-payments-market-picker-dialog, superadmin-payments-to-give-dialog, admin-payments-to-give-dialog, admin-payments-to-receive-dialog, manager-payments-courier-select-dialog
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "../../../shared/ui/primitives";

/**
 * Pul oynalaridagi (Berilishi / Qabul qilinishi kerak) faol bo'lmagan market, menejer yoki kuryer belgisi —
 * qator puli qolgani uchun ko'rsatiladi. Maket: neytral nuqtali badge «Nofaol».
 *
 * `isSelected` — eski (v1) chaqiruvchilar uchun saqlangan; v2 badge tanlangan qatorda ham bir xil ko'rinadi.
 */
const InactiveBadge = ({ isSelected = false }: { isSelected?: boolean }) => {
  const { t } = useTranslation("payments");

  return (
    <Badge dot className="align-middle" data-selected={isSelected || undefined}>
      {t("v2Common.inactive")}
    </Badge>
  );
};

export default memo(InactiveBadge);
