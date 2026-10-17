// dizayn-v2: superadmin-notifications-sms-campaign, superadmin-notifications-sms-templates
import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cx } from "../lib/cx";
import { formatMoneyLocalized, formatNumberLocalized } from "../lib/formatMoney";
import { countSmsSegments } from "../lib/smsSegments";
import { Badge } from "./primitives";

interface SmsMeterProps {
  /** Yuboriladigan YAKUNIY matn (reklamada bekor qilish ko'rsatmasi bilan). */
  text: string;
  /** Qabul qiluvchilar soni (narx prognozi uchun). */
  recipients?: number;
  /** Bir bo'lak narxi, so'm. Kelmasa (null) narx o'rnida "—" — 0 emas. */
  tariff?: number | null;
  className?: string;
}

/**
 * SMS hisoblagichi (D5sxjGBY #1-#3), dizayn v2 (maket `superadmin-notifications-sms-campaign`, `-templates`):
 * kodlash badge'i («GSM-7» neytral, «UCS-2» ogohlantirish), «189 / 153 belgi», «2 bo'lak» (qalin), TAXMINIY narx
 * («≈ 1 920 so'm (taxminiy)»). Bitta kirill harfi UCS-2 ga o'tkazib limitni 70 ga tushiradi — buni darhol
 * ogohlantirish rangida ko'rsatadi.
 */
const SmsMeter = ({ text, recipients = 1, tariff = null, className }: SmsMeterProps) => {
  const { t, i18n } = useTranslation("sms");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const segments = useMemo(() => countSmsSegments(text), [text]);
  const ucs2 = segments.encoding === "UCS-2";
  const cost =
    tariff === null || tariff === undefined
      ? null
      : segments.parts * tariff * Math.max(recipients, 0);

  return (
    <div
      data-testid="sms-meter"
      aria-live="polite"
      className={cx("flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]", className)}
    >
      <Badge
        data-testid="sms-meter-encoding"
        data-tone={ucs2 ? "warning" : "neutral"}
        tone={ucs2 ? "warning" : "neutral"}
      >
        {segments.encoding}
      </Badge>
      <span className="text-text-muted tabular-nums">
        {t("meter.chars", {
          units: formatNumberLocalized(segments.units, { language }),
          limit: formatNumberLocalized(segments.perPart, { language }),
        })}
      </span>
      <span data-testid="sms-meter-parts" className="font-semibold text-text tabular-nums">
        {t("meter.parts", { count: segments.parts })}
      </span>
      <span data-testid="sms-meter-cost" className="text-text-muted tabular-nums">
        {cost === null
          ? t("meter.costUnknown")
          : t("meter.cost", { sum: formatMoneyLocalized(cost, { language }) })}
      </span>
      {ucs2 ? (
        <span role="note" className="w-full text-warning-fg">
          {t("meter.ucs2Warning")}
        </span>
      ) : null}
    </div>
  );
};

export default memo(SmsMeter);
