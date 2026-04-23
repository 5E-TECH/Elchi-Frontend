// Migrated to React Hook Form
import { memo, useEffect, type ReactNode } from "react";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { X } from "lucide-react";
import Popup from "../../../shared/ui/Popup";
import Select from "../../../shared/ui/Select";
import HeaderName from "../../../shared/components/headerName";
import Button from "../../../shared/components/button";
import { useTranslation } from "react-i18next";
import i18n from "../../../i18n";
import {
    formatAmountInput,
    parseAmountInput,
} from "./lib/amountInput";

interface CashboxFormValues {
    amount: string;
    source_type_id: string;
    comment: string;
}

const cashboxFormSchema: yup.ObjectSchema<CashboxFormValues> = yup.object({
    amount: yup
        .string()
        .required(i18n.t("payments:amountRequired"))
        .test("positive-number", i18n.t("payments:amountPositiveValidation"), (value) => {
            return parseAmountInput(value) > 0;
        }),
    source_type_id: yup.string().defined(),
    comment: yup.string().defined(),
});

interface CashboxFormPopupProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description: string;
    icon: ReactNode;
    accentColor: string;      // e.g. "from-rose-500 to-rose-600"
    submitLabel: string;
    submitIcon?: ReactNode;
    sourceTypes?: { id: string | number; name: string }[];
    isLoading?: boolean;
    onSubmit: (data: { amount: number; source_type_id?: string; comment: string }) => void;
}

const CashboxFormPopup = ({
    isOpen,
    onClose,
    title,
    description,
    icon,
    accentColor,
    submitLabel,
    submitIcon,
    sourceTypes = [],
    isLoading = false,
    onSubmit,
}: CashboxFormPopupProps) => {
    const { t } = useTranslation("payments");
    const {
        register,
        control,
        handleSubmit,
        reset,
        formState: { errors },
        watch,
    } = useForm<CashboxFormValues>({
        defaultValues: {
            amount: "",
            source_type_id: "",
            comment: "",
        },
        resolver: yupResolver(cashboxFormSchema) as Resolver<CashboxFormValues>,
    });

    const amount = watch("amount");
    const sourceTypeId = watch("source_type_id");
    const hasSourceTypes = sourceTypes.length > 0;

    const handleClose = () => {
        reset();
        onClose();
    };

    useEffect(() => {
        if (!isOpen) {
            reset();
        }
    }, [isOpen, reset]);

    const submitForm = (values: CashboxFormValues) => {
        onSubmit({
            amount: parseAmountInput(values.amount),
            ...(values.source_type_id ? { source_type_id: values.source_type_id } : {}),
            comment: values.comment,
        });
        handleClose();
    };

    const isValid =
        amount !== "" &&
        parseAmountInput(amount) > 0 &&
        (!hasSourceTypes || sourceTypeId !== "");

    return (
        <Popup isShow={isOpen} onClose={handleClose}>
            <div className="bg-primary dark:bg-maindark w-[92vw] max-w-115 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
                {/* Gradient header */}
                <div className={`bg-linear-to-r ${accentColor} px-6 py-5 flex items-center justify-between`}>
                    <HeaderName name={title} description={description} icon={icon} />
                    <button
                        onClick={handleClose}
                        className="w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors shrink-0"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Form body */}
                <div className="px-5 py-5 flex flex-col gap-4">
                    {/* Amount */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[13px] font-semibold text-gray-700 dark:text-white/70">
                            {t("amountLabel")} <span className="text-rose-400">*</span>
                        </label>
                        <div className="rounded-[1rem] border border-gray-200 bg-gray-50/90 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] dark:border-glass-border dark:bg-white/[0.04]">
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
                                            className="h-9 w-full rounded-[0.8rem] bg-transparent px-3 pr-16 text-sm font-semibold tracking-[0.02em] text-gray-900 outline-none placeholder:text-gray-400 dark:text-white dark:placeholder:text-white/20"
                                        />
                                    )}
                                />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-main/10 px-2 py-0.5 text-[10px] font-bold tracking-[0.1em] text-main dark:bg-white/10 dark:text-white/75 pointer-events-none">
                                    UZS
                                </span>
                            </div>
                        </div>
                        {errors.amount && (
                            <p className="text-xs text-red-500">{errors.amount.message}</p>
                        )}
                    </div>

                    {/* Payment type */}
                    {hasSourceTypes && (
                    <div className="flex flex-col gap-1.5">
                        <Controller
                            control={control}
                            name="source_type_id"
                            render={({ field }) => (
                                <Select
                                    label={t("paymentType")}
                                    name={field.name}
                                    value={field.value}
                                    onChange={field.onChange}
                                    options={sourceTypes.map((item) => ({
                                        value: String(item.id),
                                        label: item.name,
                                    }))}
                                    placeholder={t("paymentTypePlaceholder")}
                                    required
                                    error={errors.source_type_id?.message}
                                    className="dark:bg-[#312D4B] dark:border-glass-border dark:focus:border-main dark:focus:ring-main/10"
                                />
                            )}
                        />
                    </div>
                    )}

                    {/* Comment */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[13px] font-semibold text-gray-700 dark:text-white/70">
                            {t("comment")}
                        </label>
                        <div className="rounded-[1rem] border border-gray-200 bg-gray-50/90 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] dark:border-glass-border dark:bg-white/[0.04]">
                            <textarea
                                rows={2}
                                placeholder={t("commentPlaceholder")}
                                {...register("comment")}
                                className="w-full resize-none rounded-[0.8rem] bg-transparent px-3 py-2.5 text-[13px] leading-4.5 text-gray-900 outline-none placeholder:text-gray-400 dark:text-white dark:placeholder:text-white/20"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer buttons */}
                <div className="flex justify-end gap-3 px-6 pb-6">
                    <Button
                        label={t("cancelLabel")}
                        className="border border-gray-200 dark:border-glass-border text-gray-600 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/5"
                        onClick={handleClose}
                    />
                    <Button
                        label={isLoading ? t("loadingLabel") : submitLabel}
                        icon={submitIcon}
                        className={`px-7 bg-linear-to-r ${accentColor} text-white ${!isValid || isLoading ? "opacity-50 cursor-not-allowed" : "hover:opacity-90"
                            }`}
                        onClick={handleSubmit(submitForm)}
                        disabled={!isValid || isLoading}
                    />
                </div>
            </div>
        </Popup>
    );
};

export default memo(CashboxFormPopup);
