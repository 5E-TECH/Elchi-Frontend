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
  "overflow-hidden rounded-[1.35rem] border border-[color:var(--color-border-soft)] bg-primary shadow-sm dark:bg-primarydark";

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
      <div className={`bg-linear-to-r ${actionGradient} px-3.5 py-2`}>
        <div className="flex items-center gap-1.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-[0.75rem] bg-primary/15 text-primary shadow-inner">
            {type === "market" ? <CreditCard size={12} /> : <PackageCheck size={12} />}
          </div>
          <div>
            <p className="text-[12px] font-bold leading-none text-primary">{actionLabel}</p>
            <p className="mt-0.5 text-[9px] leading-none text-primary/70">
              {actionSubLabel}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2 p-2.5">
        <div>
          <label className="mb-0.5 block text-[12px] font-semibold text-gray-700 dark:text-gray-300">
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
                  className="w-full rounded-[0.9rem] border border-gray-200 bg-gray-50 px-3 py-2 pr-14 text-[13px] font-semibold text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-main focus:ring-2 focus:ring-main/15 dark:border-white/10 dark:bg-[#312D4B] dark:text-white dark:placeholder:text-white/20 dark:focus:border-info dark:focus:ring-info/15"
                />
              )}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400 dark:text-white/40">
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
              <Select
                label={paymentTypeLabel}
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                options={paymentTypeOptions}
                placeholder={paymentTypePlaceholder}
                required
                error={errors.paymentType?.message}
                className="py-2 text-[13px] dark:bg-[#312D4B] dark:border-white/10 dark:focus:border-info dark:focus:ring-info/15"
              />
            )}
          />
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
                  className="py-2 text-[13px] dark:bg-[#312D4B] dark:border-white/10 dark:focus:border-info dark:focus:ring-info/15"
                />
              )}
            />
          </div>
        )}

        <div>
          <label className="mb-0.5 block text-[12px] font-semibold text-gray-700 dark:text-gray-300">
            {commentLabel}
          </label>
          <textarea
            placeholder={commentPlaceholder}
            rows={1}
            {...register("comment")}
            className="w-full min-h-10 resize-none rounded-[0.9rem] border border-gray-200 bg-gray-50 px-3 py-2 text-[13px] text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-main focus:ring-2 focus:ring-main/15 dark:border-white/10 dark:bg-[#312D4B] dark:text-white dark:placeholder:text-white/20 dark:focus:border-info dark:focus:ring-info/15"
          />
        </div>

        <button
          type="button"
          onClick={handleSubmit(onSubmit)}
          disabled={submitDisabled || submitLoading}
          className={`flex h-9 w-full items-center justify-center gap-1.5 rounded-[0.9rem] bg-linear-to-r text-[13px] font-semibold text-white shadow-lg transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${actionGradient}`}
        >
          <Send size={13} />
          {submitLoading ? "Yuklanmoqda..." : submitLabel}
        </button>
      </div>
    </div>
  );
};

export default memo(CashboxActionFormCard);
