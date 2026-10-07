import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { countSmsSegments } from "../lib/smsSegments";

interface SmsMeterProps {
  /** Yuboriladigan YAKUNIY matn (reklamada bekor qilish ko'rsatmasi bilan). */
  text: string;
  /** Qabul qiluvchilar soni (narx prognozi uchun). */
  recipients?: number;
  /** Bir bo'lak narxi, so'm. Kelmasa (null) narx o'rnida "—" — 0 emas. */
  tariff?: number | null;
  className?: string;
}

const formatSum = (value: number) => Math.round(value).toLocaleString("uz-UZ");

/**
 * SMS hisoblagichi (D5sxjGBY #1-#3): kodlash, belgilar, bo'laklar va
 * TAXMINIY narx. Bitta kirill harfi UCS-2 ga o'tkazib limitni 70 ga
 * tushiradi — buni darhol ogohlantirish rangida ko'rsatadi.
 */
const SmsMeter = ({ text, recipients = 1, tariff = null, className = "" }: SmsMeterProps) => {
  const { t } = useTranslation("sms");
  const segments = useMemo(() => countSmsSegments(text), [text]);
  const ucs2 = segments.encoding === "UCS-2";
  const cost = tariff === null || tariff === undefined ? null : segments.parts * tariff * Math.max(recipients, 0);

  return (
    <div
      data-testid="sms-meter"
      aria-live="polite"
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${className}`}
    >
      <span
        data-testid="sms-meter-encoding"
        className={`rounded-full px-2 py-0.5 font-semibold ${
          ucs2
            ? "bg-[color:var(--color-warning-soft)] text-[color:var(--color-warning-end)]"
            : "bg-[color:var(--color-border-soft)] text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]"
        }`}
      >
        {segments.encoding}
      </span>
      <span className="text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
        {t("meter.chars", { units: segments.units, limit: segments.perPart })}
      </span>
      <span data-testid="sms-meter-parts" className="font-semibold text-maindark dark:text-white">
        {t("meter.parts", { count: segments.parts })}
      </span>
      <span data-testid="sms-meter-cost" className="text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
        {cost === null ? t("meter.costUnknown") : t("meter.cost", { sum: formatSum(cost) })}
      </span>
      {ucs2 ? (
        <span role="note" className="w-full text-[color:var(--color-warning-end)]">
          {t("meter.ucs2Warning")}
        </span>
      ) : null}
    </div>
  );
};

export default memo(SmsMeter);
