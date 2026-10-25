// dizayn-v2: superadmin-products-create, admin-products-create, superadmin-products-edit-dialog, admin-products-edit-dialog, superadmin-products-create-errors, admin-products-create-errors
import { useMemo } from "react";
import { Controller, useWatch, type Control, type FieldErrors } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { canManageDeliveryTariffs } from "../../../app/lib/access";
import {
  DeliveryQuoteList,
  MeasureWeights,
  toMeasureItem,
  useDeliveryPricingSettings,
  useDeliveryQuoteByTariff,
  VolumetricSwitch,
} from "../../../entities/delivery-pricing";
import { Field, TextInput } from "../../../shared/ui/primitives";
import {
  DIMENSION_FIELDS,
  validateDimension,
  validateOptionalWeight,
  validateWeight,
  type DimensionField,
  type ProductFormValues,
} from "../model/productMeasure";

export type ProductMeasureFieldsProps = {
  control: Control<ProductFormValues>;
  errors: FieldErrors<ProductFormValues>;
  /** Maydon `id` lari prefiksi (sahifa va oyna bir vaqtda ochiq bo'lishi mumkin emas, lekin testda aniq). */
  idPrefix: string;
  /** `list` — yaratish sahifasi (izohli qatorlar), `tiles` — tahrirlash oynasi (uchta katak). */
  quoteVariant: "list" | "tiles";
  disabled?: boolean;
  readOnly?: boolean;
  /** O'lchovsiz eski mahsulot tahriri — o'lchov ixtiyoriy (ega qarori 2026-10-24): yulduzcha yo'q, bo'sh saqlanadi. */
  optional?: boolean;
};

/**
 * «OG'IRLIK VA O'LCHAM» BO'LIMI — maket `*-products-create` / `*-products-edit-dialog` (va `*-create-errors`):
 * sarlavha + «Yetkazish narxi shu ma'lumotdan hisoblanadi»; «Og'irlik *» (kg, «Qadoq bilan, 0,1 kg aniqlikda»);
 * «O'lcham (U × K × B) *» — uchta maydon bir qatorda (telefonda ham), sm; «Hajmga qarab hisoblash» kaliti (sukut
 * yoqiq; o'chiq — maydonlar bloklanmaydi, izoh «faqat real og'irlikdan»); jonli «Hajmli vazn» / «Hisob vazni»;
 * «Taxminiy yetkazish narxi» (`POST /delivery/quote/by-tariff`, ~400 ms kutish, faqat o'lchov to'g'ri bo'lsa).
 * Maketdagi «Taklif» belgisi — annotatsiya, kodga ko'chirilmaydi.
 */
export const ProductMeasureFields = ({
  control,
  errors,
  idPrefix,
  quoteVariant,
  disabled,
  readOnly,
  optional = false,
}: ProductMeasureFieldsProps) => {
  const { t } = useTranslation(["products", "deliveryPricing"]);
  const dimensionsHintId = `${idPrefix}-dimensions-hint`;
  const [weight, length, width, height, volumetric] = useWatch({
    control,
    name: ["weight", "length", "width", "height", "volumetric"],
  });
  const item = useMemo(
    () => toMeasureItem({ weight, length, width, height, volumetric }),
    [height, length, volumetric, weight, width],
  );

  const quote = useDeliveryQuoteByTariff(item, { enabled: !disabled });
  // Chegara va yaxlitlash (izoh uchun) — sozlama faqat superadmin/admin'ga ochiq; boshqa rolda qisqa izoh.
  const canSeeSettings = useSelector(canManageDeliveryTariffs);
  const settingsQuery = useDeliveryPricingSettings({ enabled: canSeeSettings && item !== null });

  /** Xato kaliti (`products` fazosi) → joriy tildagi matn. */
  const errorText = (message: string | undefined) => (message ? t(message) : undefined);

  const dimensionLabel: Record<DimensionField, string> = {
    length: t("v2.measure.length"),
    width: t("v2.measure.width"),
    height: t("v2.measure.height"),
  };

  return (
    <>
      <hr className="m-0 h-px border-0 bg-border" />
      <div className="flex min-w-0 flex-col gap-1">
        <h3 className="m-0 text-sm font-semibold text-text">{t("v2.measure.title")}</h3>
        <span className="text-[13px] text-text-muted">{t("v2.measure.subtitle")}</span>
      </div>

      <Controller
        control={control}
        name="weight"
        rules={{ validate: optional ? validateOptionalWeight : validateWeight }}
        render={({ field }) => (
          <Field
            id={`${idPrefix}-weight`}
            label={t("v2.measure.weight")}
            required={!optional}
            hint={t("v2.measure.weightHint")}
            error={errorText(errors.weight?.message)}
          >
            <TextInput
              name={field.name}
              ref={field.ref}
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              inputMode="decimal"
              autoComplete="off"
              placeholder={t("v2.measure.weightPlaceholder")}
              suffix={t("v2.measure.unitKg")}
              disabled={disabled}
              readOnly={readOnly}
            />
          </Field>
        )}
      />

      <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
        <legend className="mb-2 p-0 text-[13px] font-semibold text-text">
          {t("v2.measure.dimensions")}
          {optional ? null : (
            <span aria-hidden="true" className="text-danger-fg">
              {" *"}
            </span>
          )}
        </legend>
        <div className="grid grid-cols-3 items-start gap-2">
          {DIMENSION_FIELDS.map((dimension) => (
            <Controller
              key={dimension}
              control={control}
              name={dimension}
              rules={{ validate: validateDimension(dimension, { optional }) }}
              render={({ field }) => (
                <Field
                  id={`${idPrefix}-${dimension}`}
                  label={<span className="font-normal text-text-muted">{dimensionLabel[dimension]}</span>}
                  error={errorText(errors[dimension]?.message)}
                >
                  <TextInput
                    name={field.name}
                    ref={field.ref}
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    inputMode="numeric"
                    autoComplete="off"
                    required
                    aria-describedby={dimensionsHintId}
                    suffix={t("v2.measure.unitCm")}
                    disabled={disabled}
                    readOnly={readOnly}
                  />
                </Field>
              )}
            />
          ))}
        </div>
        <span id={dimensionsHintId} className="text-xs text-text-muted">
          {volumetric ? t("v2.measure.dimensionsHint") : t("v2.measure.dimensionsHintOff")}
        </span>
      </fieldset>

      <Controller
        control={control}
        name="volumetric"
        render={({ field }) => (
          <VolumetricSwitch
            id={`${idPrefix}-volumetric`}
            checked={field.value}
            onChange={field.onChange}
            withDescription
            disabled={disabled || readOnly}
          />
        )}
      />

      <MeasureWeights item={item} />

      <DeliveryQuoteList
        state={quote}
        variant={quoteVariant}
        heading
        scope={quoteVariant === "list"}
        hint
        settings={settingsQuery.data ?? null}
        hintSuffix={canSeeSettings ? t("deliveryPricing:quote.hintTariffs") : null}
      />
      <hr className="m-0 h-px border-0 bg-border" />
    </>
  );
};
