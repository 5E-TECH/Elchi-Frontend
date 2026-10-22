// dizayn-v2: superadmin-payments-main-cashbox-fill-dialog, admin-payments-cashbox-form-dialog, manager-payments-cashbox-form-dialog
import { memo, useEffect, useId, useMemo, useRef, type ReactNode } from "react";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { Banknote, Check, CreditCard, Minus, Plus, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from "../../../i18n";
import { useExpenseCategories } from "../../../entities/expense-category";
import { CURRENCY_LABEL, resolveMoneyLanguage } from "../../../shared/lib/formatMoney";
import {
    Badge,
    Button,
    Dialog,
    Field,
    SegmentedControl,
    Select,
    TextInput,
    useConfirm,
    type SelectOption,
} from "../../../shared/ui/primitives";
import { parseAmountInput } from "./lib/amountInput";

/**
 * «KASSANI TO'LDIRISH» / «KASSADAN XARAJAT» OYNASI — asosiy kassa (dizayn v2, maketlar
 * `superadmin-payments-main-cashbox-fill-dialog`, `admin-payments-cashbox-form-dialog`,
 * `manager-payments-cashbox-form-dialog`).
 *
 * `Dialog` md (telefonda pastki varaqa): ikonka Plus/Minus, sarlavha + «Kirim/Chiqim operatsiyasi · Asosiy kassa»;
 * «Summa *» (katta maydon, mingliklar bilan, o'ngda «so'm»), «To'lov turi *» segment (Naqd · Karta (Click)),
 * «Izoh *»; pastda «Bekor qilish» / «Kirimni saqlash» | «Xarajatni saqlash».
 *
 * Validatsiya (yup) o'zgarmagan: summa majburiy va > 0, `requireType` / `requireComment` (izoh `trim` bilan).
 * Xato matnlari maydon ostida — saqlash bosilganda (maketdagi «Izoh majburiy — …» holati).
 *
 * Pul harakati — TASDIQ bilan: «saqlash» → `useConfirm` (summa + to'lov turi, «Kassa», «Kategoriya», «Izoh») →
 * faqat «Tasdiqlash» dan keyin `onSubmit({ amount, type?, comment, expense_category_id? })`. Ikki marta yuborish
 * yo'q: tasdiq ochiq yoki so'rov ketayotganda qayta bosish e'tiborsiz (ref qulf), `isLoading` da tugma yuklanishda
 * va oyna yopilmaydi.
 *
 * «Xarajat kategoriyasi» (Elchi Pochta №1; maketda yo'q — `route-map.json` izohi, eng yaqini shu oynaning
 * `Select` maydonlari, taxta `tizim-states-forms` 03) — FAQAT `variant="spend"`: ixtiyoriy, qidiruvli `Select`
 * (`GET finance/cashbox/expense-categories`, faol kategoriyalar `sort_order` bo'yicha, ostida «Nimalar kiradi»),
 * tanlansa payload'ga `expense_category_id` qo'shiladi, tanlanmasa — kalit umuman yo'q. To'ldirish oynasida maydon
 * ham, so'rov ham yo'q (backend `fill` bu maydonni 400 bilan rad etadi). Ro'yxat yuklanmasa forma ishlayveradi —
 * maydon o'chiq, ostida sabab va «Qayta urinish»; tanlangan kategoriya ro'yxatdan yo'qolsa (o'chirilgan) qiymat
 * tozalanadi.
 */

interface CashboxFormValues {
    amount: string;
    type: string;
    comment: string;
    /** Faqat `spend`: tanlangan kategoriya ID si yoki `""`. */
    expenseCategoryId: string;
}

export type CashboxFormPayload = {
    amount: number;
    type?: string;
    comment: string;
    /** Faqat `spend` va kategoriya tanlangan bo'lsa (raqamli satr ID). */
    expense_category_id?: string;
};

interface CashboxFormPopupProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    /** Sarlavha ostidagi izoh (`subtitle` berilmasa). */
    description: string;
    /** Eski (v1) — e'tiborsiz: ikonka `variant` dan. */
    icon?: ReactNode;
    /** Eski (v1) — e'tiborsiz. */
    accentColor?: string;
    submitLabel: string;
    /** Eski (v1) — e'tiborsiz: ikonka `variant` dan. */
    submitIcon?: ReactNode;
    sourceTypes?: { id: string | number; name: string }[];
    typeLabel?: string;
    /** Eski (v1) — segmentda bo'sh matn yo'q. */
    typePlaceholder?: string;
    requireType?: boolean;
    requireComment?: boolean;
    isLoading?: boolean;
    /** Tasdiqdan KEYIN chaqiriladi. */
    onSubmit: (data: CashboxFormPayload) => void | Promise<unknown>;
    /** `fill` — kirim (Plus), `spend` — chiqim (Minus). */
    variant?: "fill" | "spend";
    subtitle?: string;
    commentPlaceholder?: string;
    commentRequiredMessage?: string;
    typeRequiredMessage?: string;
    /** Berilsa — yuborishdan oldin tasdiq oynasi (pul harakati — majburiy). */
    confirm?: { title: string; cashboxLabel: string };
}

const TYPE_ICON: Record<string, LucideIcon> = { cash: Banknote, click: CreditCard };

const CashboxFormPopup = ({
    isOpen,
    onClose,
    title,
    description,
    submitLabel,
    sourceTypes = [],
    typeLabel,
    requireType = false,
    requireComment = false,
    isLoading = false,
    onSubmit,
    variant = "fill",
    subtitle,
    commentPlaceholder,
    commentRequiredMessage,
    typeRequiredMessage,
    confirm: confirmCopy,
}: CashboxFormPopupProps) => {
    const { t, i18n: i18nInstance } = useTranslation("payments");
    const language = resolveMoneyLanguage(i18nInstance.resolvedLanguage ?? i18nInstance.language);
    const confirm = useConfirm();
    const fieldId = useId();
    // Tasdiq ochiq yoki so'rov ketmoqda — ikkinchi «saqlash» e'tiborsiz.
    const submittingRef = useRef(false);

    // Qoidalar eski sxema bilan AYNAN; xato matnlari chaqiruvchidan (maketdagi izoh matni) yoki eski kalitlar.
    const cashboxFormSchema: yup.ObjectSchema<CashboxFormValues> = yup.object({
        amount: yup
            .string()
            .required(i18n.t("payments:amountRequired"))
            .test("positive-number", i18n.t("payments:amountPositiveValidation"), (value) => {
                return parseAmountInput(value) > 0;
            }),
        type: requireType
            ? yup.string().required(typeRequiredMessage ?? i18n.t("payments:paymentTypeRequired"))
            : yup.string().defined(),
        comment: requireComment
            ? yup.string().trim().required(commentRequiredMessage ?? i18n.t("payments:commentRequired"))
            : yup.string().defined(),
        expenseCategoryId: yup.string().defined(),
    });

    const {
        control,
        handleSubmit,
        reset,
        setValue,
        watch,
        formState: { errors },
    } = useForm<CashboxFormValues>({
        defaultValues: {
            amount: "",
            type: "",
            comment: "",
            expenseCategoryId: "",
        },
        resolver: yupResolver(cashboxFormSchema) as Resolver<CashboxFormValues>,
    });

    const hasTypeOptions = sourceTypes.length > 0;
    const busy = isLoading;

    // ── Xarajat kategoriyasi (faqat chiqim) ─────────────────────────────────────
    const withCategory = variant === "spend";
    const categoriesQuery = useExpenseCategories({ enabled: isOpen && withCategory });
    const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
    const categoryOptions = useMemo<SelectOption[]>(
        () =>
            categories.map((category) => ({
                value: category.id,
                label: category.name,
                description: category.description ?? undefined,
                searchText: category.description ?? undefined,
            })),
        [categories],
    );
    const selectedCategoryId = watch("expenseCategoryId");
    const selectedCategory = categories.find((category) => category.id === selectedCategoryId) ?? null;
    const categoriesLoaded = categoriesQuery.isSuccess;
    // Tanlangan kategoriya yangilangan ro'yxatda yo'q (boshqa superadmin o'chirgan, «Kassadan xarajat» 400 dan
    // keyin ro'yxat qayta o'qildi) — eskirgan ID qayta yuborilmasin.
    useEffect(() => {
        if (selectedCategoryId && categoriesLoaded && !selectedCategory) {
            setValue("expenseCategoryId", "");
        }
    }, [categoriesLoaded, selectedCategory, selectedCategoryId, setValue]);

    const handleClose = () => {
        if (busy) return;
        reset();
        onClose();
    };

    useEffect(() => {
        if (!isOpen) {
            reset();
        }
    }, [isOpen, reset]);

    const typeName = (value?: string) =>
        sourceTypes.find((item) => String(item.id) === value)?.name ?? value ?? "";

    const submitForm = async (values: CashboxFormValues) => {
        if (submittingRef.current || busy) return;
        submittingRef.current = true;
        try {
            const category = withCategory
                ? (categories.find((item) => item.id === values.expenseCategoryId) ?? null)
                : null;
            const payload: CashboxFormPayload = {
                amount: parseAmountInput(values.amount),
                ...(values.type ? { type: values.type } : {}),
                comment: values.comment.trim(),
                ...(category ? { expense_category_id: category.id } : {}),
            };

            if (confirmCopy) {
                const ok = await confirm({
                    tone: "success",
                    title: confirmCopy.title,
                    description: t("v2MainCashbox.confirm.description"),
                    amount: {
                        value: payload.amount,
                        badge: payload.type ? <Badge>{typeName(payload.type)}</Badge> : undefined,
                    },
                    rows: [
                        { label: t("v2MainCashbox.confirm.cashbox"), value: confirmCopy.cashboxLabel },
                        ...(category ? [{ label: t("v2MainCashbox.confirm.category"), value: category.name }] : []),
                        ...(payload.comment
                            ? [{ label: t("v2MainCashbox.confirm.comment"), value: payload.comment, stacked: true }]
                            : []),
                    ],
                    confirmLabel: t("v2MainCashbox.confirm.submit"),
                    confirmIcon: Check,
                });
                if (!ok) return;
            }

            await onSubmit(payload);
        } finally {
            submittingRef.current = false;
        }
    };

    const Icon = variant === "spend" ? Minus : Plus;
    const typeFieldId = `${fieldId}-type`;

    const categoryHint = categoriesQuery.isError ? (
        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{t("v2MainCashbox.form.categoryLoadError")}</span>
            <Button
                variant="link"
                size="sm"
                onClick={() => void categoriesQuery.refetch()}
                className="max-md:min-h-11"
            >
                {t("v2MainCashbox.form.categoryRetry")}
            </Button>
        </span>
    ) : selectedCategory?.description ? (
        t("v2MainCashbox.form.categoryIncludes", { text: selectedCategory.description })
    ) : undefined;

    return (
        <Dialog
            open={isOpen}
            onClose={handleClose}
            busy={busy}
            size="md"
            icon={Icon}
            title={title}
            description={subtitle ?? description}
            onSubmit={handleSubmit(submitForm)}
            formProps={{ noValidate: true }}
            footer={
                <>
                    <Button variant="secondary" onClick={handleClose} disabled={busy}>
                        {t("v2MainCashbox.form.cancel")}
                    </Button>
                    <Button
                        type="submit"
                        leftIcon={Icon}
                        loading={busy}
                        loadingText={t("v2MainCashbox.form.saving")}
                    >
                        {submitLabel}
                    </Button>
                </>
            }
        >
            <Field label={t("v2MainCashbox.form.amount")} required error={errors.amount?.message}>
                <Controller
                    control={control}
                    name="amount"
                    render={({ field }) => (
                        <TextInput
                            mode="money"
                            size="lg"
                            name={field.name}
                            value={field.value}
                            onValueChange={field.onChange}
                            onBlur={field.onBlur}
                            placeholder="0"
                            autoComplete="off"
                            suffix={<Badge>{CURRENCY_LABEL[language]}</Badge>}
                        />
                    )}
                />
            </Field>

            {hasTypeOptions ? (
                <Field
                    id={typeFieldId}
                    labelAs="span"
                    label={typeLabel ?? t("v2MainCashbox.form.paymentType")}
                    required={requireType}
                    error={errors.type?.message}
                >
                    <Controller
                        control={control}
                        name="type"
                        render={({ field }) => (
                            <SegmentedControl
                                ariaLabel={typeLabel ?? t("v2MainCashbox.form.paymentType")}
                                aria-labelledby={`${typeFieldId}-label`}
                                aria-describedby={errors.type ? `${typeFieldId}-error` : undefined}
                                fullWidth
                                value={field.value}
                                onValueChange={field.onChange}
                                options={sourceTypes.map((item) => ({
                                    value: String(item.id),
                                    label: item.name,
                                    icon: TYPE_ICON[String(item.id)],
                                }))}
                            />
                        )}
                    />
                </Field>
            ) : null}

            {withCategory ? (
                <Field
                    labelAs="span"
                    label={t("v2MainCashbox.form.category")}
                    optional
                    hint={categoryHint}
                    disabled={categoriesQuery.isError}
                >
                    <Controller
                        control={control}
                        name="expenseCategoryId"
                        render={({ field }) => (
                            <Select
                                searchable
                                clearable
                                name={field.name}
                                value={field.value || null}
                                onChange={(value) => field.onChange(value ?? "")}
                                onBlur={field.onBlur}
                                options={categoryOptions}
                                placeholder={t("v2MainCashbox.form.categoryPlaceholder")}
                                listLabel={t("v2MainCashbox.form.categoryListLabel")}
                                clearLabel={t("v2MainCashbox.form.categoryClear")}
                                loading={categoriesQuery.isLoading}
                                loadingText={t("v2MainCashbox.form.categoryLoading")}
                                noOptionsText={t("v2MainCashbox.form.categoryEmpty")}
                            />
                        )}
                    />
                </Field>
            ) : null}

            <Field
                label={t("v2MainCashbox.form.comment")}
                required={requireComment}
                error={errors.comment?.message}
            >
                <Controller
                    control={control}
                    name="comment"
                    render={({ field }) => (
                        <TextInput
                            multiline
                            rows={3}
                            name={field.name}
                            value={field.value}
                            onValueChange={field.onChange}
                            onBlur={field.onBlur}
                            placeholder={commentPlaceholder ?? t("commentPlaceholder")}
                        />
                    )}
                />
            </Field>
        </Dialog>
    );
};

export default memo(CashboxFormPopup);
