// Migrated to React Hook Form
import { memo, useEffect, type ReactNode } from "react";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { ChevronDown, X } from "lucide-react";
import Popup from "../../../shared/ui/Popup";
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
    type: string;
    comment: string;
}

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
    typeLabel?: string;
    typePlaceholder?: string;
    requireType?: boolean;
    requireComment?: boolean;
    isLoading?: boolean;
    onSubmit: (data: { amount: number; type?: string; comment: string }) => void;
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
    typeLabel,
    typePlaceholder,
    requireType = false,
    requireComment = false,
    isLoading = false,
    onSubmit,
}: CashboxFormPopupProps) => {
    const { t } = useTranslation("payments");
    const cashboxFormSchema: yup.ObjectSchema<CashboxFormValues> = yup.object({
        amount: yup
            .string()
            .required(i18n.t("payments:amountRequired"))
            .test("positive-number", i18n.t("payments:amountPositiveValidation"), (value) => {
                return parseAmountInput(value) > 0;
            }),
        type: requireType
            ? yup.string().required(i18n.t("payments:paymentTypeRequired"))
            : yup.string().defined(),
        comment: requireComment
            ? yup.string().trim().required(i18n.t("payments:commentRequired"))
            : yup.string().defined(),
    });

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
            type: "",
            comment: "",
        },
        resolver: yupResolver(cashboxFormSchema) as Resolver<CashboxFormValues>,
    });

    const amount = watch("amount");
    const selectedType = watch("type");
    const comment = watch("comment");
    const hasTypeOptions = sourceTypes.length > 0;

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
            ...(values.type ? { type: values.type } : {}),
            comment: values.comment.trim(),
        });
    };

    const isValid =
        amount !== "" &&
        parseAmountInput(amount) > 0 &&
        (!requireType || selectedType !== "") &&
        (!requireComment || comment.trim() !== "");

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
                    {hasTypeOptions && (
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[13px] font-semibold text-gray-700 dark:text-white/70">
                            {(typeLabel ?? t("paymentType"))} {requireType && <span className="text-rose-400">*</span>}
                        </label>
                        <Controller
                            control={control}
                            name="type"
                            render={({ field }) => (
                                <div className="rounded-[1rem] border border-gray-200 bg-gray-50/90 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] dark:border-glass-border dark:bg-white/[0.04]">
                                    <div className="relative">
                                        <select
                                            id={field.name}
                                            name={field.name}
                                            value={field.value}
                                            onChange={field.onChange}
                                            className="h-9 w-full appearance-none rounded-[0.8rem] bg-transparent px-3 pr-9 text-sm font-medium text-gray-900 outline-none dark:text-white"
                                        >
                                            <option value="">
                                                {typePlaceholder ?? t("paymentTypePlaceholder")}
                                            </option>
                                            {sourceTypes.map((item) => (
                                                <option key={item.id} value={String(item.id)} className="dark:bg-maindark">
                                                    {item.name}
                                                </option>
                                            ))}
                                        </select>
                                        <ChevronDown
                                            size={16}
                                            className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/40"
                                        />
                                    </div>
                                </div>
                            )}
                        />
                        {errors.type && (
                            <p className="text-xs text-red-500">{errors.type.message}</p>
                        )}
                    </div>
                    )}

                    {/* Comment */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[13px] font-semibold text-gray-700 dark:text-white/70">
                            {t("comment")} {requireComment && <span className="text-rose-400">*</span>}
                        </label>
                        <div className="rounded-[1rem] border border-gray-200 bg-gray-50/90 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] dark:border-glass-border dark:bg-white/[0.04]">
                            <textarea
                                rows={2}
                                placeholder={t("commentPlaceholder")}
                                {...register("comment")}
                                className="w-full resize-none rounded-[0.8rem] bg-transparent px-3 py-2.5 text-[13px] leading-4.5 text-gray-900 outline-none placeholder:text-gray-400 dark:text-white dark:placeholder:text-white/20"
                            />
                        </div>
                        {errors.comment && (
                            <p className="text-xs text-red-500">{errors.comment.message}</p>
                        )}
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
