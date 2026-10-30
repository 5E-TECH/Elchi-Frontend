// dizayn-v2: superadmin-neworders-create-manual-step2-existing-customer, market-new-orders-create-manual-existing-customer
import { memo, useId, type ReactNode } from "react";
import { CircleX, RefreshCw, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatKgValue } from "../../../../entities/delivery-pricing/lib/formatKg";
import { cx } from "../../../../shared/lib/cx";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../../shared/lib/formatMoney";
import { Badge, Button, Skeleton } from "../../../../shared/ui/primitives";
import { estimateTotal } from "../model/orderDeliveryQuote";
import type { OrderDeliveryQuote } from "./useOrderDeliveryQuote";

type DeliveryPriceBlockProps = {
  /** Market roli — «Sizdan yechiladi», boshqalar — «Marketdan yechiladi». */
  isMarketRole: boolean;
  /** Market standart narxi (CS-B) tanlangan tur bo'yicha; `null` — yo'q yoki yuklanmoqda (qator chizilmaydi). */
  standardPrice: number | null;
  estimate: OrderDeliveryQuote;
};

/** Ko'rsatiladigan nomlar soni — qolgani «va yana N ta». */
const MAX_NAMES = 3;

/** `.el-xs.el-muted` ikonkali qator (maket: xato — `role="alert"`, izoh — `role="status"`). */
const IconLine = ({
  icon: Icon,
  role,
  children,
}: {
  icon: typeof CircleX;
  role: "alert" | "status";
  children: ReactNode;
}) => (
  <p role={role} className="m-0 flex items-start gap-1.5 text-xs text-text-muted">
    <Icon size={14} aria-hidden="true" className="mt-px shrink-0" />
    <span>{children}</span>
  </p>
);

/**
 * «YETKAZISH NARXI» — «Buyurtma xulosasi» kartasida (6NYcXvGy; maket `market-new-orders-create-manual-existing-customer`
 * holatlari). Narx — MARKET STANDART NARXI + vazn uchun qo'shimcha (server hisobi, `estimateTotal`):
 *  - qo'shimcha bor — «≈ 43 000 so'm», «Standart 35 000 + vazn uchun 8 000 so'm (2 kg × 4 000)», hisob vazni, og'irlik
 *    va hajmli vazn, kim to'lashi, «Taxminiy»;
 *  - standart doirasida — «35 000 so'm», «Standart narx · qo'shimcha yo'q», hisob vazni;
 *  - hisoblanmoqda — skelet + «Vazn va hajm hisoblanmoqda...»;
 *  - hisoblab bo'lmadi (yoki bu turga faol tarif yo'q) — standart narx, «…hozircha standart narx …», «Qayta urinish»;
 *  - o'lchovli mahsulot yo'q — CS-B standart narxi (o'zgarmagan ko'rinish);
 *  - katalogdan tashqari / o'lchovsiz mahsulot — nomi bilan izoh («… katalogda yo'q — vazni hisobga kirmadi»).
 * Standart narxsiz market — qator yo'q (maket: faqat yetkazish kartalari va ogohlantirish).
 */
const DeliveryPriceBlock = ({ isMarketRole, standardPrice, estimate }: DeliveryPriceBlockProps) => {
  const { t, i18n } = useTranslation(["orders", "common"]);
  const labelId = useId();
  if (standardPrice == null) return null;

  const language = i18n.resolvedLanguage ?? i18n.language;
  const money = (value: number, withCurrency = true) =>
    formatMoneyLocalized(value, { language, withCurrency });
  const kg = (value: number) => formatKgValue(value, language, 2);
  const { visible, input, state, quote } = estimate;
  const engine = visible && input.measured > 0;
  const charged = isMarketRole
    ? t("createPricing.summaryChargedOwn")
    : t("createPricing.summaryChargedMarket");

  const names = (list: string[]) => {
    const quoted = list
      .slice(0, MAX_NAMES)
      .map((name) => t("createPricing.quotedName", { name: name || "—" }));
    const joined = quoted.join(", ");
    return list.length > MAX_NAMES
      ? t("createPricing.namesMore", {
          names: joined,
          value: formatNumberLocalized(list.length - MAX_NAMES, { language }),
        })
      : joined;
  };
  const notes = visible ? (
    <>
      {input.catalogLessNames.length ? (
        <IconLine icon={TriangleAlert} role="status">
          {t("createPricing.catalogLessNote", { names: names(input.catalogLessNames) })}
        </IconLine>
      ) : null}
      {input.unmeasuredNames.length ? (
        <IconLine icon={TriangleAlert} role="status">
          {t("createPricing.unmeasuredNote", { names: names(input.unmeasuredNames) })}
        </IconLine>
      ) : null}
    </>
  ) : null;

  const header = (value: ReactNode) => (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <span id={labelId} className="text-[13px] text-text-muted">
        {t("createPricing.deliveryPrice")}
      </span>
      {value}
    </div>
  );
  const price = (amount: number, approximate = false) => (
    <span
      className="ml-auto font-semibold whitespace-nowrap text-text"
      data-testid="delivery-estimate"
    >
      {approximate ? t("createPricing.estimateValue", { amount: money(amount) }) : money(amount)}
    </span>
  );

  // O'lchovli mahsulot yo'q — CS-B standart narxi (o'zgarmagan ko'rinish) + o'lchovsiz mahsulotlar izohi.
  if (!engine) {
    return (
      <div role="group" aria-labelledby={labelId} className="flex flex-col gap-1 text-sm">
        {header(
          <span className="ml-auto font-semibold whitespace-nowrap text-text">
            {money(standardPrice)}
          </span>,
        )}
        <p className="m-0 text-xs text-text-muted">{t("createPricing.summaryStandard")}</p>
        {notes}
        <p className="m-0 text-xs text-text-subtle">{charged}</p>
      </div>
    );
  }

  if (state.status !== "success" && state.status !== "error") {
    return (
      <div
        role="group"
        aria-labelledby={labelId}
        aria-busy="true"
        className="flex flex-col gap-1 text-sm"
      >
        {header(<Skeleton width={96} height={16} className="ml-auto" />)}
        <Skeleton width="70%" />
        <p role="status" className="m-0 text-xs text-text-muted">
          {t("createPricing.estimateLoading")}
        </p>
      </div>
    );
  }

  // Server javob bermadi yoki tanlangan turga faol tarif yo'q — hozircha standart narx, forma ishlayveradi.
  if (state.status === "error" || !quote) {
    return (
      <div role="group" aria-labelledby={labelId} className="flex flex-col gap-1 text-sm">
        {header(price(standardPrice))}
        <IconLine icon={CircleX} role="alert">
          {t("createPricing.estimateFailed")}
        </IconLine>
        {notes}
        {state.status === "error" ? (
          <Button
            variant="secondary"
            size="sm"
            leftIcon={RefreshCw}
            className="mt-1 self-start"
            onClick={state.retry}
          >
            {t("retry", { ns: "common" })}
          </Button>
        ) : null}
      </div>
    );
  }

  const basis =
    quote.basis === "volume"
      ? t("createPricing.estimateBasisVolume")
      : quote.basis === "weight"
        ? t("createPricing.estimateBasisWeight")
        : null;
  const billable = basis
    ? t("createPricing.estimateBillable", { billable: kg(quote.billableKg), basis })
    : t("createPricing.estimateBillableNoBasis", { billable: kg(quote.billableKg) });
  const surcharge = quote.extra > 0;

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      aria-busy={state.isUpdating || undefined}
      className="flex flex-col gap-1 text-sm"
    >
      <div
        className={cx(
          "flex flex-col gap-1 transition-opacity duration-150 motion-reduce:transition-none",
          state.isUpdating && "opacity-60",
        )}
      >
        {header(price(estimateTotal(standardPrice, quote), surcharge))}
        <p className="m-0 text-xs text-text-muted">
          {surcharge
            ? t("createPricing.estimateBreakdown", {
                base: money(standardPrice, false),
                extra: money(quote.extra),
                extraKg: formatNumberLocalized(quote.extraKg, { language }),
                perKg: money(quote.perExtraKg, false),
              })
            : t("createPricing.estimateWithinStandard")}
        </p>
        <p className="m-0 text-xs text-text-subtle">{billable}</p>
        <p className="m-0 text-xs text-text-subtle">
          {t("createPricing.estimateWeights", {
            actual: kg(quote.actualKg),
            volumetric: kg(quote.volumetricKg),
          })}
        </p>
        {notes}
        {surcharge ? <p className="m-0 text-xs text-text-subtle">{charged}</p> : null}
      </div>
      {surcharge ? (
        <Badge className="mt-1 self-start">{t("createPricing.estimateBadge")}</Badge>
      ) : null}
    </div>
  );
};

export default memo(DeliveryPriceBlock);
