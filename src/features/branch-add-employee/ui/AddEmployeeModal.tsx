// dizayn-v2: superadmin-branches-add-employee-dialog
import { yupResolver } from "@hookform/resolvers/yup";
import { useController, useForm } from "react-hook-form";
import { useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
import { Check, Info, SearchX, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { BranchType } from "../../../entities/branch";
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
type AssignableRole = (typeof BRANCH_ASSIGNABLE_ROLES)[number];
/** HQ da menejer bo'lmaydi — backend `HQ_MANAGER_FORBIDDEN_MESSAGE` (400). */
const HQ_ASSIGNABLE_ROLES: readonly AssignableRole[] = ["registrator", "courier"];
/** Qabul punktida (PICKUP) kuryer bo'lmaydi — backend 403 «Courier faqat HQ, REGIONAL yoki HYBRID branchga …». */
const PICKUP_ASSIGNABLE_ROLES: readonly AssignableRole[] = ["manager", "registrator"];

/**
 * Filial turiga ko'ra biriktirsa bo'ladigan rollar (backend `assignUserToBranch` qoidalari): faqat shular so'raladi va
 * ko'rsatiladi. REGIONAL, HYBRID va noma'lum tur — uchalasi (backend baribir tekshiradi). Modul konstantalari — har
 * renderda bir xil havola (`useMemo` bog'liqligi barqaror).
 */
const assignableRolesFor = (type?: BranchType | null): readonly AssignableRole[] =>
  type === "HQ" ? HQ_ASSIGNABLE_ROLES : type === "PICKUP" ? PICKUP_ASSIGNABLE_ROLES : BRANCH_ASSIGNABLE_ROLES;

/** Filial turiga mos izoh: kim ko'rsatilishi aytiladi. */
const hintKeyFor = (type?: BranchType | null) =>
  type === "HQ" ? "v2.addEmployee.hintHq" : type === "PICKUP" ? "v2.addEmployee.hintPickup" : "v2.addEmployee.hint";

/**
 * Har rol uchun bitta sahifa: backend `limit` ni 100 da kesadi va eng yangilarini (`createdAt DESC`) beradi. Filialsiz
 * xodimlar odatda eskilar (filialdan olib tashlanganlar) — ular bu oynadan tashqarida qolishi mumkin, shuning uchun
 * qidiruv serverga ham yuboriladi (`search`).
 */
const USERS_PAGE_LIMIT = 100;
/** Ma'lumot yo'q paytdagi barqaror bo'sh ro'yxat (`useMemo` har renderda qayta hisoblanmasin). */
const NO_USERS: IdentityUser[] = [];
/** Server qidiruvi kechikishi — har harfda `GET /users` (har rol uchun) yuborilmasin. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Biriktirsa bo'ladigan — hech qaysi filialga biriktirilmagan (`branch_id` bo'sh). Foydalanuvchi faqat bitta faol
 * filialda bo'ladi (`branch_users` qisman unikal indeksi): boshqa filialdagini backend 409 bilan rad etadi.
 */
const isUnassigned = (user: IdentityUser) => String(user.branch_id ?? "").trim() === "";
/** Filialsiz va roli shu filial turiga mos (rol bo'yicha so'rov bo'lsa ham, ikkinchi himoya). */
const isAssignable = (user: IdentityUser, roles: readonly AssignableRole[]) =>
  isUnassigned(user) && (!user.role || (roles as readonly string[]).includes(user.role));

/** `.el-options` (CODE-MAP 2.2): ro'yxat oyna ichida, eng ko'pi 280 px, ichida aylanadi. */
const OPTIONS =
  "flex max-h-[280px] min-h-0 flex-col gap-0.5 overflow-y-auto overscroll-contain rounded-xl border border-border " +
  "bg-raised p-1.5 shadow-sm";
/** `.el-option` — telefonda ≥ 44 px. */
const OPTION =
  "flex min-h-11 w-full cursor-pointer select-none items-center justify-between gap-2.5 rounded-lg px-2.5 py-1.5 " +
  "text-left text-sm text-text transition-[background-color] duration-150 motion-reduce:transition-none";

const normalize = (value: string) => value.toLocaleLowerCase().replace(/[ʻʼ‘’`]/g, "'").trim();
const matches = (user: IdentityUser, needle: string) =>
  [user.fullName, user.username, user.phone].some((value) => normalize(String(value ?? "")).includes(needle));

/**
 * «XODIM QO'SHISH» oynasi (maket `superadmin-branches-add-employee-dialog`; telefonda pastki varaqa):
 * «{filial}ga foydalanuvchini biriktiring.», «Foydalanuvchi *» — qidiruv maydoni va uning ostida oyna ichidagi
 * ro'yxat (ism, ostida «login · rol»), izoh «Faqat hech qaysi filialga biriktirilmagan faol menejer, ro'yxatchi va
 * kuryerlar ko'rsatiladi», «Bekor qilish» / «Qo'shish».
 *
 * Ega (2026-11-04): ro'yxatda faqat filialsiz foydalanuvchilar (`branch_id` bo'sh) — boshqa filialdagi xodim tanlansa
 * backend baribir 409 qaytarardi. Rollar filial turiga mos (`assignableRolesFor`): HQ da menejer yo'q (backend 400),
 * qabul punktida (PICKUP) kuryer yo'q (backend 403); izoh ham shunga mos.
 *
 * Qidiruv: yozilgan zahoti — yuklangan ro'yxat ichida (ism, login, telefon); 300 ms dan keyin — serverda ham
 * (`GET /users?search=…`): har rol uchun 100 tadan tashqaridagi eski filialsiz xodim ham topiladi. Joriy matn uchun
 * server topganlari mahalliy moslikdan qat'i nazar ko'rinadi (masalan, telefon bo'shliqlar bilan yozilsa). Ro'yxat
 * kesilgan bo'lsa (≥ 100 qator) «Biriktirilmagan faol xodim yo'q» deyilmaydi — «qidiring» deyiladi.
 *
 * Klaviatura (fokus qidiruvda, `aria-activedescendant`): ↑ ↓ Home End — ro'yxatda yurish, Enter — tanlash
 * (forma yuborilmaydi). Qatorni bosish tanlaydi; «Qo'shish» yuboradi.
 *
 * Xulq o'zgarmagan: `GET /users?status=active&role=…&page=1&limit=100` (faqat oyna ochiq bo'lsa), `addEmployeeSchema`,
 * `POST /branches/:id/users { user_id }`; rad etilsa oyna ochiq qoladi va sabab xabarda.
 */
const AddEmployeeModal = ({
  branchId,
  branchName,
  branchType,
  open,
  onClose,
}: {
  branchId: string;
  /** Izohdagi filial nomi («Urgut filialiga …»); berilmasa — umumiy izoh. */
  branchName?: string;
  /** Filial turi: `HQ` — menejerlar, `PICKUP` — kuryerlar ko'rsatilmaydi va so'ralmaydi. */
  branchType?: BranchType | null;
  open: boolean;
  onClose: () => void;
}) => {
  const { t } = useTranslation(["branches", "common"]);
  const listId = useId();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [serverSearch, setServerSearch] = useState("");
  const roles = assignableRolesFor(branchType);
  // Yozish to'xtagach (300 ms) matn serverga ham ketadi; oyna yopilib `query` tozalansa — u ham.
  useEffect(() => {
    const timer = window.setTimeout(() => setServerSearch(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);
  const usersParams = { status: "active" as const, role: [...roles], page: 1, limit: USERS_PAGE_LIMIT };
  const { data: users = NO_USERS, isLoading: usersLoading } = useUsers({ ...usersParams, enabled: open });
  const { data: found = NO_USERS, isFetching: searchFetching } = useUsers({
    ...usersParams,
    search: serverSearch,
    enabled: open && serverSearch !== "",
  });
  const assignable = useMemo(() => users.filter((user) => isAssignable(user, roles)), [roles, users]);
  // Har rol 100 tadan oshmaydi va xodimning roli bitta: jami < 100 bo'lsa, har rol sahifasi to'liq kelgan. Aks holda
  // ro'yxat kesilgan bo'lishi mumkin (ehtiyotkor baho) — filialsizlar 100 tadan tashqarida qolgan bo'lishi mumkin.
  const truncated = users.length >= USERS_PAGE_LIMIT;
  const needle = normalize(query);
  // Server natijasi joriy matnga tegishlimi (kechikish o'tgan: `found` — shu matn kalitining ma'lumoti yoki bo'sh)?
  const searchCurrent = needle !== "" && serverSearch === query.trim();
  const searchPending = needle !== "" && (!searchCurrent || searchFetching);
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
    if (!needle) return assignable;
    // Yuklangan ro'yxat + server topganlari (100 tadan tashqaridagilar ham), takrorsiz. Joriy matn uchun server
    // topganlari — mahalliy mos kelmasa ham (server telefonni raqamlar bo'yicha ham qidiradi).
    const serverIds = new Set(searchCurrent ? found.map((user) => user.id) : []);
    const seen = new Set<string>();
    return [...assignable, ...found.filter((user) => isAssignable(user, roles))].filter((user) => {
      if (seen.has(user.id)) return false;
      seen.add(user.id);
      return serverIds.has(user.id) || matches(user, needle);
    });
  }, [assignable, found, needle, roles, searchCurrent]);

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
  // Server qidiruvi kutilayotganda bo'sh ro'yxat uchun «topilmadi» chiqmaydi — skelet turadi.
  const showSkeleton = usersLoading || (visible.length === 0 && searchPending);
  // «Biriktirilmagan faol xodim yo'q» — faqat ro'yxat to'liq kelgan bo'lsa; kesilgan bo'lsa qidirishni taklif qiladi.
  const emptyKey =
    assignable.length === 0 && !truncated
      ? "v2.addEmployee.noOptions"
      : needle
        ? "v2.addEmployee.empty"
        : "v2.addEmployee.searchMore";
  const description = branchName ? t("v2.addEmployee.description", { branch: branchName }) : t("employee.addDescription");

  return (
    <Dialog
      open={open}
      onClose={onClose}
      // Yopilgach qidiruv tozalanadi (keyingi ochilishda ro'yxat to'liq).
      onExited={() => {
        setQuery("");
        setServerSearch("");
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
            {t(hintKeyFor(branchType))}
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
          aria-busy={usersLoading || searchPending || undefined}
          // Bosilganda fokus qidiruv maydonida qoladi (`aria-activedescendant`).
          onMouseDown={(event) => event.preventDefault()}
          className={OPTIONS}
        >
          {showSkeleton
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
          {!showSkeleton && visible.length === 0 ? (
            <div role="presentation" className="flex flex-col items-center gap-1.5 px-2.5 py-4 text-center">
              <SearchX aria-hidden="true" size={20} className="text-text-muted" />
              <span className="text-[13px] text-text-muted">{t(emptyKey)}</span>
            </div>
          ) : null}
          {!showSkeleton && visible.length > 0 && truncated && !needle ? (
            <div role="presentation" className="px-2.5 py-2 text-center text-xs text-text-muted">
              {t("v2.addEmployee.searchMore")}
            </div>
          ) : null}
        </div>
      </Field>
    </Dialog>
  );
};

export default AddEmployeeModal;
