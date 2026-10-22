// dizayn-v2: (maket yo'q) superadmin-payments-market-picker-dialog
import { memo, useEffect, useRef, useState, type FormEvent } from "react";
import { Inbox, Pencil, Plus, Settings, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  useCreateExpenseCategory,
  useDeleteExpenseCategory,
  useExpenseCategories,
  useUpdateExpenseCategory,
  type ExpenseCategory,
  type UpdateExpenseCategoryRequest,
} from "../../../entities/expense-category";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { notify } from "../../../shared/lib/notify";
import {
  Button,
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  QueryBoundary,
  SkeletonList,
  TextInput,
  useConfirm,
} from "../../../shared/ui/primitives";

/**
 * «XARAJAT KATEGORIYALARI» OYNASI — faqat superadmin (Elchi Pochta №1; `canManageExpenseCategories`), «Asosiy
 * kassa» sarlavhasidagi tugmadan. Maket yo'q (`route-map.json`: kategoriyalar backendda yo'qligi uchun
 * chizilmagan) — eng yaqini: ro'yxatli oyna `superadmin-payments-market-picker-dialog`, qator amallari
 * (`Pencil` / qizil `Trash2`) va o'chirish tasdig'i `superadmin-products-*` (`superadmin-products-delete-dialog`),
 * forma — `tizim-states-forms`.
 *
 * Bitta `Dialog` (lg, telefonda pastki varaqa), ikki ko'rinish:
 *  - ro'yxat — faol kategoriyalar `sort_order` bo'yicha: tartib raqami, nom, «Nimalar kiradi», «Tahrirlash» va
 *    «O'chirish» (tasdiq bilan: `useConfirm`, danger, tarix nomni saqlashi aytiladi; xato — tasdiq oynasi ichida);
 *    pastda «Yopish» va bitta asosiy amal «Kategoriya qo'shish»;
 *  - forma — «Nomi *» (1–100), «Nimalar kiradi» (≤ 500, bo'sh — tavsifsiz), «Tartib raqami» (0…1 000 000;
 *    qo'shishda bo'sh — oxiriga). Tahrirlashda faqat o'zgargan maydonlar yuboriladi (o'zgarish yo'q — so'rovsiz
 *    ro'yxatga qaytadi). Takror nom (409) — «Nomi» ostida backend matni; topilmadi (404) — xabar va ro'yxat.
 *
 * Kesh: javob darhol yoziladi va ro'yxat fonda qayta so'raladi (`entities/expense-category`) — «Kassadan xarajat»
 * tanlovi ham shu keshdan o'qiydi.
 */

const NAME_MAX = 100;
const DESCRIPTION_MAX = 500;
const SORT_ORDER_MAX = 1_000_000;

type View = { mode: "list" } | { mode: "create" } | { mode: "edit"; category: ExpenseCategory };

type FormValues = { name: string; description: string; sortOrder: string };
type FormErrors = Partial<Record<keyof FormValues, string>>;

const EMPTY_FORM: FormValues = { name: "", description: "", sortOrder: "" };

/** Backend kabi: bo'shliqlar bittaga, chetlari kesiladi. */
const normalizeName = (value: string) => value.replace(/\s+/g, " ").trim();

const statusOf = (error: unknown) =>
  Number((error as { response?: { status?: unknown } } | null)?.response?.status) || 0;

export type ExpenseCategoriesDialogProps = {
  open: boolean;
  onClose: () => void;
};

const ExpenseCategoriesDialog = ({ open, onClose }: ExpenseCategoriesDialogProps) => {
  const { t, i18n } = useTranslation("payments");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const confirm = useConfirm();
  const query = useExpenseCategories({ enabled: open });
  const createMutation = useCreateExpenseCategory();
  const updateMutation = useUpdateExpenseCategory();
  const deleteMutation = useDeleteExpenseCategory();

  const [view, setView] = useState<View>({ mode: "list" });
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const nameRef = useRef<HTMLInputElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  // Formadan ro'yxatga qaytilganda fokus «Kategoriya qo'shish» ga (forma maydoni DOM'dan ketadi).
  const returnFocusRef = useRef(false);

  const busy = createMutation.isPending || updateMutation.isPending;
  const categories = query.data ?? [];
  const k = (key: string, options?: Record<string, unknown>) => t(`v2ExpenseCategories.${key}`, options);

  useEffect(() => {
    if (view.mode !== "list") {
      nameRef.current?.focus();
    } else if (returnFocusRef.current) {
      returnFocusRef.current = false;
      addButtonRef.current?.focus();
    }
  }, [view]);

  const showList = () => {
    returnFocusRef.current = true;
    setErrors({});
    setView({ mode: "list" });
  };

  const startCreate = () => {
    setValues(EMPTY_FORM);
    setErrors({});
    setView({ mode: "create" });
  };

  const startEdit = (category: ExpenseCategory) => {
    setValues({
      name: category.name,
      description: category.description ?? "",
      sortOrder: String(category.sortOrder),
    });
    setErrors({});
    setView({ mode: "edit", category });
  };

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
    const status = statusOf(error);
    if (status === 409) {
      // «"Yoqilg'i" nomli kategoriya allaqachon bor» — nom maydoni ostida.
      setErrors({ name: getBackendErrorMessage(error) ?? k("notify.saveError") });
      nameRef.current?.focus();
      return;
    }
    if (status === 404) {
      notify.error(k("notify.notFound"), { description: k("notify.notFoundDescription") });
      showList();
      return;
    }
    // Javob umuman kelmasa (tarmoq) interceptor «Tarmoq xatosi» ni o'zi ko'rsatgan — bu yerda umumiy matn.
    notify.error(k("notify.saveError"), { description: status ? getBackendErrorMessage(error) : undefined });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || view.mode === "list") return;
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
      if (view.mode === "create") {
        await createMutation.mutateAsync({
          name,
          ...(description ? { description } : {}),
          ...(sortText !== "" ? { sort_order: Number(sortText) } : {}),
        });
        notify.success(k("notify.created"), { description: k("notify.nameDescription", { name }) });
      } else {
        const { category } = view;
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
      showList();
    } catch (error) {
      handleSaveError(error);
    }
  };

  const handleDelete = async (category: ExpenseCategory) => {
    const ok = await confirm({
      tone: "danger",
      icon: Trash2,
      title: k("delete.title"),
      description: k("delete.description"),
      details: (
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="font-semibold text-text wrap-break-word">{category.name}</span>
          {category.description ? (
            <span className="text-[13px] text-text-muted wrap-break-word">{category.description}</span>
          ) : null}
        </span>
      ),
      note: k("delete.note"),
      irreversible: true,
      confirmLabel: k("delete.confirm"),
      confirmIcon: Trash2,
      loadingLabel: k("delete.loading"),
      onConfirm: () => deleteMutation.mutateAsync(category.id),
    });
    if (ok) notify.success(k("notify.deleted"), { description: k("notify.nameDescription", { name: category.name }) });
  };

  // ── Ro'yxat ─────────────────────────────────────────────────────────────────
  const listBody = (
    <QueryBoundary
      query={query}
      loadingLabel={k("loading")}
      loading={<SkeletonList rows={6} />}
      empty={
        <EmptyState
          icon={Inbox}
          title={k("empty")}
          description={k("emptyDescription")}
        />
      }
      error={(error, retry) => <ErrorState error={error} title={k("loadError")} onRetry={retry} />}
    >
      {(items) => (
        <ul aria-label={k("listLabel")} className="m-0 flex list-none flex-col border-y border-border p-0">
          {items.map((category) => (
            <li
              key={category.id}
              className="flex min-h-14 items-center gap-3 border-b border-border py-3 last:border-b-0"
            >
              <span className="w-8 shrink-0 text-right text-[13px] font-semibold tabular-nums text-text-subtle">
                <span className="sr-only">
                  {k("orderLabel", { n: formatNumberLocalized(category.sortOrder, { language }) })}
                </span>
                <span aria-hidden="true">{formatNumberLocalized(category.sortOrder, { language })}</span>
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-semibold text-text wrap-break-word">{category.name}</span>
                {category.description ? (
                  <span className="text-[13px] text-text-muted wrap-break-word">{category.description}</span>
                ) : (
                  <span className="text-[13px] text-text-subtle">{k("noDescription")}</span>
                )}
              </span>
              <span className="flex shrink-0 items-center gap-1 max-md:gap-0">
                <IconButton
                  size="sm"
                  icon={Pencil}
                  label={k("editAria", { name: category.name })}
                  onClick={() => startEdit(category)}
                />
                <IconButton
                  size="sm"
                  variant="danger"
                  icon={Trash2}
                  label={k("deleteAria", { name: category.name })}
                  onClick={() => void handleDelete(category)}
                />
              </span>
            </li>
          ))}
        </ul>
      )}
    </QueryBoundary>
  );

  // ── Forma ───────────────────────────────────────────────────────────────────
  const isEdit = view.mode === "edit";
  const formBody = (
    <>
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
    </>
  );

  const count = formatNumberLocalized(categories.length, { language });
  const listDescription = query.isSuccess ? k("subtitle", { n: count }) : k("subtitleShort");

  // Bitta `Dialog` — ko'rinish almashganda oyna qayta ochilmaydi (fokus tuzog'i va harakat saqlanadi).
  const isList = view.mode === "list";
  return (
    <Dialog
      open={open}
      onClose={handleClose}
      onExited={() => setView({ mode: "list" })}
      busy={busy}
      size="lg"
      icon={isList ? Settings : isEdit ? Pencil : Plus}
      title={isList ? k("title") : k(isEdit ? "form.editTitle" : "form.addTitle")}
      description={isList ? listDescription : k(isEdit ? "form.editSubtitle" : "form.addSubtitle")}
      closeLabel={k("close")}
      onSubmit={isList ? undefined : (event) => void handleSubmit(event)}
      formProps={isList ? undefined : { noValidate: true }}
      footer={
        isList ? (
          <>
            <Button variant="secondary" onClick={handleClose}>
              {k("close")}
            </Button>
            <Button ref={addButtonRef} leftIcon={Plus} onClick={startCreate} disabled={!query.isSuccess}>
              {k("add")}
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={showList} disabled={busy}>
              {k("form.back")}
            </Button>
            <Button type="submit" loading={busy} loadingText={k("form.saving")}>
              {k(isEdit ? "form.save" : "form.create")}
            </Button>
          </>
        )
      }
    >
      {isList ? listBody : formBody}
    </Dialog>
  );
};

export default memo(ExpenseCategoriesDialog);
