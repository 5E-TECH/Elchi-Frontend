// dizayn-v2: superadmin-branches-add-employee-dialog
import { yupResolver } from "@hookform/resolvers/yup";
import { useController, useForm } from "react-hook-form";
import { useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
import { Check, Info, SearchX, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useUsers, type IdentityUser } from "../../../entities/user";
import { branchPositionLabel } from "../../branch/lib/branchDisplay";
import { addEmployeeSchema } from "../model/schema";
import { useAddEmployee, type AddEmployeeDto } from "../api/useAddEmployee";
import { getActionErrorMessage } from "../../../shared/lib/actionError";
import { cx } from "../../../shared/lib/cx";
import { notify } from "../../../shared/lib/notify";
import { Button, Dialog, Field, Skeleton, TextInput } from "../../../shared/ui/primitives";

/**
 * Filialga faqat shu rollar biriktiriladi — backend `resolveBranchRoleFromUserRole`
 * boshqasini 400 bilan rad etadi (fix3 CODE-21). Ilgari ro'yxat admin/operator
 * foydalanuvchilarni ko'rsatardi, ya'ni har qanday tanlov rad etilardi.
 */
const BRANCH_ASSIGNABLE_ROLES = ["manager", "registrator", "courier"] as const;

/** `.el-options` (CODE-MAP 2.2): ro'yxat oyna ichida, eng ko'pi 280 px, ichida aylanadi. */
const OPTIONS =
  "flex max-h-[280px] min-h-0 flex-col gap-0.5 overflow-y-auto overscroll-contain rounded-xl border border-border " +
  "bg-raised p-1.5 shadow-sm";
/** `.el-option` — telefonda ≥ 44 px. */
const OPTION =
  "flex min-h-11 w-full cursor-pointer select-none items-center justify-between gap-2.5 rounded-lg px-2.5 py-1.5 " +
  "text-left text-sm text-text transition-[background-color] duration-150 motion-reduce:transition-none";

const normalize = (value: string) => value.toLocaleLowerCase().replace(/[ʻʼ‘’`]/g, "'").trim();

/**
 * «XODIM QO'SHISH» oynasi (maket `superadmin-branches-add-employee-dialog`; telefonda pastki varaqa):
 * «{filial}ga foydalanuvchini biriktiring.», «Foydalanuvchi *» — qidiruv maydoni va uning ostida oyna ichidagi
 * ro'yxat (ism, ostida «login · rol»), izoh «Faqat faol menejer, ro'yxatchi va kuryerlar ko'rsatiladi»,
 * «Bekor qilish» / «Qo'shish». Qidiruv — kelgan ro'yxat ichida (ism, login, telefon).
 *
 * Klaviatura (fokus qidiruvda, `aria-activedescendant`): ↑ ↓ Home End — ro'yxatda yurish, Enter — tanlash
 * (forma yuborilmaydi). Qatorni bosish tanlaydi; «Qo'shish» yuboradi.
 *
 * Xulq o'zgarmagan: `GET /users?status=active&role=…` (faqat oyna ochiq bo'lsa), `addEmployeeSchema`,
 * `POST /branches/:id/users { user_id }`; rad etilsa oyna ochiq qoladi va sabab xabarda.
 */
const AddEmployeeModal = ({
  branchId,
  branchName,
  open,
  onClose,
}: {
  branchId: string;
  /** Izohdagi filial nomi («Urgut filialiga …»); berilmasa — umumiy izoh. */
  branchName?: string;
  open: boolean;
  onClose: () => void;
}) => {
  const { t } = useTranslation(["branches", "common"]);
  const listId = useId();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const { data: users = [], isLoading: usersLoading } = useUsers({
    status: "active",
    role: [...BRANCH_ASSIGNABLE_ROLES],
    page: 1,
    limit: 100,
    enabled: open,
  });
  const addEmployee = useAddEmployee(branchId);
  const { control, handleSubmit, reset } = useForm<AddEmployeeDto>({
    resolver: yupResolver(addEmployeeSchema),
    defaultValues: { user_id: "" },
  });
  const { field, fieldState } = useController({ control, name: "user_id" });

  useEffect(() => {
    if (!open) reset({ user_id: "" });
  }, [open, reset]);

  const meta = (user: IdentityUser) =>
    [user.username, user.role ? branchPositionLabel(user.role, t) : ""].filter(Boolean).join(" · ");

  const visible = useMemo(() => {
    const needle = normalize(query);
    if (!needle) return users;
    return users.filter((user) =>
      [user.fullName, user.username, user.phone].some((value) => normalize(String(value ?? "")).includes(needle)),
    );
  }, [query, users]);

  const current = activeIndex >= 0 && activeIndex < visible.length ? activeIndex : -1;
  const optionId = (user: IdentityUser) => `${listId}-${encodeURIComponent(user.id)}`;

  const choose = (user: IdentityUser) => {
    field.onChange(user.id);
  };

  const move = (index: number) => {
    if (visible.length === 0) return;
    const next = (index + visible.length) % visible.length;
    setActiveIndex(next);
    document.getElementById(optionId(visible[next]))?.scrollIntoView?.({ block: "nearest" });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        move(current < 0 ? 0 : current + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        move(current < 0 ? visible.length - 1 : current - 1);
        break;
      case "Home":
      case "End":
        if (visible.length === 0) return;
        event.preventDefault();
        move(event.key === "Home" ? 0 : visible.length - 1);
        break;
      case "Enter": {
        // Enter faqat faol qatorni tanlaydi — forma (Qo'shish) yuborilmaydi.
        event.preventDefault();
        const user = visible[current];
        if (user) choose(user);
        break;
      }
      default:
        break;
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      await addEmployee.mutateAsync(values);
    } catch (error) {
      // Oyna ochiq qoladi — sabab ko'rinadi (masalan "boshqa filialga biriktirilgan").
      const description = getActionErrorMessage(error, t("employee.addError"));
      if (description) notify.error(description);
      return;
    }
    notify.success(t("employee.added"));
    onClose();
    reset();
  });

  const pending = addEmployee.isPending;
  const description = branchName ? t("v2.addEmployee.description", { branch: branchName }) : t("employee.addDescription");

  return (
    <Dialog
      open={open}
      onClose={onClose}
      // Yopilgach qidiruv tozalanadi (keyingi ochilishda ro'yxat to'liq).
      onExited={() => {
        setQuery("");
        setActiveIndex(-1);
      }}
      busy={pending}
      title={t("employee.add")}
      description={description}
      icon={UserPlus}
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
      formProps={{ noValidate: true }}
      footer={
        <>
          <Button variant="secondary" disabled={pending} onClick={onClose}>
            {t("cancel", { ns: "common" })}
          </Button>
          <Button type="submit" loading={pending}>
            {t("employee.addAction")}
          </Button>
        </>
      }
    >
      <Field
        label={t("employee.user")}
        required
        error={fieldState.error?.message}
        hint={
          <span className="inline-flex items-start gap-1.5">
            <Info aria-hidden="true" size={16} strokeWidth={2} className="shrink-0" />
            {t("v2.addEmployee.hint")}
          </span>
        }
      >
        <TextInput
          mode="search"
          value={query}
          onValueChange={(next) => {
            setQuery(next);
            setActiveIndex(-1);
          }}
          placeholder={t("employee.selectUser")}
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={current >= 0 ? optionId(visible[current]) : undefined}
          autoComplete="off"
          onKeyDown={handleKeyDown}
        />
        <div
          id={listId}
          role="listbox"
          aria-label={t("v2.addEmployee.listLabel")}
          aria-busy={usersLoading || undefined}
          // Bosilganda fokus qidiruv maydonida qoladi (`aria-activedescendant`).
          onMouseDown={(event) => event.preventDefault()}
          className={OPTIONS}
        >
          {usersLoading
            ? Array.from({ length: 4 }, (_, index) => (
                <div key={index} role="presentation" className="flex min-h-11 flex-col justify-center gap-1.5 px-2.5 py-1.5">
                  <Skeleton width="45%" />
                  <Skeleton width="30%" />
                </div>
              ))
            : visible.map((user, index) => {
                const selected = field.value === user.id;
                return (
                  <div
                    key={user.id}
                    id={optionId(user)}
                    role="option"
                    aria-selected={selected}
                    data-active={index === current || undefined}
                    onMouseMove={() => {
                      if (index !== current) setActiveIndex(index);
                    }}
                    onClick={() => choose(user)}
                    className={cx(
                      OPTION,
                      selected ? "bg-action-soft text-action-fg" : index === current ? "bg-sunken" : "hover:bg-sunken",
                    )}
                  >
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className={cx("truncate", selected && "font-semibold")}>{user.fullName}</span>
                      {meta(user) ? <span className="text-xs font-medium text-text-muted">{meta(user)}</span> : null}
                    </span>
                    {selected ? <Check aria-hidden="true" size={16} strokeWidth={2} className="shrink-0" /> : null}
                  </div>
                );
              })}
          {!usersLoading && visible.length === 0 ? (
            <div role="presentation" className="flex flex-col items-center gap-1.5 px-2.5 py-4 text-center">
              <SearchX aria-hidden="true" size={20} className="text-text-muted" />
              <span className="text-[13px] text-text-muted">
                {users.length === 0 ? t("v2.addEmployee.noOptions") : t("v2.addEmployee.empty")}
              </span>
            </div>
          ) : null}
        </div>
      </Field>
    </Dialog>
  );
};

export default AddEmployeeModal;
