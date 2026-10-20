// dizayn-v2: superadmin-payments-main-cashbox-shift-dialog, superadmin-payments-main-cashbox-shift-result-dialog
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import { formatSignedMoneyLocalized } from "../../../shared/lib/formatMoney";
import { Badge, TONE_FG } from "../../../shared/ui/primitives";
import { SHIFT_DIFF_TONE, shiftDiffKind } from "./lib/shiftDiff";

/**
 * Smena farqi belgisi (maket `*-shift-dialog`, `*-shift-result-dialog`): «Kamomad» (danger, nuqta), «Ortiqcha»
 * (warning, nuqta), «Mos keldi» (success, belgi), «Sanalmadi» (neutral). Holat rangi doim matn bilan birga.
 */
export const ShiftDiffBadge = ({ diff }: { diff: number | null | undefined }) => {
  const { t } = useTranslation("payments");
  const kind = shiftDiffKind(diff);
  return (
    <Badge
      tone={SHIFT_DIFF_TONE[kind]}
      dot={kind === "shortage" || kind === "surplus"}
      icon={kind === "match" ? Check : undefined}
    >
      {t(`v2MainCashbox.shift.diff.${kind}`)}
    </Badge>
  );
};

/** Farq summasi: ishora matnda (−/+), kamomad — danger, ortiqcha — warning, nol — oddiy matn. Sanalmagan — `null`. */
export const ShiftDiffAmount = ({ diff, className }: { diff: number | null | undefined; className?: string }) => {
  const { i18n } = useTranslation("payments");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const kind = shiftDiffKind(diff);
  if (kind === "notCounted") return null;
  return (
    <span
      className={cx(
        "whitespace-nowrap font-semibold",
        kind === "match" ? "text-text" : TONE_FG[SHIFT_DIFF_TONE[kind]],
        className,
      )}
    >
      {formatSignedMoneyLocalized(diff, { language })}
    </span>
  );
};
