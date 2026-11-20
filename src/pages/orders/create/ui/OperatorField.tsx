// dizayn-v2: (maket yo'q) superadmin-neworders-create-manual-step2
import { memo, useEffect, useMemo, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { suggestOperator, useSelectableMarketOperators } from "../../../../entities/market-operator";
import { Button, Field, Select, TextInput, type SelectOption } from "../../../../shared/ui/primitives";
import type { OrderCreateFormValues } from "../model/orderCreateForm";

type OperatorFieldProps = {
  /** Market roli: ro'yxat — o'z marketi operatorlari (server tokendan oladi, `market_id` yuborilmaydi). */
  isMarketRole: boolean;
};

/** «Tanlanmagan» — bo'sh qiymatli variant: `Select` uni sukut deb ko'rsatadi, × tanlovni shunga qaytaradi. */
const NONE = "";

/** Maydon ostidagi sariq ogohlantirish (AI kartasidagi `WarningHint` bilan bir xil ko'rinish). */
const WarningHint = ({ children }: { children: ReactNode }) => (
  <span className="flex items-start gap-1.5 text-[13px] font-semibold text-warning-fg">
    <TriangleAlert size={16} aria-hidden="true" className="mt-px shrink-0" />
    <span className="min-w-0">{children}</span>
  </span>
);

/**
 * «OPERATOR» — buyurtma xulosasidagi maydon (BeePost `operator_id` tanlovi kabi; maket yo'q — eng yaqini
 * `*-create-manual-step2` dagi «Operator» maydoni). Ega qoidasi: admin ma'lumotnoma qiymatini yozmaydi — forma
 * taklif qiladi.
 *  - marketda faol operator bor — `Select` («Tanlanmagan» sukut + operatorlar): tanlansa `operator_id` va
 *    `operator` (uning ismi) yuboriladi; «Tanlanmagan» da ostida erkin matn («Ro'yxatda yo'q operator»);
 *  - ro'yxat yuklanmaguncha, bo'sh yoki yuklanmasa — avvalgi erkin matn maydoni (yuklanmasa izoh bilan), faqat
 *    `operator` matni ketadi.
 *  - 2026-11-20: erkin matnda yozilgan ism ro'yxatdagi operatorga mos kelsa — «Tanlash» TAKLIFI (avtomatik emas);
 *    mos kelmasa — «komissiya yozilmaydi» ogohlantirishi. Ilgari ism yozib qo'yilsa buyurtma `operator_id` siz
 *    yaratilib, sotuvda operatorga komissiya yozilmasdi va bu hech qayerda ko'rinmasdi.
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
  const typedOperator = useWatch({ control, name: "details.operator" });
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

  /** Ro'yxatdan tanlash: `operator_id` + ismi (chekda va buyurtmada); «Tanlanmagan» — ism tozalanadi (BeePost kabi). */
  const pickOperator = (id: string) => {
    clearErrors("details.operator_id");
    setValue("details.operator_id", id, { shouldDirty: true });
    setValue("details.operator", operators?.find((item) => item.id === id)?.name ?? "", { shouldDirty: true });
  };

  // Erkin matnda yozilgan ism ro'yxatdagi BITTA operatorga mos kelsa — taklif; tanlanmaguncha `operator_id` yo'q.
  const suggestion = hasList && !operatorId ? suggestOperator(typedOperator, operators) : null;
  const textOnly = hasList && !operatorId && !suggestion && Boolean(typedOperator?.trim());

  // Kalitlar: ro'yxat kelganda React erkin matn `Controller` ini `details.operator_id` ga qayta nomlab ishlatmasin —
  // aks holda react-hook-form `details.operator` ni ro'yxatdan o'chiradi (qiymat `undefined` bo'lib qoladi).
  const freeText = (label: string, hint?: ReactNode, extra?: ReactNode) => (
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
          {extra}
        </Field>
      )}
    />
  );

  if (!hasList) return freeText(t("operator"), loadFailed ? t("operatorSelect.loadFailed") : undefined);

  const suggestionRow = suggestion ? (
    <div className="flex flex-wrap items-center gap-2 rounded-[10px] bg-action-soft px-2.5 py-2 text-[13px] font-semibold text-text">
      <span className="min-w-0 flex-[1_1_160px]">{t("operatorSelect.suggest", { name: suggestion.name })}</span>
      <Button
        size="sm"
        variant="secondary"
        aria-label={t("operatorSelect.suggestPickAria", { name: suggestion.name })}
        onClick={() => pickOperator(suggestion.id)}
      >
        {t("operatorSelect.suggestPick")}
      </Button>
    </div>
  ) : null;

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
              onChange={(next) => pickOperator(next ?? NONE)}
              onBlur={field.onBlur}
              ref={field.ref}
            />
          </Field>
        )}
      />
      {operatorId
        ? null
        : freeText(
            t("operatorSelect.otherLabel"),
            // Ism yozilgan, lekin ro'yxatdan tanlanmagan — buyurtma operatorsiz, komissiya yozilmaydi.
            textOnly ? <WarningHint>{t("operatorSelect.textOnly")}</WarningHint> : undefined,
            suggestionRow,
          )}
    </>
  );
};

export default memo(OperatorField);
