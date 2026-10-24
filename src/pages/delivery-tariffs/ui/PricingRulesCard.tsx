// dizayn-v2: superadmin-regions-delivery-tariffs, admin-regions-delivery-tariffs
import { useEffect, useId, useMemo } from "react";
import { Info, Lock, Scale } from "lucide-react";
import { Controller, useForm, useWatch, type Control, type FieldErrors } from "react-hook-form";
import type { UseQueryResult } from "@tanstack/react-query";
import {
  computeExtraKg,
  computeTariffTotal,
  formatKgValue,
  useUpdatePricingSettings,
  type DeliveryPricingSettings,
  type DeliveryTariffsData,
} from "../../../entities/delivery-pricing";
import { cx } from "../../../shared/lib/cx";
import { notify } from "../../../shared/lib/notify";
import {
  Button,
  Card,
  ErrorState,
  Field,
  QueryBoundary,
  SkeletonLines,
  TextInput,
  TONE_SOFT,
} from "../../../shared/ui/primitives";
import {
  parseRuleValue,
  RULES,
  toRulesForm,
  toSettingsPatch,
  validateRule,
  type RulesField,
  type RulesFormValues,
} from "../model/rulesForm";
import { CardHead } from "./CardHead";
import { useTariffText } from "./useTariffText";

/** Misoldagi hisob vazni va tarif (maket: 3,4 kg, «Markazgacha»). */
const EXAMPLE_KG = 3.4;
const EXAMPLE_TARIFF = "center" as const;

export type PricingRulesCardProps = {
  query: Pick<UseQueryResult<DeliveryPricingSettings | null>, "data" | "isLoading" | "isError" | "error" | "refetch">;
  tariffs: DeliveryTariffsData | undefined;
};

/**
 * «HISOB QOIDALARI — QO'SHIMCHA HAQ QACHON BOSHLANADI» (maket `superadmin-regions-delivery-tariffs`): birinchi
 * navbatda «Asosiy narxga kiradigan og'irlik» (`first_kg_included` — qo'shimcha haq chegarasi) va «Minimal hisob
 * vazni», jonli misol (3,4 kg «Markazgacha»: hozirgi qiymat va taqqoslash), so'ng qadam, yaxlitlash, tezkor
 * ko'paytiruvchi, pickup va «Hajmli vazn bo'luvchisi» (doimiy, faqat ko'rsatiladi). «Qoidalarni saqlash» —
 * `PATCH /delivery/pricing-settings`, faqat o'zgargan maydonlar; «Bekor qilish» — saqlangan qiymatlarga qaytaradi.
 */
export const PricingRulesCard = ({ query, tariffs }: PricingRulesCardProps) => {
  const { t } = useTariffText();
  const titleId = useId();
  return (
    <Card as="section" padding="none" aria-labelledby={titleId}>
      <CardHead id={titleId} icon={Scale} title={t("page.rules.title")} description={t("page.rules.description")} />
      <QueryBoundary
        query={query}
        loadingLabel={t("page.rules.loading")}
        loading={<SkeletonLines lines={6} className="p-5" />}
        isEmpty={() => false}
        error={(error, retry) => <ErrorState error={error} title={t("page.rules.loadFailed")} onRetry={retry} />}
      >
        {(settings) => <RulesForm settings={settings} tariffs={tariffs} />}
      </QueryBoundary>
    </Card>
  );
};

const RulesForm = ({ settings, tariffs }: { settings: DeliveryPricingSettings; tariffs: DeliveryTariffsData | undefined }) => {
  const { t, language, number, saveError } = useTariffText();
  const update = useUpdatePricingSettings();
  const saved = useMemo(() => toRulesForm(settings, language), [language, settings]);
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty, dirtyFields },
  } = useForm<RulesFormValues>({ defaultValues: saved });

  // Server qiymati o'zgarsa (saqlangach, boshqa admin) — tahrir qilinmagan forma yangilanadi.
  useEffect(() => {
    reset(saved, { keepDirtyValues: true });
  }, [reset, saved]);

  const busy = update.isPending;
  const submit = handleSubmit(async (values) => {
    const body = toSettingsPatch(values, dirtyFields);
    if (busy) return;
    if (Object.keys(body).length === 0) {
      notify.info(t("page.rules.noChanges"));
      return;
    }
    try {
      const next = await update.mutateAsync(body);
      if (next) reset(toRulesForm(next, language));
      notify.success(t("page.rules.success"), { description: t("page.rules.successDescription") });
    } catch (error) {
      notify.error(t("page.rules.error"), { description: saveError(error) });
    }
  });

  return (
    <form onSubmit={submit} noValidate>
      <div className="flex flex-col gap-5 p-5 max-md:p-4">
        <div className="flex min-w-0 flex-wrap items-start gap-4">
          <RuleField control={control} errors={errors} field="firstKg" label={t("page.rules.firstKg")} hint={t("page.rules.firstKgHint")} suffix={t("page.rules.unitKg")} required readOnly={busy} className="flex-[1_1_260px]" />
          <RuleField control={control} errors={errors} field="minKg" label={t("page.rules.minKg")} hint={t("page.rules.minKgHint")} suffix={t("page.rules.unitKg")} required readOnly={busy} className="flex-[1_1_200px]" />
        </div>
        <RulesExample control={control} settings={settings} tariffs={tariffs} />
        <div className="flex min-w-0 flex-wrap items-start gap-4">
          <RuleField control={control} errors={errors} field="step" label={t("page.rules.step")} suffix={t("page.rules.unitKg")} readOnly={busy} className="flex-[1_1_200px]" />
          <RuleField control={control} errors={errors} field="roundTo" label={t("page.rules.roundTo")} hint={t("page.rules.roundToHint")} mode="money" readOnly={busy} className="flex-[1_1_200px]" />
          <RuleField control={control} errors={errors} field="express" label={t("page.rules.express")} hint={t("page.rules.expressHint")} suffix={t("page.rules.unitTimes")} readOnly={busy} className="flex-[1_1_200px]" />
        </div>
        <div className="flex min-w-0 flex-wrap items-start gap-4">
          <RuleField control={control} errors={errors} field="pickupFee" label={t("page.rules.pickup")} hint={t("page.rules.pickupHint")} mode="money" readOnly={busy} className="flex-[1_1_200px]" />
          <RuleField control={control} errors={errors} field="pickupFree" label={t("page.rules.pickupFree")} hint={t("page.rules.pickupFreeHint")} mode="number" suffix={t("page.rules.pickupFreeUnit")} readOnly={busy} className="flex-[1_1_200px]" />
          <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-1.5">
            <span id="rules-divisor-label" className="text-[13px] font-semibold text-text">
              {t("page.rules.divisor")}
            </span>
            <span
              aria-labelledby="rules-divisor-label"
              className="flex min-h-10 items-center gap-2 rounded-[10px] bg-sunken px-3.5 max-md:min-h-11"
            >
              <Lock size={16} aria-hidden="true" className="shrink-0 text-text-subtle" />
              <span className="font-semibold text-text">{number(settings.volumetricDivisor)}</span>
            </span>
            <span className="text-xs text-text-muted">
              {t("page.rules.divisorHint", { divisor: number(settings.volumetricDivisor) })}
            </span>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-3 border-t border-border px-5 py-4 max-md:px-4">
        <Button variant="secondary" onClick={() => reset(saved)} disabled={busy || !isDirty}>
          {t("page.rules.cancel")}
        </Button>
        <Button type="submit" loading={busy} loadingText={t("page.rules.saving")}>
          {t("page.rules.save")}
        </Button>
      </div>
    </form>
  );
};

type RuleFieldProps = {
  control: Control<RulesFormValues>;
  errors: FieldErrors<RulesFormValues>;
  field: RulesField;
  label: string;
  hint?: string;
  suffix?: string;
  mode?: "text" | "money" | "number";
  required?: boolean;
  readOnly?: boolean;
  className?: string;
};

const RuleField = ({ control, errors, field, label, hint, suffix, mode = "text", required, readOnly, className }: RuleFieldProps) => {
  const { t, number } = useTariffText();
  const rule = RULES[field];
  const message = errors[field]?.message;
  return (
    <Controller
      control={control}
      name={field}
      rules={{ validate: validateRule(field) }}
      render={({ field: input }) => (
        <Field
          id={`rules-${field}`}
          label={label}
          required={required}
          hint={hint}
          error={message ? t(message, { min: number(rule.min), max: rule.max === undefined ? "" : number(rule.max) }) : undefined}
          className={cx("min-w-0", className)}
        >
          <TextInput
            mode={mode}
            name={input.name}
            ref={input.ref}
            value={input.value}
            onValueChange={input.onChange}
            onBlur={input.onBlur}
            inputMode={mode === "text" ? "decimal" : undefined}
            suffix={suffix}
            autoComplete="off"
            readOnly={readOnly}
          />
        </Field>
      )}
    />
  );
};

/**
 * Jonli misol (`.el-alert.el-tone-info`): «Misol: hisob vazni 3,4 kg, «Markazgacha»» — formadagi chegara bilan
 * hisob; ikkinchi gap — saqlangan chegara (o'zgartirilgan bo'lsa) yoki chegara +1 kg qilinsa nima bo'lishi.
 */
const RulesExample = ({
  control,
  settings,
  tariffs,
}: {
  control: Control<RulesFormValues>;
  settings: DeliveryPricingSettings;
  tariffs: DeliveryTariffsData | undefined;
}) => {
  const { t, language, number, money, name } = useTariffText();
  const firstInput = useWatch({ control, name: "firstKg" });
  const tariff = tariffs?.current[EXAMPLE_TARIFF];
  const first = parseRuleValue(firstInput);
  if (!tariff || first === null || first > 1000) return null;

  const formula = (threshold: number) => {
    const extra = computeExtraKg(EXAMPLE_KG, threshold);
    const total = money(
      computeTariffTotal({
        billableKg: EXAMPLE_KG,
        basePrice: tariff.basePrice,
        extraPerKg: tariff.extraPerKg,
        firstKgIncluded: threshold,
        roundTo: settings.roundTo,
      }),
    );
    return extra > 0
      ? t("page.rules.formula", { base: number(tariff.basePrice), extra: number(extra), perKg: number(tariff.extraPerKg), total })
      : total;
  };
  const kg = (value: number) => formatKgValue(value, language);
  const extra = computeExtraKg(EXAMPLE_KG, first);
  const lead =
    extra > 0
      ? t("page.rules.exampleExtra", {
          first: kg(first),
          rest: kg(Math.round((EXAMPLE_KG - first) * 1000) / 1000),
          extra: number(extra),
          formula: formula(first),
        })
      : t("page.rules.exampleIncluded", { billable: kg(EXAMPLE_KG), formula: formula(first) });
  const savedFirst = settings.firstKgIncluded;
  const tail =
    Math.abs(savedFirst - first) > 1e-9
      ? t("page.rules.exampleSaved", { first: kg(savedFirst), formula: formula(savedFirst) })
      : t("page.rules.exampleAlt", { first: kg(first + 1), formula: formula(first + 1) });

  return (
    <div role="status" className={cx("flex min-w-0 items-start gap-3 rounded-xl px-4 py-3 text-sm", TONE_SOFT.info)}>
      <Info size={18} aria-hidden="true" className="mt-px shrink-0" />
      <div className="flex min-w-0 flex-col gap-0.5 text-text">
        <span className="font-bold">{t("page.rules.exampleTitle", { billable: kg(EXAMPLE_KG), tariff: name(EXAMPLE_TARIFF) })}</span>
        <span>{`${lead} ${tail}`}</span>
      </div>
    </div>
  );
};
