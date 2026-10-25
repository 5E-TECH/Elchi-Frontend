// dizayn-v2: superadmin-products-create, superadmin-products-edit-dialog, superadmin-regions-delivery-tariffs
import { useId, type ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { Button, Skeleton } from "../../../shared/ui/primitives";
import type { DeliveryQuoteState } from "../api/useDeliveryPricing";
import {
  DELIVERY_TARIFF_IDS,
  type DeliveryPricingSettings,
  type DeliveryQuote,
  type DeliveryTariffId,
} from "../model/types";
import { formatKgValue } from "../lib/formatKg";
import { firstDeliveryQuote } from "../lib/resolveWeights";

export type DeliveryQuoteListProps = {
  state: DeliveryQuoteState;
  /**
   * `list` — qatorlar: nom, izoh («Toshkent shahri ichida · 35 000 + 6 kg × 4 000»), narx o'ngda (yaratish
   * sahifasi, kalkulyator); `tiles` — uchta kichik katak (tahrirlash oynasi).
   */
  variant?: "list" | "tiles";
  /** «Taxminiy yetkazish narxi» sarlavhasi (mahsulot formasi). */
  heading?: boolean;
  /** Izohda yo'nalish tavsifi («Viloyat filialigacha») — mahsulot yaratish sahifasi. */
  scope?: boolean;
  /** Pastdagi izoh: hisob vazni, chegara, yaxlitlash (mahsulot formasi). */
  hint?: boolean;
  /** Formula sozlamalari (faqat superadmin/admin oladi) — izohda chegara va yaxlitlash shundan. */
  settings?: DeliveryPricingSettings | null;
  /** Izoh oxiri (masalan «Tariflar — Hududlar → Yetkazish tariflari» havolasi). */
  hintSuffix?: ReactNode;
  className?: string;
};

/**
 * «TAXMINIY YETKAZISH NARXI» — `POST /delivery/quote/by-tariff` natijasi (maket `superadmin-products-create`,
 * `-edit-dialog`, kalkulyator `superadmin-regions-delivery-tariffs`): Shahar ichida · Markazgacha · Uygacha. Narx —
 * serverniki (`total`, 500 ga karrali), UI qayta hisoblamaydi. O'lchov to'liq emas (`idle`) — blok chizilmaydi;
 * yuklanish — skelet; xato — «Narxni hisoblab bo'lmadi» + «Qayta urinish» (forma ishlashda davom etadi).
 */
export const DeliveryQuoteList = ({
  state,
  variant = "list",
  heading = false,
  scope = false,
  hint = false,
  settings,
  hintSuffix,
  className,
}: DeliveryQuoteListProps) => {
  const { t, i18n } = useTranslation("deliveryPricing");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const headingId = useId();
  if (state.status === "idle") return null;

  const number = (value: number) => formatNumberLocalized(value, { language });
  const money = (value: number) => formatMoneyLocalized(value, { language });
  const name = (id: DeliveryTariffId) => t(`tariffs.${id}`);

  /** Izoh: yo'nalish (ixtiyoriy) · hisob; har bo'lak bitta qatorda («4 000» ikkiga bo'linmasin). */
  const breakdown = (id: DeliveryTariffId, quote: DeliveryQuote | null): ReactNode => {
    const detail = !quote
      ? t("quote.noTariff")
      : quote.extraKg > 0
        ? t("quote.breakdown", {
            base: number(quote.base),
            extraKg: number(quote.extraKg),
            perKg: number(quote.perExtraKg),
          })
        : t("quote.baseOnly");
    return (
      <>
        {scope ? `${t(`tariffScope.${id}`)} · ` : null}
        <span className="whitespace-nowrap">{detail}</span>
      </>
    );
  };

  const price = (quote: DeliveryQuote | null, loading: boolean) =>
    loading ? (
      <Skeleton width={88} height={14} className="inline-block align-middle" />
    ) : quote ? (
      money(quote.total)
    ) : (
      <>
        <span aria-hidden="true" className="text-text-subtle">
          —
        </span>
        <span className="sr-only">{t("quote.noTariff")}</span>
      </>
    );

  const header = heading ? (
    <h3 id={headingId} className="m-0 text-sm font-semibold text-text">
      {t("quote.title")}
    </h3>
  ) : null;

  if (state.status === "error") {
    return (
      <div className={cx("flex min-w-0 flex-col gap-2.5", className)}>
        {header}
        <div role="status" className="flex min-w-0 items-start gap-3 rounded-[10px] bg-sunken px-4 py-3">
          <CircleAlert size={18} strokeWidth={2} aria-hidden="true" className="mt-0.5 shrink-0 text-text-subtle" />
          <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
            <span className="text-sm font-semibold text-text">{t("quote.failed")}</span>
            <span className="text-[13px] leading-[18px] text-text-muted">{t("quote.failedHint")}</span>
            <Button variant="link" size="sm" onClick={state.retry} className="mt-1">
              {t("quote.retry")}
            </Button>
          </span>
        </div>
      </div>
    );
  }

  const loading = state.status === "loading";
  const quotes = state.quotes;
  const summary = firstDeliveryQuote(quotes);
  const hintText =
    hint && summary
      ? [
          summary.extraKg > 0
            ? settings
              ? t("quote.hintExtra", {
                  billable: formatKgValue(summary.billableKg, language),
                  first: formatNumberLocalized(settings.firstKgIncluded, { language, fractionDigits: 3 }),
                  extra: number(summary.extraKg),
                })
              : t("quote.hintExtraShort", {
                  billable: formatKgValue(summary.billableKg, language),
                  extra: number(summary.extraKg),
                })
            : settings
              ? t("quote.hintBase", {
                  billable: formatKgValue(summary.billableKg, language),
                  first: formatNumberLocalized(settings.firstKgIncluded, { language, fractionDigits: 3 }),
                })
              : t("quote.hintBaseShort", { billable: formatKgValue(summary.billableKg, language) }),
          settings ? t("quote.hintRound", { roundTo: money(settings.roundTo) }) : t("quote.hintFinal"),
        ].join(" ")
      : null;

  return (
    <div className={cx("flex min-w-0 flex-col", variant === "list" ? "gap-1" : "gap-2", className)}>
      {header}
      {variant === "list" ? (
        <ul
          aria-labelledby={heading ? headingId : undefined}
          aria-label={heading ? undefined : t("quote.title")}
          aria-live="polite"
          aria-busy={state.isUpdating || undefined}
          className={cx(
            "m-0 flex list-none flex-col p-0 transition-opacity duration-150 motion-reduce:transition-none",
            state.isUpdating && !loading && "opacity-60",
          )}
        >
          {DELIVERY_TARIFF_IDS.map((id) => {
            const quote = quotes?.[id] ?? null;
            return (
              <li
                key={id}
                className="flex min-w-0 items-center justify-between gap-3 border-b border-border py-3 last:border-b-0"
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-semibold text-text">{name(id)}</span>
                  {loading ? (
                    <Skeleton width={160} height={12} />
                  ) : (
                    <span className="text-xs text-text-muted">{breakdown(id, quote)}</span>
                  )}
                </span>
                <span className="shrink-0 whitespace-nowrap text-sm font-semibold text-text">
                  {price(quote, loading)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <div
          role="group"
          aria-labelledby={heading ? headingId : undefined}
          aria-label={heading ? undefined : t("quote.title")}
          aria-live="polite"
          aria-busy={state.isUpdating || undefined}
          className={cx(
            "flex flex-wrap gap-2 transition-opacity duration-150 motion-reduce:transition-none",
            state.isUpdating && !loading && "opacity-60",
          )}
        >
          {DELIVERY_TARIFF_IDS.map((id) => (
            <span
              key={id}
              className="flex min-w-0 flex-[1_1_120px] flex-col gap-0.5 rounded-[10px] border border-border px-3 py-2.5"
            >
              <span className="text-xs text-text-muted">{name(id)}</span>
              <span className="whitespace-nowrap text-sm font-semibold text-text">
                {price(quotes?.[id] ?? null, loading)}
              </span>
            </span>
          ))}
        </div>
      )}
      {hintText || hintSuffix ? (
        <p className="m-0 text-xs text-text-muted">
          {hintText}
          {hintText && hintSuffix ? " " : null}
          {hintSuffix}
        </p>
      ) : null}
    </div>
  );
};
