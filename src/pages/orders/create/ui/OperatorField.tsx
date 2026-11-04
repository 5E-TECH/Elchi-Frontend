// dizayn-v2: (maket yo'q) superadmin-neworders-create-manual-step2
import { memo, useEffect, useMemo } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useSelectableMarketOperators } from "../../../../entities/market-operator";
import { Field, Select, TextInput, type SelectOption } from "../../../../shared/ui/primitives";
import type { OrderCreateFormValues } from "../model/orderCreateForm";

type OperatorFieldProps = {
  /** Market roli: ro'yxat — o'z marketi operatorlari (server tokendan oladi, `market_id` yuborilmaydi). */
  isMarketRole: boolean;
};

/** «Tanlanmagan» — bo'sh qiymatli variant: `Select` uni sukut deb ko'rsatadi, × tanlovni shunga qaytaradi. */
const NONE = "";

/**
 * «OPERATOR» — buyurtma xulosasidagi maydon (BeePost `operator_id` tanlovi kabi; maket yo'q — eng yaqini
 * `*-create-manual-step2` dagi «Operator» maydoni). Ega qoidasi: admin ma'lumotnoma qiymatini yozmaydi — forma
 * taklif qiladi.
 *  - marketda faol operator bor — `Select` («Tanlanmagan» sukut + operatorlar): tanlansa `operator_id` va
 *    `operator` (uning ismi) yuboriladi; «Tanlanmagan» da ostida erkin matn («Ro'yxatda yo'q operator»);
 *  - ro'yxat yuklanmaguncha, bo'sh yoki yuklanmasa — avvalgi erkin matn maydoni (yuklanmasa izoh bilan), faqat
 *    `operator` matni ketadi.
 * Market operatori roli bu maydonni ko'rmaydi (`Step2Summary` → `selfOperator`).
 */
const OperatorField = ({ isMarketRole }: OperatorFieldProps) => {
  const { t } = useTranslation("orders");
  const {
    control,
    formState: { errors },
    setValue,
    clearErrors,
  } = useFormContext<OrderCreateFormValues>();
  const market = useWatch({ control, name: "market" });
  const operatorId = useWatch({ control, name: "details.operator_id" }) ?? NONE;
  const operatorsQuery = useSelectableMarketOperators(market ? String(market.id) : null, {
    ownMarket: isMarketRole,
  });
  const operators = operatorsQuery.data;
  const loadFailed = operatorsQuery.isError && !operators;
  const hasList = (operators?.length ?? 0) > 0;

  // Tanlangan operator joriy ro'yxatda yo'q (market almashdi, operator o'chirildi / bloklandi yoki ro'yxat
  // yuklanmadi) — tanlov va undan olingan ism tozalanadi: begona yoki eskirgan `operator_id` yuborilmaydi.
  useEffect(() => {
    if (!operatorId || operatorsQuery.isPending) return;
    if (operators?.some((item) => item.id === operatorId)) return;
    setValue("details.operator_id", NONE, { shouldDirty: true });
    setValue("details.operator", "", { shouldDirty: true });
  }, [operatorId, operators, operatorsQuery.isPending, setValue]);

  const options = useMemo<SelectOption[]>(
    () => [
      { value: NONE, label: t("operatorSelect.none") },
      ...(operators ?? []).map((item) => ({ value: item.id, label: item.name })),
    ],
    [operators, t],
  );

  // Kalitlar: ro'yxat kelganda React erkin matn `Controller` ini `details.operator_id` ga qayta nomlab ishlatmasin —
  // aks holda react-hook-form `details.operator` ni ro'yxatdan o'chiradi (qiymat `undefined` bo'lib qoladi).
  const freeText = (label: string, hint?: string) => (
    <Controller
      key="operator-text"
      control={control}
      name="details.operator"
      render={({ field }) => (
        <Field id="details.operator" label={label} hint={hint} error={errors.details?.operator?.message}>
          <TextInput
            personName
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
  );

  if (!hasList) return freeText(t("operator"), loadFailed ? t("operatorSelect.loadFailed") : undefined);

  return (
    <>
      <Controller
        key="operator-id"
        control={control}
        name="details.operator_id"
        render={({ field }) => (
          <Field
            id="details.operator_id"
            label={t("operator")}
            labelAs="span"
            hint={field.value ? t("operatorSelect.pickedHint") : undefined}
            error={errors.details?.operator_id?.message}
          >
            <Select
              name={field.name}
              options={options}
              value={field.value || NONE}
              onChange={(next) => {
                const id = next ?? NONE;
                clearErrors("details.operator_id");
                field.onChange(id);
                // Chekda va buyurtmada — tanlangan ism; «Tanlanmagan» — ism tozalanadi (BeePost kabi), pastda yoziladi.
                setValue("details.operator", operators?.find((item) => item.id === id)?.name ?? "", {
                  shouldDirty: true,
                });
              }}
              onBlur={field.onBlur}
              ref={field.ref}
            />
          </Field>
        )}
      />
      {operatorId ? null : freeText(t("operatorSelect.otherLabel"))}
    </>
  );
};

export default memo(OperatorField);
