import { memo } from "react";
import { Controller } from "react-hook-form";
import type {
  Control,
  FieldErrors,
  UseFormHandleSubmit,
  UseFormRegister,
} from "react-hook-form";
import { ArrowLeftRight, Banknote, CreditCard, Landmark, PackageCheck, Send, Store } from "lucide-react";
import FilterSelect from "../../../shared/ui/FilterSelect";
import { formatAmountInput } from "./lib/amountInput";
import { useTranslation } from "react-i18next";

export interface CashboxActionFormValues {
  amount: string;
  paymentType: string;
  marketId: string;
  transferSourceId: string;
  comment: string;
}

interface CashboxActionFormCardProps {
  type: "market" | "courier" | "branch";
  actionGradient: string;
  actionLabel: string;
  actionSubLabel: string;
  submitLabel: string;
  amountLabel: string;
  paymentTypeLabel: string;
  paymentTypePlaceholder: string;
  commentLabel: string;
  commentPlaceholder: string;
  showMarketSelect?: boolean;
  marketLabel?: string;
  marketPlaceholder?: string;
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

const sectionClassName =
  "rounded-[1.35rem] border border-[color:var(--color-border-soft)] bg-primary shadow-sm dark:bg-primarydark";

const fieldClassName =
  "w-full rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-card-surface-strong)] px-4 py-3 text-sm font-semibold text-maindark outline-none transition-all placeholder:text-[color:var(--color-text-muted)] focus:border-main focus:ring-2 focus:ring-main/15 dark:border-white/10 dark:bg-white/[0.055] dark:text-primary dark:placeholder:text-white/35 dark:focus:border-main dark:focus:ring-main/20";

const paymentTypeIconMap = {
  cash: Banknote,
  card: CreditCard,
  click: CreditCard,
  transfer: ArrowLeftRight,
  click_to_market: Store,
} as const;

const getPaymentTypeIcon = (value: string) =>
  paymentTypeIconMap[value as keyof typeof paymentTypeIconMap] ?? CreditCard;

const CashboxActionFormCard = ({
  type,
  actionGradient,
  actionLabel,
  actionSubLabel,
  submitLabel,
  amountLabel,
  paymentTypeLabel,
  paymentTypePlaceholder,
  commentLabel,
  commentPlaceholder,
  showMarketSelect = false,
  marketLabel = "",
  marketPlaceholder = "",
  marketOptions = [],
  marketLoading = false,
  showTransferSourceSelect = false,
  transferSourceLabel = "",
  transferSourcePlaceholder = "",
  transferSourceOptions = [],
  transferSourceLoading = false,
  submitLoading = false,
  submitDisabled = false,
  paymentTypeOptions,
  control,
  register,
  errors,
  handleSubmit,
  onSubmit,
}: CashboxActionFormCardProps) => {
  const { t } = useTranslation("payments");
  const headerIcon =
    type === "market" ? (
      <CreditCard size={17} />
    ) : type === "branch" ? (
      <Landmark size={17} />
    ) : (
      <PackageCheck size={17} />
    );

  return (
    <div className={`${sectionClassName} w-full max-w-[540px] xl:max-w-none`}>
      <div className={`rounded-t-[1.35rem] bg-linear-to-r ${actionGradient} px-4 py-3`}>
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/16 text-primary shadow-inner">
            {headerIcon}
          </div>
          <div>
            <p className="text-sm font-extrabold leading-tight text-primary">{actionLabel}</p>
            <p className="mt-0.5 text-[11px] font-semibold leading-tight text-primary/75">
              {actionSubLabel}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3.5 p-3.5">
        <div>
          <label className="mb-1.5 block text-xs font-bold text-[color:var(--color-table-label)] dark:text-[color:var(--color-table-label-dark)]">
            {amountLabel} <span className="text-rose-400">*</span>
          </label>
          <div className="relative">
            <Controller
              control={control}
              name="amount"
              render={({ field }) => (
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={formatAmountInput(field.value)}
                  onChange={(event) => field.onChange(event.target.value)}
                  className={`${fieldClassName} pr-16`}
                />
              )}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-[color:var(--color-text-muted)] dark:text-white/45">
              {t("currency")}
            </span>
          </div>
          {errors.amount && (
            <p className="mt-1 text-xs text-error">{errors.amount.message}</p>
          )}
        </div>

        <div>
          <p className="mb-2 block text-xs font-bold uppercase tracking-wide text-[color:var(--color-table-label)] dark:text-[color:var(--color-table-label-dark)]">
            {paymentTypeLabel} <span className="text-rose-400">*</span>
          </p>
          <Controller
            control={control}
            name="paymentType"
            render={({ field }) => (
              <div
                className="grid grid-cols-1 gap-2 sm:grid-cols-2"
                role="radiogroup"
                aria-label={`${paymentTypeLabel}: ${paymentTypePlaceholder}`}
              >
                {paymentTypeOptions.map((option) => {
                  const Icon = getPaymentTypeIcon(option.value);
                  const isSelected = field.value === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => field.onChange(option.value)}
                      className={`group flex min-h-14 items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all focus:outline-none focus:ring-2 focus:ring-main/25 ${
                        isSelected
                          ? "border-main bg-main text-white shadow-lg shadow-main/20"
                          : "border-[color:var(--color-border-soft)] bg-[color:var(--color-card-surface-strong)] text-maindark hover:border-main/50 hover:bg-main/8 dark:border-white/10 dark:bg-white/[0.055] dark:text-primary dark:hover:bg-white/10"
                      }`}
                    >
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                          isSelected
                            ? "bg-white/18 text-white"
                            : "bg-main/10 text-main dark:bg-white/8 dark:text-primary"
                        }`}
                      >
                        <Icon size={18} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-extrabold">
                          {option.label}
                        </span>
                      </span>
                      <span
                        className={`h-3 w-3 shrink-0 rounded-full border transition-all ${
                          isSelected
                            ? "border-white bg-white shadow-[0_0_0_4px_rgba(255,255,255,0.22)]"
                            : "border-main/40 group-hover:border-main dark:border-white/25"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          />
          {errors.paymentType && (
            <p className="mt-1 text-xs font-semibold text-error">
              {errors.paymentType.message}
            </p>
          )}
        </div>

        {showMarketSelect && (
          <div>
            <Controller
              control={control}
              name="marketId"
              render={({ field }) => (
                <FilterSelect
                  label={marketLabel}
                  name={field.name}
                  value={field.value}
                  onChange={field.onChange}
                  options={marketOptions}
                  placeholder={marketPlaceholder}
                  loading={marketLoading}
                  size="sm"
                />
              )}
            />
            {errors.marketId?.message && (
              <p className="mt-1 text-xs text-error">{errors.marketId.message}</p>
            )}
          </div>
        )}

        {showTransferSourceSelect && (
          <div>
            <Controller
              control={control}
              name="transferSourceId"
              render={({ field }) => (
                <FilterSelect
                  label={transferSourceLabel}
                  name={field.name}
                  value={field.value}
                  onChange={field.onChange}
                  options={transferSourceOptions}
                  placeholder={transferSourcePlaceholder}
                  loading={transferSourceLoading}
                  size="sm"
                />
              )}
            />
            {errors.transferSourceId?.message && (
              <p className="mt-1 text-xs text-error">{errors.transferSourceId.message}</p>
            )}
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-xs font-bold text-(--color-table-label) dark:text-[color:var(--color-table-label-dark)]">
            {commentLabel}
          </label>
          <textarea
            placeholder={commentPlaceholder}
            rows={2}
            {...register("comment")}
            className={`${fieldClassName} min-h-[4.5rem] resize-none`}
          />
        </div>

        <button
          type="button"
          onClick={handleSubmit(onSubmit)}
          disabled={submitDisabled || submitLoading}
          className={`flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-r text-sm font-extrabold text-white shadow-lg transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${actionGradient}`}
        >
          <Send size={16} />
          {submitLoading ? t("loadingLabel") : submitLabel}
        </button>
      </div>
    </div>
  );
};

export default memo(CashboxActionFormCard);
