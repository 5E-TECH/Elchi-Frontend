// dizayn-v2: superadmin-neworders-create-manual-step2-existing-customer, market-new-orders-create-manual-existing-customer
import { memo, useId, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatKgValue } from "../../../../entities/delivery-pricing/lib/formatKg";
import { cx } from "../../../../shared/lib/cx";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../../shared/lib/formatMoney";
import { Badge, Button, Skeleton } from "../../../../shared/ui/primitives";
import type { OrderDeliveryQuote } from "./useOrderDeliveryQuote";

type DeliveryPriceBlockProps = {
  /** Market roli — «Sizdan yechiladi», boshqalar — «Marketdan yechiladi». */
  isMarketRole: boolean;
  /** Market standart narxi (CS-B) — o'lchovli mahsulot bo'lmaganda ko'rsatiladi; `null` — yo'q. */
  standardPrice: number | null;
  estimate: OrderDeliveryQuote;
};

/**
 * «YETKAZISH NARXI» — «Buyurtma xulosasi» kartasida (maket `*-create-manual-step2-existing-customer`):
 *  - o'lchovli mahsulot bor — server hisobi (6NYcXvGy): «≈ 43 000 so'm», «Standart 35 000 + vazn uchun 8 000 so'm
 *    (2 kg × 4 000)», «Hisob vazni 2,4 kg · hajm bo'yicha», og'irlik va hajmli vazn, kim to'lashi, «Taxminiy» belgisi
 *    (maketdagi «Taklif · backend kerak» o'rnida). Kutilmoqda — skelet; xato — «Hisoblab bo'lmadi» (forma ishlayveradi);
 *  - o'lchovli mahsulot yo'q — avvalgidek market standart narxi (CS-B), o'lchovsiz mahsulot bo'lsa ogohlantirish bilan.
 */
const DeliveryPriceBlock = ({ isMarketRole, standardPrice, estimate }: DeliveryPriceBlockProps) => {
  const { t, i18n } = useTranslation(["orders", "common"]);
  const labelId = useId();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const money = (value: number, withCurrency = true) =>
    formatMoneyLocalized(value, { language, withCurrency });
  const kg = (value: number) => formatKgValue(value, language, 2);
  const { visible, input, state, quote } = estimate;
  const engine = visible && input.measured > 0;
  const charged = isMarketRole
    ? t("createPricing.summaryChargedOwn")
    : t("createPricing.summaryChargedMarket");

  const unmeasuredNote =
    visible && input.unmeasured > 0
      ? engine
        ? t("createPricing.unmeasuredSome", {
            count: input.unmeasured,
            value: formatNumberLocalized(input.unmeasured, { language }),
          })
        : t("createPricing.unmeasuredAll")
      : null;
  const warning = unmeasuredNote ? (
    <p
      className="m-0 flex items-start gap-1.5 text-xs text-warning-fg"
      data-testid="delivery-unmeasured"
    >
      <TriangleAlert size={14} aria-hidden="true" className="mt-px shrink-0" />
      <span>{unmeasuredNote}</span>
    </p>
  ) : null;

  if (!engine && standardPrice == null && !warning) return null;

  const header = (value: ReactNode) => (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <span id={labelId} className="text-[13px] text-text-muted">
        {t("createPricing.deliveryPrice")}
      </span>
      {value}
    </div>
  );

  // O'lchovli mahsulot yo'q — CS-B standart narxi (o'zgarmagan ko'rinish) yoki faqat ogohlantirish.
  if (!engine) {
    return (
      <div role="group" aria-labelledby={labelId} className="flex flex-col gap-1 text-sm">
        {header(
          <span className="ml-auto font-semibold whitespace-nowrap text-text">
            {standardPrice != null ? money(standardPrice) : "—"}
          </span>,
        )}
        {standardPrice != null ? (
          <>
            <p className="m-0 text-xs text-text-muted">{t("createPricing.summaryStandard")}</p>
            <p className="m-0 text-xs text-text-subtle">{charged}</p>
          </>
        ) : null}
        {warning}
      </div>
    );
  }

  const updating = state.status === "success" && state.isUpdating;
  let value;
  let details = null;
  if (state.status === "error") {
    value = (
      <span className="ml-auto text-[13px] text-text-muted">
        {t("createPricing.estimateFailed")}
      </span>
    );
    details = (
      <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-text-subtle">
        <span>{t("createPricing.estimateFailedHint")}</span>
        <Button variant="link" onClick={state.retry}>
          {t("retry", { ns: "common" })}
        </Button>
      </div>
    );
  } else if (state.status !== "success") {
    value = <Skeleton width={96} height={14} className="ml-auto" />;
  } else if (!quote) {
    value = <span className="ml-auto font-semibold text-text">—</span>;
    details = <p className="m-0 text-xs text-text-subtle">{t("createPricing.estimateNoTariff")}</p>;
  } else {
    const basis =
      quote.basis === "volume"
        ? t("createPricing.estimateBasisVolume")
        : quote.basis === "weight"
          ? t("createPricing.estimateBasisWeight")
          : null;
    value = (
      <span
        className="ml-auto font-semibold whitespace-nowrap text-text"
        data-testid="delivery-estimate"
      >
        {t("createPricing.estimateValue", { amount: money(quote.total) })}
      </span>
    );
    details = (
      <>
        <p className="m-0 text-xs text-text-muted">
          {quote.extraKg > 0
            ? t("createPricing.estimateBreakdown", {
                base: money(quote.base, false),
                extra: money(quote.extra),
                extraKg: formatNumberLocalized(quote.extraKg, { language }),
                perKg: money(quote.perExtraKg, false),
              })
            : t("createPricing.estimateBaseOnly", { base: money(quote.base, false) })}
        </p>
        <p className="m-0 text-xs text-text-subtle">
          {basis
            ? t("createPricing.estimateBillable", { billable: kg(quote.billableKg), basis })
            : t("createPricing.estimateBillableNoBasis", { billable: kg(quote.billableKg) })}
        </p>
        <p className="m-0 text-xs text-text-subtle">
          {t("createPricing.estimateWeights", {
            actual: kg(quote.actualKg),
            volumetric: kg(quote.volumetricKg),
          })}
        </p>
        <p className="m-0 text-xs text-text-subtle">{charged}</p>
      </>
    );
  }

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      aria-busy={state.status === "loading" || updating || undefined}
      className="flex flex-col gap-1 text-sm"
    >
      <div
        className={cx(
          "flex flex-col gap-1 transition-opacity duration-150 motion-reduce:transition-none",
          updating && "opacity-60",
        )}
      >
        {header(value)}
        {details}
      </div>
      {warning}
      {state.status === "success" && quote ? (
        <Badge className="mt-1 self-start">{t("createPricing.estimateBadge")}</Badge>
      ) : null}
    </div>
  );
};

export default memo(DeliveryPriceBlock);
