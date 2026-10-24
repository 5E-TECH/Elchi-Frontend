// dizayn-v2: (maket yo'q) superadmin-ops-investors
import { memo, useRef, useState, type FormEvent } from "react";
import { Pencil, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  useCreateExpenseCategory,
  useUpdateExpenseCategory,
  type ExpenseCategory,
  type UpdateExpenseCategoryRequest,
} from "../../../entities/expense-category";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { getErrorStatus } from "../../../shared/lib/errorKind";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { notify } from "../../../shared/lib/notify";
import { Button, Dialog, Field, TextInput } from "../../../shared/ui/primitives";

/**
 * «KATEGORIYA QO'SHISH» / «KATEGORIYANI TAHRIRLASH» OYNASI — Ops → «Xarajat kategoriyalari» (faqat superadmin).
 * Ilgari «Asosiy kassa» dagi boshqaruv oynasining forma ko'rinishi edi — mantiq o'zgarmagan holda shu yerga
 * ko'chdi. Maket yo'q — eng yaqini: Ops ro'yxat + qo'shish naqshi `superadmin-ops-investors`, forma oynasi
 * `tizim-states-forms`.
 *
 * `Dialog` md (telefonda pastki varaqa): «Nomi *» (1–100), «Nimalar kiradi» (≤ 500, bo'sh — tavsifsiz),
 * «Tartib raqami» (0…1 000 000; qo'shishda bo'sh — oxiriga). Tahrirlashda faqat o'zgargan maydonlar yuboriladi
 * (o'zgarish yo'q — so'rovsiz yopiladi; bo'shatilgan tavsif — `null`). Takror nom (409) — «Nomi» ostida backend
 * matni, oyna ochiq qoladi; topilmadi (404) — xabar va oyna yopiladi (ro'yxat fonda qayta so'raladi).
 *
 * Har ochilishda yangi nusxa (`key` — chaqiruvchida): maydonlar boshlang'ich qiymatdan, eski xato qolmaydi.
 */

const NAME_MAX = 100;
const DESCRIPTION_MAX = 500;
const SORT_ORDER_MAX = 1_000_000;

export type ExpenseCategoryFormTarget = { mode: "create" } | { mode: "edit"; category: ExpenseCategory };

type FormValues = { name: string; description: string; sortOrder: string };
type FormErrors = Partial<Record<keyof FormValues, string>>;

/** Backend kabi: bo'shliqlar bittaga, chetlari kesiladi. */
const normalizeName = (value: string) => value.replace(/\s+/g, " ").trim();

const initialValues = (target: ExpenseCategoryFormTarget): FormValues =>
  target.mode === "edit"
    ? {
        name: target.category.name,
        description: target.category.description ?? "",
        sortOrder: String(target.category.sortOrder),
      }
    : { name: "", description: "", sortOrder: "" };

export type ExpenseCategoryFormDialogProps = {
  open: boolean;
  target: ExpenseCategoryFormTarget;
  onClose: () => void;
};

const ExpenseCategoryFormDialog = ({ open, target, onClose }: ExpenseCategoryFormDialogProps) => {
  const { t, i18n } = useTranslation("ops");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const createMutation = useCreateExpenseCategory();
  const updateMutation = useUpdateExpenseCategory();

  const [values, setValues] = useState<FormValues>(() => initialValues(target));
  const [errors, setErrors] = useState<FormErrors>({});
  const nameRef = useRef<HTMLInputElement>(null);

  const isEdit = target.mode === "edit";
  const busy = createMutation.isPending || updateMutation.isPending;
  const k = (key: string, options?: Record<string, unknown>) => t(`expenseCategories.${key}`, options);

  const handleClose = () => {
    if (busy) return;
    onClose();
  };

  const setField = (field: keyof FormValues) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validate = (): FormErrors => {
    const next: FormErrors = {};
    if (!normalizeName(values.name)) next.name = k("form.nameRequired");
    const sortText = values.sortOrder.trim();
    if (sortText !== "") {
      const sortOrder = Number(sortText);
      if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > SORT_ORDER_MAX) {
        next.sortOrder = k("form.sortOrderInvalid", { max: formatNumberLocalized(SORT_ORDER_MAX, { language }) });
      }
    }
    return next;
  };

  const handleSaveError = (error: unknown) => {
    const status = getErrorStatus(error) ?? 0;
    if (status === 409) {
      // «"Yoqilg'i" nomli kategoriya allaqachon bor» — nom maydoni ostida.
      setErrors({ name: getBackendErrorMessage(error) ?? k("notify.saveError") });
      nameRef.current?.focus();
      return;
    }
    if (status === 404) {
      notify.error(k("notify.notFound"), { description: k("notify.notFoundDescription") });
      onClose();
      return;
    }
    // Javob umuman kelmasa (tarmoq) interceptor «Tarmoq xatosi» ni o'zi ko'rsatgan — bu yerda umumiy matn.
    notify.error(k("notify.saveError"), { description: status ? getBackendErrorMessage(error) : undefined });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      if (nextErrors.name) nameRef.current?.focus();
      return;
    }

    const name = normalizeName(values.name);
    const description = values.description.trim();
    const sortText = values.sortOrder.trim();

    try {
      if (target.mode === "create") {
        await createMutation.mutateAsync({
          name,
          ...(description ? { description } : {}),
          ...(sortText !== "" ? { sort_order: Number(sortText) } : {}),
        });
        notify.success(k("notify.created"), { description: k("notify.nameDescription", { name }) });
      } else {
        const { category } = target;
        const body: UpdateExpenseCategoryRequest = {
          ...(name !== category.name ? { name } : {}),
          // Bo'shatilgan tavsif — `null` (backend tozalaydi).
          ...(description !== (category.description ?? "") ? { description: description || null } : {}),
          ...(sortText !== "" && Number(sortText) !== category.sortOrder ? { sort_order: Number(sortText) } : {}),
        };
        if (Object.keys(body).length > 0) {
          await updateMutation.mutateAsync({ id: category.id, body });
          notify.success(k("notify.updated"), { description: k("notify.nameDescription", { name }) });
        }
      }
      onClose();
    } catch (error) {
      handleSaveError(error);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      busy={busy}
      size="md"
      icon={isEdit ? Pencil : Plus}
      title={k(isEdit ? "form.editTitle" : "form.addTitle")}
      description={k(isEdit ? "form.editSubtitle" : "form.addSubtitle")}
      initialFocus={nameRef}
      onSubmit={(event) => void handleSubmit(event)}
      formProps={{ noValidate: true }}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={busy}>
            {k("form.cancel")}
          </Button>
          <Button type="submit" loading={busy} loadingText={k("form.saving")}>
            {k(isEdit ? "form.save" : "form.create")}
          </Button>
        </>
      }
    >
      <Field label={k("form.name")} required error={errors.name}>
        <TextInput
          ref={nameRef}
          name="name"
          value={values.name}
          onValueChange={setField("name")}
          placeholder={k("form.namePlaceholder")}
          maxLength={NAME_MAX}
          autoComplete="off"
        />
      </Field>
      <Field label={k("form.description")} optional error={errors.description}>
        <TextInput
          multiline
          rows={3}
          name="description"
          value={values.description}
          onValueChange={setField("description")}
          placeholder={k("form.descriptionPlaceholder")}
          maxLength={DESCRIPTION_MAX}
        />
      </Field>
      <Field
        label={k("form.sortOrder")}
        optional={!isEdit}
        hint={k(isEdit ? "form.sortOrderEditHint" : "form.sortOrderHint")}
        error={errors.sortOrder}
      >
        <TextInput
          mode="number"
          name="sortOrder"
          value={values.sortOrder}
          onValueChange={setField("sortOrder")}
          autoComplete="off"
          className="max-w-[200px] max-md:max-w-none"
        />
      </Field>
    </Dialog>
  );
};

export default memo(ExpenseCategoryFormDialog);
