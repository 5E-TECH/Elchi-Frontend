// dizayn-v2: superadmin-neworders-create-manual-step2, manager-new-orders-create-manual-step2, registrator-new-orders-create-step2, market-new-orders-create-manual, superadmin-neworders-create-manual-step2-existing-customer, market-new-orders-create-manual-existing-customer
import { memo, useEffect, useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, ChevronLeft, CircleCheck, Plus } from "lucide-react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useLogistics } from "../../../../entities/logistics/api/logisticsApi";
import { cx } from "../../../../shared/lib/cx";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../../shared/lib/formatMoney";
import { Badge, Button, buttonClasses, Card, Field, TextInput } from "../../../../shared/ui/primitives";
import { ORDER_AMOUNT_ERROR_KEYS, readOrderAmountInput } from "../../lib/orderAmountInput";
import { toApiList, type OrderCreateBlocker, type OrderCreateFormValues } from "../model/orderCreateForm";
import { computeItemsTotal, isItemsTotalTooLong, suggestedTotalDigits, tariffFor } from "../model/orderPricing";
import { useCanChooseOrderSource, useOrderSource } from "../model/useOrderSource";
import DeliveryPriceBlock from "./DeliveryPriceBlock";
import { useMarketTariffs } from "./useMarketTariffs";
import { useOrderCatalog } from "./useOrderCatalog";
import { useOrderDeliveryQuote } from "./useOrderDeliveryQuote";

type Step2SummaryProps = {
  /** Market roli: «Market» qatori yo'q, pastki tugma «Orqaga» (`/new-orders`). */
  isMarketRole: boolean;
  /** Majburiy maydonlar to'ldirilgan va mahsulot tanlangan — «Buyurtma yaratish» faol. */
  ready: boolean;
  /** So'rov ketmoqda: asosiy tugmada spinner, holat qatori «saqlanmoqda». */
  submitting: boolean;
  /** «Oldingi» — 1-qadamga (market saqlanadi). */
  onPrevious?: () => void;
  /** Market rolidagi «Orqaga» manzili. */
  backTo?: string;
  /**
   * MO-7 (OfRSoRUX): market operatori — «Operator» maydoni o'zi (`Siz — avtomatik yoziladi`), tahrirlanmaydi va
   * yuborilmaydi (backend operator ismini o'zi yozadi). Maket `market_operator-new-orders-create-manual`.
   */
  selfOperator?: { name: string | null };
  /**
   * IR2OHIiN: boshqa majburiy maydonlar to'liq, faqat shular yetishmaydi (`pendingOrderCreateBlockers`) — holat
   * qatori umumiy «Majburiy maydonlarni …» o'rniga aniq sababni yozadi: «Kamida bitta mahsulot tanlang» /
   * «Tumanni tanlang».
   */
  blockers?: readonly OrderCreateBlocker[];
};

/** `.el-divider`. */
const Divider = () => <hr className="m-0 h-px border-0 bg-border" />;

/**
 * BUYURTMA XULOSASI — yon ustundagi karta (maket `*-create-manual-step2`, `market-new-orders-create-manual`):
 * `dl` (Market · Mahsulotlar «3 ta · 4 dona» · Yetkazish · Tuman), «Umumiy summa *» (katta, so'm bilan),
 * «Operator», asosiy «Buyurtma yaratish» (`type="submit"`) + holat qatori, ostida «Oldingi» / «Orqaga».
 *
 * CS-B (maket `*-step2-existing-customer`):
 *  - «Yetkazish narxi» — `DeliveryPriceBlock`: o'lchovli mahsulot bo'lsa taxminiy narx (narx dvigateli DAqXPeSy,
 *    CS-E / 6NYcXvGy), aks holda market standart narxi; tariflar kelmaguncha, xatoda yoki tanlangan tur narxsiz
 *    bo'lsa standart qator yo'q;
 *  - «Umumiy summa» avto-taklifi: qo'lda yozilmaguncha maydon mahsulotlar narxidan to'ldiriladi («Mahsulotlar
 *    narxidan hisoblandi»); qo'lda yozilgach ustidan yozilmaydi — «Mahsulotlar bo'yicha: … · Qo'llash».
 */
const Step2Summary = ({
  isMarketRole,
  ready,
  submitting,
  onPrevious,
  backTo = "/new-orders",
  selfOperator,
  blockers = [],
}: Step2SummaryProps) => {
  const { t, i18n } = useTranslation(["orders", "common"]);
  const statusId = useId();
  /** Rad etilgan belgi sababi (kasr, minus, 12 xonadan uzun — D-17); o'chirilguncha yoki maydondan chiqilguncha. */
  const [amountHint, setAmountHint] = useState<string | undefined>();
  const {
    control,
    formState: { errors },
    setValue,
    getFieldState,
  } = useFormContext<OrderCreateFormValues>();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const money = (value: unknown) => formatMoneyLocalized(value, { language });

  const market = useWatch({ control, name: "market" });
  const items = useWatch({ control, name: "details.items" });
  const whereDeliver = useWatch({ control, name: "details.where_deliver" });
  const regionId = useWatch({ control, name: "customer.region_id" }) ?? "";
  const districtId = useWatch({ control, name: "customer.district_id" }) ?? "";

  // Tuman nomi — `Step2Combined` dagi bilan bir xil so'rov (react-query keshidan).
  const { useGetDistricts } = useLogistics();
  const { data: districts } = useGetDistricts(regionId);
  const districtName = useMemo(
    () =>
      toApiList<{ id: string | number; name?: string }>(districts).find((item) => String(item.id) === districtId)?.name,
    [districtId, districts],
  );

  const units = items.reduce((total, item) => total + (Number(item.quantity) || 0), 0);

  // 6kHnNH9j: «Qayerdan» — ombor nomi yoki «Toshkent HQ» (manba bloki bilan bir xil so'rov, keshdan).
  const canChooseSource = useCanChooseOrderSource();
  const source = useOrderSource(control, canChooseSource);
  const sourceText =
    source.effective === "WAREHOUSE"
      ? (source.preview?.warehouse?.name ?? "—")
      : source.effective === "HQ"
        ? t("fulfillment.source.hq")
        : "—";

  // «Umumiy summa» taklifi — mahsulotlar narxidan (katalog `Step2Combined` bilan bir xil so'rov, keshdan).
  const { findProduct } = useOrderCatalog(control);
  const totalPrice = useWatch({ control, name: "details.total_price" }) ?? "";
  const totalPriceAuto = useWatch({ control, name: "totalPriceAuto" });
  const itemsTotal = useMemo(() => computeItemsTotal(items, findProduct), [findProduct, items]);
  const suggestedDigits = suggestedTotalDigits(itemsTotal);
  // 12 xonadan uzun summa maydonga yozilmaydi — avto rejimda sababi izohda (qo'lda yozishdagi «juda katta»).
  const itemsTotalTooLong = isItemsTotalTooLong(itemsTotal);

  useEffect(() => {
    if (!totalPriceAuto || totalPrice === suggestedDigits) return;
    // Xato ko'rsatilgan bo'lsa (masalan «Summani kiriting») — to'ldirilgach darhol yo'qolsin.
    const { invalid } = getFieldState("details.total_price");
    setValue("details.total_price", suggestedDigits, { shouldDirty: true, shouldValidate: invalid });
  }, [getFieldState, setValue, suggestedDigits, totalPrice, totalPriceAuto]);

  const applySuggestedTotal = () => {
    setValue("totalPriceAuto", true);
    setValue("details.total_price", suggestedDigits, { shouldDirty: true, shouldValidate: true });
    setAmountHint(undefined);
  };
  const showSuggestion = !totalPriceAuto && suggestedDigits !== "" && totalPrice !== suggestedDigits;
  const unpricedNote =
    itemsTotal.priced > 0 && itemsTotal.unpriced > 0
      ? t("createPricing.unpricedNote", {
          count: itemsTotal.unpriced,
          value: formatNumberLocalized(itemsTotal.unpriced, { language }),
        })
      : null;
  // Izoh + «Narxsiz N ta …» — tinish belgisi lokal faylda (`createPricing.hintWithNote`).
  const withUnpricedNote = (hint: string) =>
    unpricedNote ? t("createPricing.hintWithNote", { hint, note: unpricedNote }) : hint;
  const totalHint =
    amountHint ??
    (totalPriceAuto && itemsTotalTooLong ? (
      t(ORDER_AMOUNT_ERROR_KEYS.tooLong)
    ) : totalPriceAuto && totalPrice ? (
      <span className="inline-flex items-start gap-1.5">
        <Check size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
        <span>{withUnpricedNote(t("createPricing.autoTotalHint"))}</span>
      </span>
    ) : (
      withUnpricedNote(t("createTotalHint"))
    ));

  // «Yetkazish narxi» — vaqtincha standart narx (CS-B 5-band, ega tasdig'i kutilmoqda). Tanlangan turning narxi
  // bo'lmasa qator yo'q: maketning «Standart narxsiz market» holatida faqat kartalar va ogohlantirish chizilgan.
  const tariffState = useMarketTariffs(control);
  const deliveryPrice = tariffState.status === "ready" ? tariffFor(tariffState.tariffs, whereDeliver) : null;
  // 6NYcXvGy: o'lchovli mahsulotlar bo'lsa — server hisobidagi taxminiy narx (standart narx o'rnida).
  const deliveryEstimate = useOrderDeliveryQuote(control);

  // IR2OHIiN: faqat mahsulot va/yoki tuman yetishmasa — tugma nega o'chiqligi aniq yoziladi (backend ham 400 beradi).
  const blockedText =
    blockers.length === 2
      ? t("createBlockedItemsDistrict")
      : blockers[0] === "items"
        ? t("validationSelectProduct")
        : blockers[0] === "district"
          ? t("validationDistrict")
          : t("fillRequiredFields");
  const statusText = submitting ? t("createSubmitting") : ready ? t("orderReadyMessage") : blockedText;

  return (
    <Card title={t("createSummaryTitle")} bodyClassName="flex flex-col gap-4">
      <dl className="m-0 grid grid-cols-[minmax(120px,40%)_1fr] items-center gap-x-4 gap-y-2.5 text-sm">
        {!isMarketRole ? (
          <>
            <dt className="text-text-muted">{t("createSummaryMarket")}</dt>
            <dd className="m-0 min-w-0 truncate font-semibold text-text">{market?.name ?? "—"}</dd>
          </>
        ) : null}
        <dt className="text-text-muted">{t("createSummaryProducts")}</dt>
        <dd className="m-0 min-w-0 font-semibold text-text">
          {items.length > 0 ? t("createSummaryProductsValue", { count: items.length, units }) : "—"}
        </dd>
        <dt className="text-text-muted">{t("createSummaryDelivery")}</dt>
        <dd className="m-0 min-w-0">
          <Badge>{whereDeliver === "address" ? t("deliveryToHome") : t("deliveryToCenter")}</Badge>
        </dd>
        <dt className="text-text-muted">{t("createSummaryDistrict")}</dt>
        <dd className="m-0 min-w-0 truncate font-semibold text-text">{districtName ?? "—"}</dd>
        {canChooseSource ? (
          <>
            <dt className="text-text-muted">{t("fulfillment.source.summary")}</dt>
            <dd className="m-0 min-w-0 truncate font-semibold text-text" data-testid="summary-source">
              {sourceText}
            </dd>
          </>
        ) : null}
      </dl>

      {/* `text-sm` — maketdagi `.el` asosi (14 px): summa `dl` qiymatlari bilan bir o'lchamda, «Umumiy summa» bilan
          raqobatlashmaydi. O'lchovli mahsulot bo'lsa — taxminiy narx (6NYcXvGy), aks holda standart narx (CS-B). */}
      <DeliveryPriceBlock isMarketRole={isMarketRole} standardPrice={deliveryPrice} estimate={deliveryEstimate} />

      <Divider />

      <Controller
        control={control}
        name="details.total_price"
        render={({ field }) => (
          <Field
            id="details.total_price"
            label={t("totalPrice")}
            required
            hint={totalHint}
            hintLive
            error={errors.details?.total_price?.message}
          >
            <TextInput
              mode="money"
              size="lg"
              name={field.name}
              placeholder="0"
              value={field.value}
              // Xom matn tekshiriladi: «12.5» jimgina 125 bo'lmaydi, «-» va 12 xonadan uzun son rad etiladi.
              onChange={(event) => {
                const result = readOrderAmountInput(event.target.value, i18n.resolvedLanguage ?? i18n.language);
                if (result.error) {
                  setAmountHint(t(ORDER_AMOUNT_ERROR_KEYS[result.error]));
                  return;
                }
                if (result.digits.length < (field.value ?? "").length) setAmountHint(undefined);
                // Qo'lda yozildi — avto-taklif endi maydon ustidan yozmaydi (faqat «Qo'llash» qatori).
                if (result.digits !== (field.value ?? "")) setValue("totalPriceAuto", false);
                field.onChange(result.digits);
              }}
              onBlur={() => {
                setAmountHint(undefined);
                field.onBlur();
              }}
              ref={field.ref}
            />
            {showSuggestion ? (
              <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-[13px]">
                <span className="text-text-muted">{t("createPricing.byProducts")}</span>
                <span className="font-semibold whitespace-nowrap text-text">{money(itemsTotal.total)}</span>
                <span aria-hidden="true" className="text-text-subtle">
                  ·
                </span>
                {/* Maket `.el-btn-link` — 14 px (`md`); havola balandligi BOX dan emas, telefonda 44 px. */}
                <Button
                  variant="link"
                  aria-label={t("createPricing.applyLabel", { amount: money(itemsTotal.total) })}
                  onClick={applySuggestedTotal}
                >
                  {t("createPricing.apply")}
                </Button>
              </div>
            ) : null}
          </Field>
        )}
      />

      {selfOperator ? (
        <Field id="details.operator" label={t("operator")} hint={t("operatorCreate.operatorAuto")}>
          <TextInput value={selfOperator.name?.trim() || t("operatorCreate.operatorYou")} readOnly />
        </Field>
      ) : (
        <Controller
          control={control}
          name="details.operator"
          render={({ field }) => (
            <Field id="details.operator" label={t("operator")} error={errors.details?.operator?.message}>
              <TextInput
                name={field.name}
                placeholder={t("operatorPlaceholder")}
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                ref={field.ref}
              />
            </Field>
          )}
        />
      )}

      <Divider />

      <div className="flex flex-col gap-2">
        <Button
          type="submit"
          fullWidth
          leftIcon={Plus}
          disabled={!ready && !submitting}
          loading={submitting}
          loadingText={t("submitting", { ns: "common" })}
          aria-describedby={statusId}
        >
          {t("create")}
        </Button>
        <p
          id={statusId}
          role="status"
          className={cx(
            "flex items-center justify-center gap-1.5 text-center text-[13px]",
            ready && !submitting ? "font-semibold text-success-fg" : "text-text-muted",
          )}
        >
          {ready && !submitting ? <CircleCheck size={16} aria-hidden="true" className="shrink-0" /> : null}
          {statusText}
        </p>
        {isMarketRole ? (
          <Link to={backTo} className={buttonClasses({ variant: "secondary", fullWidth: true })}>
            <ArrowLeft size={16} aria-hidden="true" />
            {t("back", { ns: "common" })}
          </Link>
        ) : (
          <Button variant="secondary" fullWidth leftIcon={ChevronLeft} onClick={onPrevious}>
            {t("previous", { ns: "common" })}
          </Button>
        )}
      </div>
    </Card>
  );
};

export default memo(Step2Summary);
