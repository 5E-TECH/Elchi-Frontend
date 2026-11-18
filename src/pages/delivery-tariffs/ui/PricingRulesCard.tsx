// dizayn-v2: superadmin-regions-delivery-tariffs, admin-regions-delivery-tariffs
import { useEffect, useId, useMemo } from "react";
import { ArrowRight, Check, Globe, History, Info, Lock, Scale, Zap } from "lucide-react";
import { Controller, useForm, useWatch, type Control, type FieldErrors } from "react-hook-form";
import type { UseQueryResult } from "@tanstack/react-query";
import {
  computeExtraKg,
  computeMeasureWeights,
  computeTariffTotal,
  formatKgValue,
  meetsVolumetricThreshold,
  toWeightRules,
  useUpdatePricingSettings,
  type DeliveryMeasureItem,
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
  useConfirm,
} from "../../../shared/ui/primitives";
import {
  changeImpact,
  diffRules,
  parseRuleValue,
  RULES,
  toPatchBody,
  toRulesForm,
  validateRule,
  type RuleChange,
  type RulesField,
  type RulesFormValues,
} from "../model/rulesForm";
import { CardHead } from "./CardHead";
import { useTariffText } from "./useTariffText";

/** Misoldagi hisob vazni va tarif (maket: 3,4 kg, «Markazgacha»). */
const EXAMPLE_KG = 3.4;
const EXAMPLE_TARIFF = "center" as const;

/**
 * Hajm chegarasi misoli (ega, 2026-10-25): kichik quti 20 × 20 × 20 sm, 0,5 kg (hajmli 1,6 kg) va kalkulyator
 * namunasi 50 × 35 × 20 sm, 0,8 kg (hajmli 7,0 kg) — chegara 3 kg da birinchisi og'irlik, ikkinchisi hajm bo'yicha.
 */
const VOLUMETRIC_SAMPLES: readonly DeliveryMeasureItem[] = [
  { weight_kg: 0.5, length_cm: 20, width_cm: 20, height_cm: 20, volumetric_enabled: true },
  { weight_kg: 0.8, length_cm: 50, width_cm: 35, height_cm: 20, volumetric_enabled: true },
];

export type PricingRulesCardProps = {
  query: Pick<UseQueryResult<DeliveryPricingSettings | null>, "data" | "isLoading" | "isError" | "error" | "refetch">;
  tariffs: DeliveryTariffsData | undefined;
};

/**
 * «HISOB QOIDALARI — QO'SHIMCHA HAQ QACHON BOSHLANADI» (maket `superadmin-regions-delivery-tariffs`): birinchi
 * navbatda «Asosiy narxga kiradigan og'irlik» (`first_kg_included` — qo'shimcha haq chegarasi) va «Minimal hisob
 * vazni», jonli misol (3,4 kg «Markazgacha»: hozirgi qiymat va taqqoslash), so'ng qadam, yaxlitlash, tezkor
 * ko'paytiruvchi, pickup va «Hajmli vazn bo'luvchisi» (doimiy, faqat ko'rsatiladi), oxirida «Hajm bo'yicha hisoblash
 * chegarasi» (`volumetric_from_kg`, ega 2026-10-25; maketda yo'q — eng yaqini shu kartaning maydon + misol naqshi)
 * jonli misol bilan. «Qoidalarni saqlash» — `PATCH /delivery/pricing-settings`, faqat o'zgargan maydonlar; «Bekor
 * qilish» — saqlangan qiymatlarga qaytaradi.
 *
 * B0ILd7YI: «Qoidalarni saqlash» faqat tasdiq oynasi orqali (maket yo'q — eng yaqini
 * `superadmin-users-market-responsibles-settings-confirm`): «eski → yangi» qatorlari, «darhol kuchga kiradi», «sayt
 * kalkulyatori ham o'zgaradi». Saqlash oyna ichida — yuklanishda tugmalar qulf, xato oynada (qayta bosish o'sha
 * tanani yuboradi; backend o'zgarishsiz PATCH'da yangi versiya yozmaydi). Oxirida «Sotuvdagi narx chegaralari» —
 * `min_delivery_price` va `extra_cost_limit_amount` (backend migratsiya 183; maket yo'q — shu kartaning maydon naqshi).
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
  const { t, language, number, saveError, ruleValue } = useTariffText();
  const update = useUpdatePricingSettings();
  const confirm = useConfirm();
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
  const labelOf: Record<RulesField, string> = {
    firstKg: t("page.rules.firstKg"),
    minKg: t("page.rules.minKg"),
    step: t("page.rules.step"),
    roundTo: t("page.rules.roundTo"),
    express: t("page.rules.express"),
    pickupFee: t("page.rules.pickup"),
    pickupFree: t("page.rules.pickupFree"),
    volumetricFrom: t("page.rules.volumetricFrom"),
    minPrice: t("page.rules.minPrice"),
    extraLimit: t("page.rules.extraLimit"),
  };
  // «Bobur Xolmatov → Nilufar Rashidova» naqshi (maket `*-market-responsibles-settings-confirm`); ekran o'quvchiga
  // o'q o'rniga to'liq gap: «1,0 kg edi, 2,0 kg bo'ladi».
  const changeValue = (change: RuleChange) => {
    const from = ruleValue(change.field, change.from);
    const to = ruleValue(change.field, change.to);
    return (
      <span className="text-sm">
        <span aria-hidden="true" className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span className="text-text-muted">{from}</span>
          <ArrowRight size={14} className="shrink-0 text-text-subtle" />
          <span className="font-semibold text-text">{to}</span>
        </span>
        <span className="sr-only">{t("page.rules.confirm.change", { from, to })}</span>
      </span>
    );
  };

  const submit = handleSubmit(async (values) => {
    if (busy) return;
    // Faqat soni haqiqatan o'zgargan maydonlar («1,0» → «1» — o'zgarish emas).
    const changes = diffRules(values, dirtyFields, settings);
    if (changes.length === 0) {
      notify.info(t("page.rules.noChanges"));
      return;
    }
    // Tana bosish paytida qotadi: xatodan keyin oynada qayta bosish aynan shu qiymatlarni yuboradi.
    const body = toPatchBody(changes);
    const impact = changeImpact(changes);
    const confirmed = await confirm({
      title: t("page.rules.confirm.title"),
      description: t("page.rules.confirm.description", { count: changes.length }),
      icon: Scale,
      iconTone: "neutral",
      rows: changes.map((change) => ({ label: labelOf[change.field], value: changeValue(change), stacked: true })),
      consequences: [
        // Sayt kalkulyatori faqat narx hisobi qoidalari bilan o'zgaradi; minimal narx va kuryer xarajati chegarasi —
        // faqat sotuvdagi narx dvigateli (sayt kalkulyatoriga ta'sir qilmaydi).
        ...(impact.quote
          ? [
              { text: t("page.rules.confirm.immediate"), icon: Zap },
              { text: t("page.rules.confirm.website"), icon: Globe },
            ]
          : []),
        ...(impact.saleOnly ? [{ text: t("page.rules.confirm.saleOnly"), icon: Info }] : []),
        { text: t("page.rules.confirm.journal"), icon: History },
      ],
      confirmLabel: t("page.rules.save"),
      confirmIcon: Check,
      loadingLabel: t("page.rules.saving"),
      size: "md",
      // Maket xato qutisi: qalin sarlavha + izoh. Vaqt tugasa ham oyna ochiq — qayta bosish xavfsiz (o'sha tana).
      errorMessage: (error) => (
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="font-semibold">{t("page.rules.error")}</span>
          <span>{saveError(error)}</span>
        </span>
      ),
      onConfirm: async () => {
        const next = await update.mutateAsync(body);
        if (next) reset(toRulesForm(next, language));
      },
    });
    if (confirmed) notify.success(t("page.rules.success"), { description: t("page.rules.successDescription") });
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
        <div className="flex min-w-0 flex-wrap items-start gap-4">
          <RuleField control={control} errors={errors} field="volumetricFrom" label={t("page.rules.volumetricFrom")} hint={t("page.rules.volumetricFromHint")} suffix={t("page.rules.unitKg")} readOnly={busy} className="flex-[1_1_260px]" />
          <VolumetricExample control={control} settings={settings} className="flex-[2_1_360px]" />
        </div>
        <div className="flex min-w-0 flex-col gap-4 border-t border-border pt-5 max-md:pt-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h3 className="m-0 text-sm font-semibold text-text">{t("page.rules.saleTitle")}</h3>
            <p className="m-0 text-[13px] text-text-muted">{t("page.rules.saleDescription")}</p>
          </div>
          <div className="flex min-w-0 flex-wrap items-start gap-4">
            <RuleField control={control} errors={errors} field="minPrice" label={t("page.rules.minPrice")} hint={t("page.rules.minPriceHint")} mode="money" readOnly={busy} className="flex-[1_1_260px]" />
            <RuleField control={control} errors={errors} field="extraLimit" label={t("page.rules.extraLimit")} hint={t("page.rules.extraLimitHint")} mode="money" readOnly={busy} className="flex-[1_1_260px]" />
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

/**
 * Hajm chegarasi jonli misoli (`.el-alert.el-tone-info`): formadagi chegara bilan ikki namunaviy posilka —
 * «20 × 20 × 20 sm, 0,5 kg → hajmli vazn 1,6 kg → hisob 0,5 kg (chegaradan kichik — og'irlik bo'yicha)».
 */
const VolumetricExample = ({
  control,
  settings,
  className,
}: {
  control: Control<RulesFormValues>;
  settings: DeliveryPricingSettings;
  className?: string;
}) => {
  const { t, language, number } = useTariffText();
  const input = useWatch({ control, name: "volumetricFrom" });
  const threshold = parseRuleValue(input);
  // Noto'g'ri qiymatda misol yo'q (xato maydon ostida).
  if (threshold === null || validateRule("volumetricFrom")(input) !== true) return null;

  const rules = { ...toWeightRules(settings), volumetricFromKg: threshold };
  const kg = (value: number) => formatKgValue(value, language);
  const lines = VOLUMETRIC_SAMPLES.map((item) => {
    const weights = computeMeasureWeights(item, rules);
    const basis = !meetsVolumetricThreshold(item, rules)
      ? "page.rules.volumetricBasisBelow"
      : weights.basis === "volume"
        ? "page.rules.volumetricBasisVolume"
        : "page.rules.volumetricBasisWeight";
    return t("page.rules.volumetricExampleLine", {
      size: [item.length_cm, item.width_cm, item.height_cm].map(number).join(" × "),
      weight: kg(item.weight_kg),
      volumetric: kg(weights.volumetricKg),
      billable: kg(weights.billableKg),
      basis: t(basis),
    });
  });

  return (
    <div role="status" className={cx("flex min-w-0 items-start gap-3 rounded-xl px-4 py-3 text-sm", TONE_SOFT.info, className)}>
      <Info size={18} aria-hidden="true" className="mt-px shrink-0" />
      <div className="flex min-w-0 flex-col gap-0.5 text-text">
        <span className="font-bold">
          {threshold > 0
            ? t("page.rules.volumetricExampleTitle", { threshold: kg(threshold) })
            : t("page.rules.volumetricExampleAlways")}
        </span>
        {lines.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </div>
    </div>
  );
};
