// dizayn-v2: superadmin-payments-cash-detail-courier, superadmin-payments-cash-detail-market, superadmin-payments-cash-detail-branch, admin-payments-cash-detail-courier, admin-payments-cash-detail-market, admin-payments-cash-detail-branch, manager-payments-cash-detail-courier, manager-payments-cash-detail-branch
import { memo, useId, type ReactNode } from "react";
import { Controller } from "react-hook-form";
import type {
  Control,
  FieldErrors,
  UseFormHandleSubmit,
  UseFormRegister,
} from "react-hook-form";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Banknote,
  CircleX,
  CreditCard,
  Info,
  Store,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import { Button, Card, Field, Select, TextInput } from "../../../shared/ui/primitives";

/**
 * KASSA AMALI FORMASI — dizayn v2 (maket `*-payments-cash-detail-*`: «Kuryerdan qabul qilish»,
 * «Marketga to'lov», «Filialdan qabul qilish», «HQ'ga o'tkazish»).
 *
 * Karta: sarlavha + izoh; «Summa *» (katta maydon, mingliklar bilan, o'ngda valyuta) + ko'rsatma;
 * ixtiyoriy info ogohlantirish (market: «To'lov avval eng eski buyurtmalarni yopadi…»); «To'lov turi *» —
 * radio kartalar (`fieldset` + `legend`, ≥ 48px); «Marketga o'tkazma» tanlansa «Market *» tanlovi; «Izoh
 * (ixtiyoriy)»; asosiy tugma (blok, katta). Yuborilayotganda tugmada spinner + «Yuklanmoqda…» va u bosilmaydi
 * (ikki marta yuborish yo'q).
 *
 * Forma qiymatlari va react-hook-form props'lari o'zgarmagan (`CashboxActionFormValues`); summa satr
 * ko'rinishida saqlanadi (`parseAmountInput` o'qiydi). `transferSource*` — eski props, ishlatilmaydi.
 */

export interface CashboxActionFormValues {
  amount: string;
  paymentType: string;
  marketId: string;
  transferSourceId: string;
  comment: string;
}

interface CashboxActionFormCardProps {
  type: "market" | "courier" | "branch";
  /** v1 (gradient) — e'tiborsiz. */
  actionGradient?: string;
  /** Karta sarlavhasi («Kuryerdan qabul qilish»); `title` berilsa — u. */
  actionLabel: string;
  /** Sarlavha ostidagi izoh; `subtitle` berilsa — u. */
  actionSubLabel: string;
  title?: string;
  subtitle?: string;
  /** Tugma matni («1 155 000 so'm qabul qilish», «To'lash», «HQ'ga o'tkazish»). */
  submitLabel: string;
  /** Tugma ikonkasi (sukut: kuryer/filial — `ArrowDownLeft`, market — `ArrowUpRight`). */
  submitIcon?: LucideIcon;
  amountLabel: string;
  /** Summa ko'rsatmasi: «Ko'pi bilan 1 155 000 so'm — …», «Berilishi kerak: …». */
  amountHint?: ReactNode;
  /** Summa ostidagi info ogohlantirish (market). */
  infoAlert?: ReactNode;
  /** Forma tepasidagi ogohlantirish (masalan «Tekshiruv xizmati javob bermadi»). */
  alert?: ReactNode;
  paymentTypeLabel: string;
  /** v1 radiogroup izohi — e'tiborsiz (radio kartalar `legend` bilan nomlanadi). */
  paymentTypePlaceholder?: string;
  commentLabel: string;
  commentPlaceholder: string;
  showMarketSelect?: boolean;
  marketLabel?: string;
  marketPlaceholder?: string;
  /** Market tanlanmagan paytdagi izoh: «Market tanlanmaguncha qabul qilish tugmasi faol emas». */
  marketHint?: string;
  marketOptions?: { value: string; label: string }[];
  marketLoading?: boolean;
  showTransferSourceSelect?: boolean;
  transferSourceLabel?: string;
  transferSourcePlaceholder?: string;
  transferSourceOptions?: { value: string; label: string }[];
  transferSourceLoading?: boolean;
  submitLoading?: boolean;
  submitDisabled?: boolean;
  paymentTypeOptions: { value: string; label: string }[];
  control: Control<CashboxActionFormValues>;
  register: UseFormRegister<CashboxActionFormValues>;
  errors: FieldErrors<CashboxActionFormValues>;
  handleSubmit: UseFormHandleSubmit<CashboxActionFormValues>;
  onSubmit: (values: CashboxActionFormValues) => void;
}

const PAYMENT_TYPE_ICONS: Record<string, LucideIcon> = {
  cash: Banknote,
  card: CreditCard,
  click: ArrowLeftRight,
  transfer: ArrowLeftRight,
  click_to_market: Store,
};

/** `.el-choice-card` (CODE-MAP 2.7): tanlanganda `action` chegarasi va `action-soft` fon. */
const CHOICE_CARD = cx(
  "group relative flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-border-strong bg-surface px-3.5 py-2.5",
  "transition-[background-color,border-color] duration-150 hover:bg-row-hover motion-reduce:transition-none",
  "has-[:checked]:border-action has-[:checked]:bg-action-soft",
  "has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-action/30",
);

const CashboxActionFormCard = ({
  type,
  actionLabel,
  actionSubLabel,
  title,
  subtitle,
  submitLabel,
  submitIcon,
  amountLabel,
  amountHint,
  infoAlert,
  alert,
  paymentTypeLabel,
  commentLabel,
  commentPlaceholder,
  showMarketSelect = false,
  marketLabel = "",
  marketPlaceholder = "",
  marketHint,
  marketOptions = [],
  marketLoading = false,
  submitLoading = false,
  submitDisabled = false,
  paymentTypeOptions,
  control,
  errors,
  handleSubmit,
  onSubmit,
}: CashboxActionFormCardProps) => {
  const { t } = useTranslation("payments");
  const titleId = useId();
  const paymentTypeErrorId = useId();
  const SubmitIcon = submitIcon ?? (type === "market" ? ArrowUpRight : ArrowDownLeft);
  const paymentTypeError = errors.paymentType?.message;

  return (
    <Card title={<span id={titleId}>{title ?? actionLabel}</span>} description={subtitle ?? actionSubLabel}>
      <form
        noValidate
        aria-labelledby={titleId}
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-5"
      >
        {alert}

        <Controller
          control={control}
          name="amount"
          render={({ field }) => (
            <Field label={amountLabel} required hint={amountHint} error={errors.amount?.message}>
              <TextInput
                size="lg"
                mode="money"
                name={field.name}
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                placeholder="0"
                autoComplete="off"
              />
            </Field>
          )}
        />

        {infoAlert ? (
          <div role="note" className="flex items-start gap-3 rounded-xl bg-info-soft px-3.5 py-2.5 text-sm text-info-fg">
            <Info aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
            <div className="min-w-0 text-text">{infoAlert}</div>
          </div>
        ) : null}

        <Controller
          control={control}
          name="paymentType"
          render={({ field }) => (
            <fieldset
              className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0"
              aria-describedby={paymentTypeError ? paymentTypeErrorId : undefined}
            >
              <legend className="mb-1.5 p-0 text-[13px] font-semibold text-text">
                {paymentTypeLabel}
                <span aria-hidden="true" className="text-danger-fg">
                  {" *"}
                </span>
              </legend>
              {paymentTypeOptions.map((option) => {
                const Icon = PAYMENT_TYPE_ICONS[option.value] ?? CreditCard;
                return (
                  <label key={option.value} className={CHOICE_CARD}>
                    <input
                      type="radio"
                      name={field.name}
                      value={option.value}
                      checked={field.value === option.value}
                      onChange={() => field.onChange(option.value)}
                      onBlur={field.onBlur}
                      // Shaffof, butun karta ustida: bosish va klaviatura — haqiqiy radio; ko'rinish — doira.
                      className="absolute inset-0 z-10 m-0 size-full cursor-pointer appearance-none rounded-xl opacity-0"
                    />
                    {/* Maketdagi radio doirasi (20px, 2px chegara; tanlanganda `action` + ichki nuqta). */}
                    <span
                      aria-hidden="true"
                      className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-border-strong group-has-[:checked]:border-action"
                    >
                      <span className="hidden size-2.5 rounded-full bg-action group-has-[:checked]:block" />
                    </span>
                    <Icon aria-hidden="true" size={18} className="shrink-0 text-text-muted" />
                    <span className="min-w-0 text-sm font-semibold text-text">{option.label}</span>
                  </label>
                );
              })}
              {paymentTypeError ? (
                <div id={paymentTypeErrorId} className="flex items-start gap-1.5 text-xs font-semibold text-danger-fg">
                  <CircleX aria-hidden="true" size={16} className="mt-px shrink-0" />
                  <span className="min-w-0">{paymentTypeError}</span>
                </div>
              ) : null}
            </fieldset>
          )}
        />

        {showMarketSelect ? (
          <Controller
            control={control}
            name="marketId"
            render={({ field }) => (
              <Field
                label={marketLabel}
                required
                hint={field.value ? undefined : marketHint}
                error={errors.marketId?.message}
              >
                <Select
                  searchable
                  name={field.name}
                  options={marketOptions}
                  value={field.value || null}
                  onChange={(value) => field.onChange(value ?? "")}
                  onBlur={field.onBlur}
                  placeholder={marketPlaceholder}
                  loading={marketLoading}
                />
              </Field>
            )}
          />
        ) : null}

        <Controller
          control={control}
          name="comment"
          render={({ field }) => (
            <Field label={commentLabel} optional>
              <TextInput
                multiline
                rows={2}
                name={field.name}
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                placeholder={commentPlaceholder}
                className="min-h-[72px]"
              />
            </Field>
          )}
        />

        <Button
          type="submit"
          size="lg"
          fullWidth
          leftIcon={SubmitIcon}
          loading={submitLoading}
          loadingText={t("v2CashDetail.form.loading")}
          disabled={submitDisabled}
        >
          {submitLabel}
        </Button>
      </form>
    </Card>
  );
};

export default memo(CashboxActionFormCard);
