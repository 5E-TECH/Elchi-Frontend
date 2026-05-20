import { memo } from "react";
import { Controller } from "react-hook-form";
import type {
  Control,
  FieldErrors,
  UseFormHandleSubmit,
  UseFormRegister,
} from "react-hook-form";
import { CreditCard, PackageCheck, Send } from "lucide-react";
import Select from "../../../shared/ui/Select";
import FilterSelect from "../../../shared/ui/FilterSelect";
import { formatAmountInput } from "./lib/amountInput";

export interface CashboxActionFormValues {
  amount: string;
  paymentType: string;
  marketId: string;
  comment: string;
}

interface CashboxActionFormCardProps {
  type: "market" | "courier";
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
  submitLoading = false,
  submitDisabled = false,
  paymentTypeOptions,
  control,
  register,
  errors,
  handleSubmit,
  onSubmit,
}: CashboxActionFormCardProps) => {
  return (
    <div className={`${sectionClassName} w-full max-w-[540px]`}>
      <div className={`rounded-t-[1.35rem] bg-linear-to-r ${actionGradient} px-4 py-3`}>
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/16 text-primary shadow-inner">
            {type === "market" ? <CreditCard size={17} /> : <PackageCheck size={17} />}
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
              UZS
            </span>
          </div>
          {errors.amount && (
            <p className="mt-1 text-xs text-error">{errors.amount.message}</p>
          )}
        </div>

        <div>
          <Controller
            control={control}
            name="paymentType"
            render={({ field }) => (
              <FilterSelect
                label={paymentTypeLabel}
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                options={paymentTypeOptions}
                placeholder={paymentTypePlaceholder}
              />
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
                <Select
                  label={marketLabel}
                  name={field.name}
                  value={field.value}
                  onChange={field.onChange}
                  options={marketOptions}
                  placeholder={marketPlaceholder}
                  required
                  loading={marketLoading}
                  error={errors.marketId?.message}
                  className="!border-[color:var(--color-border-soft)] !bg-[color:var(--color-card-surface-strong)] !py-3 !text-sm !font-semibold dark:!border-white/10 dark:!bg-white/[0.055] dark:!text-primary"
                />
              )}
            />
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-xs font-bold text-[color:var(--color-table-label)] dark:text-[color:var(--color-table-label-dark)]">
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
          {submitLoading ? "Yuklanmoqda..." : submitLabel}
        </button>
      </div>
    </div>
  );
};

export default memo(CashboxActionFormCard);
