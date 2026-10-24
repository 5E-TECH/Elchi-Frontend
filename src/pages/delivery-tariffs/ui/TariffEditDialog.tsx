// dizayn-v2: superadmin-regions-delivery-tariff-edit-dialog, admin-regions-delivery-tariff-edit-dialog
import { useMemo, useState } from "react";
import { TriangleAlert, Truck } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import {
  computeTariffTotal,
  formatKgValue,
  useCreateDeliveryTariff,
  type DeliveryPricingSettings,
  type DeliveryTariff,
  type DeliveryTariffId,
} from "../../../entities/delivery-pricing";
import { cx } from "../../../shared/lib/cx";
import { formatDateLocalized } from "../../../shared/lib/formatDateTime";
import { notify } from "../../../shared/lib/notify";
import { Button, DateInput, Dialog, Field, TextInput, TONE_SOFT } from "../../../shared/ui/primitives";
import {
  isScheduledDay,
  SAMPLE_WEIGHTS_KG,
  toIsoDay,
  toTariffForm,
  toTariffPayload,
  validateDays,
  validateDaysMax,
  validateMoney,
  validateValidFrom,
  type TariffFormValues,
} from "../model/tariffForm";
import { useTariffText } from "./useTariffText";

export type TariffEditDialogProps = {
  /** O'zgartirilayotgan tarif (`null` — oyna yopiq). */
  tariffId: DeliveryTariffId | null;
  /** Hozirgi versiya (yo'q bo'lsa — birinchi versiya yaratiladi). */
  current: DeliveryTariff | null;
  settings: DeliveryPricingSettings | null;
  onClose: () => void;
};

/**
 * «TARIFNI O'ZGARTIRISH» — maket `*-regions-delivery-tariff-edit-dialog`: `Truck`, «{tarif} · {yo'nalish}»;
 * «Asosiy narx *» ({chegara} kg gacha), «Har qo'shimcha kg *», «Muddat (eng kam / eng ko'p) *», «Kuchga kirish
 * sanasi *» (sukut — ertaga); «Namunaviy posilkalar: hozir → yangi» (1,0 · 3,4 · 7,0 kg — sozlama bo'lsa);
 * ogohlantirish (eski buyurtmalar narxi o'zgarmaydi). `POST /delivery/tariffs` — yangi versiya, eski o'chirilmaydi.
 */
export const TariffEditDialog = ({ tariffId, current, settings, onClose }: TariffEditDialogProps) => {
  const { t, language, money, number, name, saveError } = useTariffText();
  // Yopilish harakati paytida ham oxirgi tarif ko'rinib tursin.
  const [shown, setShown] = useState(tariffId);
  if (tariffId && tariffId !== shown) setShown(tariffId);
  const target = tariffId ?? shown;
  const today = toIsoDay(new Date());

  const createTariff = useCreateDeliveryTariff();
  // Har ochilish — yangi nusxa (sahifa `key` beradi): forma shu paytdagi tarif bilan to'ladi, tarix yangilansa
  // yozilayotgan qiymat yo'qolmaydi.
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<TariffFormValues>({ defaultValues: toTariffForm(current, today) });

  const [base, perKg, validFrom] = useWatch({ control, name: ["base", "perKg", "validFrom"] });
  const scheduled = isScheduledDay(validFrom, today);

  const samples = useMemo(() => {
    if (!settings) return [];
    const total = (basePrice: number, extraPerKg: number, billableKg: number) =>
      computeTariffTotal({
        billableKg,
        basePrice,
        extraPerKg,
        firstKgIncluded: settings.firstKgIncluded,
        roundTo: settings.roundTo,
      });
    const nextBase = base ? Number(base) : null;
    const nextPerKg = perKg ? Number(perKg) : null;
    return SAMPLE_WEIGHTS_KG.map((kg) => ({
      kg,
      now: current ? total(current.basePrice, current.extraPerKg, kg) : null,
      next: nextBase !== null && nextPerKg !== null ? total(nextBase, nextPerKg, kg) : null,
    }));
  }, [base, current, perKg, settings]);

  const busy = createTariff.isPending;
  const errorText = (message: string | undefined) => (message ? t(message) : undefined);

  const submit = handleSubmit(async (values) => {
    if (!target || busy) return;
    try {
      await createTariff.mutateAsync(toTariffPayload(target, values, today));
      notify.success(t("page.edit.success"), {
        description: isScheduledDay(values.validFrom, today)
          ? t("page.edit.successScheduled", { name: name(target), date: formatDateLocalized(values.validFrom) })
          : t("page.edit.successNow", { name: name(target) }),
      });
      onClose();
    } catch (error) {
      notify.error(t("page.edit.error"), { description: saveError(error) });
    }
  });

  const dash = <span className="text-text-subtle">—</span>;

  return (
    <Dialog
      open={Boolean(tariffId)}
      onClose={onClose}
      busy={busy}
      icon={Truck}
      size="xl"
      title={t("page.edit.title")}
      description={target ? t("page.edit.description", { name: name(target), scope: t(`page.editScope.${target}`) }) : undefined}
      onSubmit={submit}
      formProps={{ noValidate: true }}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t("page.edit.cancel")}
          </Button>
          <Button type="submit" loading={busy} loadingText={t("page.edit.saving")}>
            {t("page.edit.save")}
          </Button>
        </>
      }
    >
      <div className="flex min-w-0 flex-wrap items-start gap-4">
        <Controller
          control={control}
          name="base"
          rules={{ validate: validateMoney }}
          render={({ field }) => (
            <Field
              id="tariff-base"
              label={t("page.edit.base")}
              required
              hint={
                settings
                  ? t("page.edit.baseHint", { first: formatKgValue(settings.firstKgIncluded, language) })
                  : t("page.edit.baseHintPlain")
              }
              error={errorText(errors.base?.message)}
              className="min-w-0 flex-[1_1_200px]"
            >
              <TextInput mode="money" name={field.name} ref={field.ref} value={field.value} onValueChange={field.onChange} onBlur={field.onBlur} placeholder="0" autoComplete="off" readOnly={busy} />
            </Field>
          )}
        />
        <Controller
          control={control}
          name="perKg"
          rules={{ validate: validateMoney }}
          render={({ field }) => (
            <Field
              id="tariff-extra"
              label={t("page.edit.perKg")}
              required
              hint={t("page.edit.perKgHint")}
              error={errorText(errors.perKg?.message)}
              className="min-w-0 flex-[1_1_200px]"
            >
              <TextInput mode="money" name={field.name} ref={field.ref} value={field.value} onValueChange={field.onChange} onBlur={field.onBlur} placeholder="0" autoComplete="off" readOnly={busy} />
            </Field>
          )}
        />
      </div>
      <div className="flex min-w-0 flex-wrap items-start gap-4">
        <Controller
          control={control}
          name="daysMin"
          rules={{ validate: validateDays, deps: ["daysMax"] }}
          render={({ field }) => (
            <Field id="tariff-days-min" label={t("page.edit.daysMin")} required error={errorText(errors.daysMin?.message)} className="min-w-0 flex-[1_1_140px]">
              <TextInput mode="number" name={field.name} ref={field.ref} value={field.value} onValueChange={field.onChange} onBlur={field.onBlur} suffix={t("page.edit.daysUnit")} autoComplete="off" readOnly={busy} />
            </Field>
          )}
        />
        <Controller
          control={control}
          name="daysMax"
          rules={{ validate: validateDaysMax }}
          render={({ field }) => (
            <Field id="tariff-days-max" label={t("page.edit.daysMax")} required error={errorText(errors.daysMax?.message)} className="min-w-0 flex-[1_1_140px]">
              <TextInput mode="number" name={field.name} ref={field.ref} value={field.value} onValueChange={field.onChange} onBlur={field.onBlur} suffix={t("page.edit.daysUnit")} autoComplete="off" readOnly={busy} />
            </Field>
          )}
        />
        <Controller
          control={control}
          name="validFrom"
          rules={{ validate: (value) => validateValidFrom(value, today) }}
          render={({ field }) => (
            <Field
              id="tariff-valid-from"
              label={t("page.edit.validFrom")}
              labelAs="span"
              required
              hint={t("page.edit.validFromHint")}
              error={errorText(errors.validFrom?.message)}
              className="min-w-0 flex-[1_1_200px]"
            >
              <DateInput value={field.value} onChange={field.onChange} min={today} clearable={false} disabled={busy} />
            </Field>
          )}
        />
      </div>

      {samples.length ? (
        <div aria-live="polite" className="flex min-w-0 flex-col gap-2 rounded-[10px] bg-sunken px-4 py-3.5 text-sm">
          <span className="text-[13px] text-text-muted">{t("page.edit.samples")}</span>
          {samples.map((sample) => (
            <span key={sample.kg} className="flex justify-between gap-3">
              <span className="text-text">{t("page.edit.sampleWeight", { value: formatKgValue(sample.kg, language) })}</span>
              <span className="font-semibold text-text">
                {sample.now !== null && sample.next !== null ? (
                  t("page.edit.sampleRow", {
                    now: number(sample.now),
                    next: money(sample.next),
                  })
                ) : sample.next !== null ? (
                  money(sample.next)
                ) : (
                  dash
                )}
              </span>
            </span>
          ))}
        </div>
      ) : null}

      <div role="status" className={cx("flex min-w-0 items-start gap-3 rounded-xl px-4 py-3 text-sm", TONE_SOFT.warning)}>
        <TriangleAlert size={18} aria-hidden="true" className="mt-px shrink-0" />
        <span className="min-w-0 text-[13px] leading-[18px] text-text">
          {scheduled
            ? t("page.edit.warning", { date: formatDateLocalized(validFrom) })
            : t("page.edit.warningNow")}
        </span>
      </div>
    </Dialog>
  );
};
