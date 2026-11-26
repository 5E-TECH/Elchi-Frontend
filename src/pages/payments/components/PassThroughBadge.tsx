import { memo } from "react";
import { ArrowLeftRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatMoneyLocalized } from "../../../shared/lib/formatMoney";
import { Badge } from "../../../shared/ui/primitives";

/**
 * O'tkazma izi (ega 2026-11-26, `lib/passThrough.ts`): «Kirim» / «Chiqim» belgisi o'rnida neytral «Kassaga kirmadi».
 */
export const PassThroughBadge = memo(() => {
  const { t } = useTranslation("payments");
  return <Badge icon={ArrowLeftRight}>{t("v2Common.passThrough.badge")}</Badge>;
});
PassThroughBadge.displayName = "PassThroughBadge";

/** Iz summasi — ishorasiz, kulrang (qoldiqqa ta'sir qilmagan). */
export const PassThroughAmount = memo(({ amount, language }: { amount: unknown; language?: string }) => (
  <span className="whitespace-nowrap font-semibold text-text-muted">
    {formatMoneyLocalized(Math.abs(Number(amount) || 0), { language })}
  </span>
));
PassThroughAmount.displayName = "PassThroughAmount";
