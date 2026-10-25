// dizayn-v2: superadmin-products-create, superadmin-products-edit-dialog, superadmin-products-create-errors, superadmin-regions-delivery-tariffs
import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import type { DeliveryQuoteState } from "../api/useDeliveryPricing";
import { VOLUMETRIC_DIVISOR, type WeightRules } from "../lib/billableWeight";
import { formatKgValue } from "../lib/formatKg";
import { firstDeliveryQuote, resolveMeasureWeights } from "../lib/resolveWeights";
import type { DeliveryMeasureItem } from "../model/types";

export type MeasureWeightsProps = {
  /** To'g'ri o'lchov yoki `null` — «Hisoblab bo'lmadi» (maket `*-products-create-errors`). */
  item: DeliveryMeasureItem | null;
  /** Sozlamadagi qoidalar (faqat superadmin/admin oladi); yo'q — sukut (qadam 0,1, chegara serverdan yoki 0). */
  rules?: WeightRules;
  /**
   * Shu o'lchovning `POST /delivery/quote/by-tariff` holati: yangi javob bo'lsa hisob vazni, asos va «hajm
   * qo'llandi» serverdan, chegara — javobdagi `volumetricFromKg` (rol sozlamani o'qiy olmasa ham to'g'ri).
   */
  quote?: DeliveryQuoteState;
  /** «Hajmli vazn» ostida formula («50 × 35 × 20 / 5000») — mahsulot formasi; kalkulyatorda yo'q. */
  showFormula?: boolean;
  /** «Hisob vazni» ostidagi izoh o'rniga (kalkulyator: «1,0 kg asosiy + 6 kg qo'shimcha»). */
  billableNote?: (billableKg: number) => ReactNode;
  className?: string;
};

/**
 * JONLI «HAJMLI VAZN» / «HISOB VAZNI» — maket `sunken` blok (`aria-live`): hajmli vazn = U × K × B / 5000, hisob
 * vazni = kattasi, 0,1 kg qadam bilan yuqoriga (30 × 22 × 15, 1,2 kg → 1,98 / 2,0 kg). Kalit o'chiq — hajmli vazn
 * chizilgan, hisob vazni faqat og'irlik («hajm hisobga olinmaydi — faqat og'irlik»). Hajmli vazn «Hajm bo'yicha
 * hisoblash chegarasi» dan kichik — ham chizilgan, ostida «Chegara 3,0 kg dan kichik — hisobga olinmaydi».
 */
export const MeasureWeights = ({ item, rules, quote, showFormula = true, billableNote, className }: MeasureWeightsProps) => {
  const { t, i18n } = useTranslation("deliveryPricing");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const box = "flex min-w-0 rounded-[10px] bg-sunken";

  if (!item) {
    return (
      <div aria-live="polite" className={cx(box, "items-start gap-3 px-4 py-3", className)}>
        <Info size={18} strokeWidth={2} aria-hidden="true" className="mt-0.5 shrink-0 text-text-subtle" />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-semibold text-text">{t("weights.invalidTitle")}</span>
          <span className="text-[13px] leading-[18px] text-text-muted">{t("weights.invalidDescription")}</span>
        </span>
      </div>
    );
  }

  const weights = resolveMeasureWeights(item, rules, {
    quote: firstDeliveryQuote(quote?.quotes),
    fresh: quote?.status === "success" && !quote.isUpdating,
  });
  const kg = (value: number, max?: number) => t("units.kg", { value: formatKgValue(value, language, max) });
  const divisor = rules?.volumetricDivisor ?? VOLUMETRIC_DIVISOR;
  // Kalit yoqiq, lekin hajmli vazn chegaradan kichik — hajm hisobga olinmaydi (standart narx, faqat og'irlik).
  const belowThreshold = item.volumetric_enabled && !weights.volumetricApplied && weights.volumetricFromKg > 0;
  const volumeIgnored = !item.volumetric_enabled || belowThreshold;
  const basisNote = volumeIgnored
    ? t("weights.volumeOff")
    : weights.basis === "volume"
      ? t("weights.basisVolume")
      : t("weights.basisWeight");

  return (
    <div aria-live="polite" className={cx(box, "flex-wrap gap-x-6 gap-y-3 px-4 py-3.5", className)}>
      <div className="flex min-w-0 flex-[1_1_140px] flex-col gap-0.5">
        <span className="text-[13px] text-text-muted">{t("weights.volumetric")}</span>
        <span
          className={cx(
            "text-base font-bold",
            volumeIgnored ? "text-text-subtle line-through" : "text-text",
          )}
        >
          {kg(weights.volumetricKg, 2)}
        </span>
        {showFormula ? (
          <span className="text-xs text-text-subtle">
            {t("weights.formula", {
              length: formatNumberLocalized(item.length_cm, { language }),
              width: formatNumberLocalized(item.width_cm, { language }),
              height: formatNumberLocalized(item.height_cm, { language }),
              divisor: String(divisor),
            })}
          </span>
        ) : null}
        {belowThreshold ? (
          <span className="text-xs text-text-muted">
            {t("weights.belowThreshold", { threshold: formatKgValue(weights.volumetricFromKg, language) })}
          </span>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-[1_1_140px] flex-col gap-0.5">
        <span className="text-[13px] text-text-muted">{t("weights.billable")}</span>
        <span className="text-base font-bold text-text">{kg(weights.billableKg)}</span>
        <span className="text-xs text-text-subtle">{billableNote ? billableNote(weights.billableKg) : basisNote}</span>
      </div>
    </div>
  );
};
