// dizayn-v2: superadmin-regions-delivery-tariffs, admin-regions-delivery-tariffs
import { useId, useMemo, useState } from "react";
import { Calculator } from "lucide-react";
import {
  checkDimensionInput,
  checkWeightInput,
  computeExtraKg,
  DeliveryQuoteList,
  formatKgValue,
  MeasureWeights,
  toMeasureItem,
  toWeightRules,
  useDeliveryQuoteByTariff,
  VolumetricSwitch,
  type DeliveryPricingSettings,
  type MeasureInputValues,
} from "../../../entities/delivery-pricing";
import { cx } from "../../../shared/lib/cx";
import { Card, Field, TextInput } from "../../../shared/ui/primitives";
import { CardHead } from "./CardHead";
import { useTariffText } from "./useTariffText";

/** Boshlang'ich namuna (maket): 0,8 kg, 50 × 35 × 20 sm — kalkulyator darhol natija ko'rsatadi. */
const SAMPLE: MeasureInputValues = { weight: "0,8", length: "50", width: "35", height: "20", volumetric: true };

type DimensionKey = "length" | "width" | "height";

/**
 * «NARX KALKULYATORI» (maket `superadmin-regions-delivery-tariffs`): og'irlik + U / K / B, «Hajmga qarab hisoblash»
 * kaliti, jonli «Hajmli vazn» / «Hisob vazni» («1,0 kg asosiy + 6 kg qo'shimcha»; hajmli vazn chegaradan kichik —
 * «Chegara 3,0 kg dan kichik — narx og'irlik bo'yicha») va uchala tarif narxi — `POST /delivery/quote/by-tariff`
 * (joriy tarif va qoidalar bilan; saqlangach kesh yangilanadi — narx va hisob vazni qayta so'raladi).
 */
export const PriceCalculatorCard = ({
  settings,
  className,
}: {
  settings: DeliveryPricingSettings | null;
  className?: string;
}) => {
  const { t, language, number } = useTariffText();
  const titleId = useId();
  const [values, setValues] = useState<MeasureInputValues>(SAMPLE);
  const item = useMemo(() => toMeasureItem(values), [values]);
  const quote = useDeliveryQuoteByTariff(item);
  const set = (key: keyof MeasureInputValues) => (value: string | boolean) =>
    setValues((previous) => ({ ...previous, [key]: value }));

  const rules = settings ? toWeightRules(settings) : undefined;

  const billableNote = (billableKg: number) => {
    if (!settings) return null;
    const extra = computeExtraKg(billableKg, settings.firstKgIncluded);
    const first = formatKgValue(settings.firstKgIncluded, language);
    return extra > 0
      ? t("page.calculator.billableExtra", { first, extra: number(extra) })
      : t("page.calculator.billableBase", { first });
  };

  const dimension = (key: DimensionKey) => (
    <Field
      key={key}
      id={`calc-${key}`}
      label={t(`page.calculator.${key}`)}
      invalid={values[key].trim() !== "" && checkDimensionInput(values[key]) !== null}
      className="min-w-0 flex-[1_1_90px]"
    >
      <TextInput
        name={key}
        value={values[key]}
        onValueChange={set(key)}
        inputMode="numeric"
        autoComplete="off"
        suffix={t("page.calculator.unitCm")}
      />
    </Field>
  );

  return (
    <Card as="section" padding="none" aria-labelledby={titleId} className={cx("min-w-0", className)}>
      <CardHead
        id={titleId}
        icon={Calculator}
        title={t("page.calculator.title")}
        description={t("page.calculator.description")}
      />
      <div className="flex flex-col gap-4 p-5 max-md:p-4">
        <div className="flex min-w-0 flex-wrap items-start gap-3 max-md:grid max-md:grid-cols-2">
          <Field
            id="calc-weight"
            label={t("page.calculator.weight")}
            invalid={values.weight.trim() !== "" && checkWeightInput(values.weight) !== null}
            className="min-w-0 flex-[1_1_120px]"
          >
            <TextInput
              name="weight"
              value={values.weight}
              onValueChange={set("weight")}
              inputMode="decimal"
              autoComplete="off"
              suffix={t("page.calculator.unitKg")}
            />
          </Field>
          {(["length", "width", "height"] as const).map(dimension)}
        </div>
        <VolumetricSwitch id="calc-volumetric" checked={values.volumetric} onChange={set("volumetric")} />
        <MeasureWeights
          item={item}
          rules={rules}
          quote={quote}
          showFormula={false}
          billableNote={settings ? billableNote : undefined}
        />
        <DeliveryQuoteList state={quote} variant="list" />
      </div>
    </Card>
  );
};
