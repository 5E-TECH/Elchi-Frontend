// dizayn-v2: (maket yo'q) superadmin-ops-investors
import { memo, useState } from "react";
import { Inbox, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  useDeleteExpenseCategory,
  useExpenseCategories,
  type ExpenseCategory,
} from "../../../entities/expense-category";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { notify } from "../../../shared/lib/notify";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconButton,
  QueryBoundary,
  SkeletonList,
  useConfirm,
} from "../../../shared/ui/primitives";
import ExpenseCategoryFormDialog, { type ExpenseCategoryFormTarget } from "./ExpenseCategoryFormDialog";

/**
 * «XARAJAT KATEGORIYALARI» PANELI — kassa xarajati kategoriyalarini boshqarish (Elchi Pochta №1; faqat
 * superadmin — `/ops` faqat unga ochiq, backend `POST|PATCH|DELETE` ham `@Roles(SUPERADMIN)`). Ilgari «Asosiy kassa»
 * sarlavhasidagi oyna edi (`ExpenseCategoriesDialog`) — ro'yxat, forma va o'chirish mantig'i shu yerga ko'chdi.
 * Maket yo'q — eng yaqini: Ops ro'yxat kartasi `superadmin-ops-investors` / `superadmin-ops-branches`, qator
 * amallari (`Pencil` / qizil `Trash2`) va o'chirish tasdig'i `superadmin-products-delete-dialog`.
 *
 * Bitta karta: sarlavha «Kategoriyalar» + son, o'ngda bitta asosiy amal «Kategoriya qo'shish»; tana — faol
 * kategoriyalar `sort_order` bo'yicha (tartib raqami, nom, «Nimalar kiradi», «Tahrirlash», «O'chirish»).
 * Holatlar `QueryBoundary`: skelet, bo'sh (`EmptyState`), xato (`ErrorState` + «Qayta urinish»); ro'yxat
 * yuklanmaguncha «Kategoriya qo'shish» o'chiq (takror nomni ro'yxatsiz ko'rib bo'lmaydi — eski oynadagidek).
 * Qo'shish / tahrirlash — `ExpenseCategoryFormDialog`; o'chirish — `useConfirm` (danger, tarix nomni saqlashi
 * aytiladi; xato — tasdiq oynasi ichida).
 *
 * Kesh: javob darhol yoziladi va ro'yxat fonda qayta so'raladi (`entities/expense-category`) — «Kassadan
 * xarajat» tanlovi ham shu keshdan o'qiydi.
 */

const ExpenseCategoriesPanel = () => {
  const { t, i18n } = useTranslation("ops");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const confirm = useConfirm();
  const query = useExpenseCategories();
  const deleteMutation = useDeleteExpenseCategory();

  // Forma oynasi har ochilishda yangi nusxa (`key`) — maydonlar shu kategoriyadan, eski xato qolmaydi; yopilishda
  // nusxa o'zgarmaydi (chiqish harakati buzilmaydi).
  const [form, setForm] = useState<{ key: number; open: boolean; target: ExpenseCategoryFormTarget }>({
    key: 0,
    open: false,
    target: { mode: "create" },
  });
  const openForm = (target: ExpenseCategoryFormTarget) =>
    setForm((current) => ({ key: current.key + 1, open: true, target }));
  const closeForm = () => setForm((current) => ({ ...current, open: false }));

  const k = (key: string, options?: Record<string, unknown>) => t(`expenseCategories.${key}`, options);
  const number = (value: number) => formatNumberLocalized(value, { language });

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

  const count = query.isSuccess ? <Badge>{t("common.count", { count: query.data.length })}</Badge> : null;

  return (
    <>
      <Card
        padding="none"
        title={k("list.title")}
        titleAddon={count}
        actions={
          <Button
            size="sm"
            leftIcon={Plus}
            onClick={() => openForm({ mode: "create" })}
            disabled={!query.isSuccess}
          >
            {k("list.add")}
          </Button>
        }
      >
        <QueryBoundary
          query={query}
          loadingLabel={k("list.loading")}
          loading={<SkeletonList rows={6} />}
          empty={<EmptyState icon={Inbox} title={k("list.empty")} description={k("list.emptyDescription")} />}
          error={(error, retry) => <ErrorState error={error} title={k("list.loadError")} onRetry={retry} />}
        >
          {(items) => (
            <ul aria-label={k("list.label")} className="m-0 flex list-none flex-col p-0">
              {items.map((category) => (
                <li
                  key={category.id}
                  className="flex min-h-14 items-center gap-3 border-b border-border px-5 py-3 last:border-b-0 max-md:px-4"
                >
                  <span className="w-8 shrink-0 text-right text-[13px] font-semibold tabular-nums text-text-subtle">
                    <span className="sr-only">{k("list.orderLabel", { n: number(category.sortOrder) })}</span>
                    <span aria-hidden="true">{number(category.sortOrder)}</span>
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-semibold text-text wrap-break-word">{category.name}</span>
                    {category.description ? (
                      <span className="text-[13px] text-text-muted wrap-break-word">{category.description}</span>
                    ) : (
                      <span className="text-[13px] text-text-subtle">{k("list.noDescription")}</span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-1 max-md:gap-0">
                    <IconButton
                      size="sm"
                      icon={Pencil}
                      label={k("list.editAria", { name: category.name })}
                      onClick={() => openForm({ mode: "edit", category })}
                    />
                    <IconButton
                      size="sm"
                      variant="danger"
                      icon={Trash2}
                      label={k("list.deleteAria", { name: category.name })}
                      onClick={() => void handleDelete(category)}
                    />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </QueryBoundary>
      </Card>

      <ExpenseCategoryFormDialog key={form.key} open={form.open} target={form.target} onClose={closeForm} />
    </>
  );
};

export default memo(ExpenseCategoriesPanel);
