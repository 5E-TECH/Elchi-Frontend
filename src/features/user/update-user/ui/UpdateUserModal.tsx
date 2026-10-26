// dizayn-v2: superadmin-users-edit-dialog, admin-users-edit-dialog, superadmin-users-edit-market-warehouse, manager-users-edit-dialog, superadmin-users-edit-market-ai, superadmin-users-edit-market-ai-phone, superadmin-users-edit-courier-district, superadmin-users-edit-role, superadmin-users-role-confirm-dialog, superadmin-users-role-confirm-logist, superadmin-users-edit-role-error
import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import { Controller, useForm, type Path } from "react-hook-form";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, Eye, EyeOff, Pencil, UserX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatMoneyLocalized } from "../../../../shared/lib/formatMoney";
import { useUser } from "../../../../entities/user/api/userApi";
import { useSetMarketWarehouseOrder } from "../../../../entities/warehouse";
import type { ChangeableUserRole, UpdateUserRequest, User as UserType } from "../../../../entities/user/types/user";
import { unwrapUserResponse } from "../../../../entities/user/lib/normalizeUser";
import { getUserRoleLabelKey } from "../../../../entities/user/lib/role";
import { isChangeableUserRole } from "../../../../entities/user/lib/changeableRole";
import type { RootState } from "../../../../app/config/store";
import { getBackendErrorMessage } from "../../../../shared/lib/backendError";
import {
  checkPasswordPolicy,
  getPasswordPolicyServerMessage,
  passwordMinLength,
} from "../../../../shared/lib/passwordPolicy";
import { notify } from "../../../../shared/lib/notify";
import { getUzbekistanPhoneDigits, toUzbekistanPhoneValue } from "../../../../shared/lib/phone";
import {
  Button,
  Dialog,
  Field,
  IconButton,
  Select,
  SkeletonLines,
  TextInput,
  useConfirm,
  type SelectOption,
} from "../../../../shared/ui/primitives";
import { applyBackendFieldErrors } from "../../lib/backendFieldErrors";
import { PAYMENT_DAY_OPTIONS, toPaymentDayOption } from "../../lib/paymentDay";
import { runUserRequest } from "../../lib/userRequest";
import {
  RoleSection,
  buildRoleChangeConfirm,
  classifyRoleChangeError,
  loadReleasedRegionNames,
  useChangeUserRole,
  type RoleChangeErrorKind,
} from "../../change-role";
import { WarehouseOrderSection } from "./WarehouseOrderSection";
import { CourierDistrictField } from "../../courier-district/ui/CourierDistrictField";
import { courierDistrictErrorKind } from "../../courier-district/model/courierDistrict";

/** «Logist biriktirish» sahifasi (logist boshqa rolga o'tgach — bo'shagan viloyatlarni berish). */
const LOGIST_ASSIGNMENT_PATH = "/regions/logist-assignment";

/**
 * Backend `Status` enumi — faqat `active | inactive` (UpdateAdminRequestDto
 * `@IsEnum(['active','inactive'])`). fix3b RBAC-16: "blocked" varianti 400
 * qaytarardi; xodimni bloklash = "Nofaol".
 */
const STATUS_OPTION_VALUES = ["active", "inactive"] as const;

/** Pul maydoni qiymati — faqat raqamlar (`TextInput mode="money"`); «35000.00» kabi satr ham butun songa. */
const toDigits = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "";
  const numeric = Number(value);
  return Number.isFinite(numeric) ? String(Math.max(0, Math.round(numeric))) : String(value).replace(/\D/g, "");
};

const parseAmount = (value: string): number => Number(value.replace(/\D/g, ""));

/** Backend chegarasi (`AI_PRICE_PER_ORDER_MAX_UZS`, `UpdateAdminRequestDto.ai_price_per_order` maximum). */
export const AI_PRICE_MAX_UZS = 1_000_000;

/** Asosiy tarif: API `center` / `address` (eski yozuvlarda `home` — «Uygacha» bilan bir xil). */
const toTariffOption = (value: unknown): "" | "center" | "address" =>
  value === "center" ? "center" : value === "address" || value === "home" ? "address" : "";

interface UpdateUserModalProps {
  userId: string | null;
  onClose: () => void;
  initialUser?: UserType | null;
  isOwnProfile?: boolean;
}

interface UpdateUserFormValues {
  name: string;
  phone: string;
  password: string;
  status: string;
  username: string;
  salary: string;
  payment_day: string;
  tariff_home: string;
  tariff_center: string;
  default_tariff: string;
  /** Market AI buyurtma narxi (so'm). Bo'sh — global narx (`null`), sukut narx ko'rsatilmaydi (FY-S5). */
  ai_price: string;
  /** FY-2: tanlangan rol (faqat superadmin, admin ⇄ menejer ⇄ ro'yxatchi ⇄ logist). */
  role: string;
}

const INITIAL_VALUES: UpdateUserFormValues = {
  name: "",
  phone: "",
  password: "",
  status: "",
  username: "",
  salary: "",
  payment_day: "",
  tariff_home: "",
  tariff_center: "",
  default_tariff: "",
  ai_price: "",
  role: "",
};

const SERVER_FIELD_NAME_MAP: Record<string, Path<UpdateUserFormValues>> = {
  name: "name",
  full_name: "name",
  phone: "phone",
  phone_number: "phone",
  username: "username",
  password: "password",
  status: "status",
  salary: "salary",
  payment_day: "payment_day",
  tariff_home: "tariff_home",
  tariff_center: "tariff_center",
  default_tariff: "default_tariff",
  ai_price_per_order: "ai_price",
};

/**
 * Maydonlar to'ri ustunining eng kichik kengligi (maket: `repeat(auto-fit, minmax(min(Npx, 100%), 1fr))`):
 * 260 — asosiy; 240 — «AI narxi» bilan market bo'limi (`superadmin-users-edit-market-ai`: 2×2, telefonda 1 ustun);
 * 170 — ixcham tarif bo'limlari. Tailwind statik klasslari bo'lishi uchun xarita.
 */
const GRID_MIN_COL = {
  170: "grid grid-cols-[repeat(auto-fit,minmax(min(170px,100%),1fr))] gap-4",
  240: "grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-4",
  260: "grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-4",
} as const;

/** Bo'lim sarlavhasi (`.el-overline`) va maydonlar to'ri. */
const FormSection = ({
  title,
  minCol = 260,
  children,
}: {
  title: string;
  minCol?: keyof typeof GRID_MIN_COL;
  children: ReactNode;
}) => (
  <section className="flex flex-col gap-4 border-t border-border pt-5 first:border-t-0 first:pt-0">
    <h3 className="m-0 text-xs font-semibold uppercase tracking-[.05em] text-text-muted">{title}</h3>
    <div className={GRID_MIN_COL[minCol]} data-min-col={minCol}>
      {children}
    </div>
  </section>
);

/**
 * FOYDALANUVCHINI TAHRIRLASH — dizayn v2 oynasi (`Dialog`, telefonda pastki varaqa).
 *
 * Maketlar `superadmin-users-edit-dialog` (= admin, menejer): sarlavha «Foydalanuvchini tahrirlash», izoh
 * «{ism} · {rol}»; «Asosiy ma'lumotlar» (Ism familiya *, Telefon *, Yangi parol + «Bo'sh qoldirilsa…», Holat +
 * «Nofaol qilishdan oldin tasdiq so'raladi»); rolga qarab «Market ma'lumotlari» / maosh va to'lov kuni / kuryer
 * tarifi; «Bekor qilish» · «O'zgarishlarni saqlash».
 *
 * FY-1: market — «Market nomi *» va «AI narxi (1 buyurtma)» (`superadmin-users-edit-market-ai`; faqat superadmin/
 * admin — backend boshqasiga 403; bo'sh → `null`, ya'ni global narx; sukut 300 ko'rsatilmaydi — FY-S5); logist —
 * «Maosh va to'lov kuni»; kuryer — «Ish hududi» faqat o'qish (viloyat; tuman — backend kerak, maket
 * `superadmin-users-edit-courier-district` qisman), filial «Boshqa filialga o'tkazish» orqali (FY-S4). O'lik
 * `region_id` maydoni olib tashlandi (identity `updateUser` uni e'tiborsiz qoldiradi).
 *
 * FY-2 (K3scaE0W): superadmin uchun yuqorida «Rol» bo'limi (`features/user/change-role`; faqat admin ⇄ menejer ⇄
 * ro'yxatchi ⇄ logist, o'zini emas). Saqlash: tasdiq «Rolni o'zgartirasizmi?» → avval `PATCH /users/:id/role`, keyin
 * qolgan maydonlar (`PATCH /users/:id`). Rol o'zgarmasa (409 — filialga biriktirilgan, 503 / tarmoq — «Qayta
 * urinish», boshqasi) — xato oyna ichida, qolgan maydonlar yuborilmaydi, kiritilganlar joyida. Rol o'zgarib, qolgani
 * saqlanmasa — alohida ogohlantirish, oyna ochiq (rol endi yangi), kiritilganlar joyida (tafsilot qayta kelsa ham).
 * Menejer tariflari faqat menejerda: rol menejerdan boshqasiga o'zgarsa yashirinadi va yuborilmaydi (backend ularni
 * tozalaydi); menejerga o'zgarsa forma o'zgarmaydi (maketlar) — tariflar rol saqlangach chiqadi.
 *
 * Props va xulq o'zgarmagan (spec §8.4; `/profile` ham shu oynani ochadi): faqat o'zgargan maydonlar
 * yuboriladi; nofaol qilish — tasdiq oynasi; o'z parolini o'zgartirgan foydalanuvchi darhol chiqariladi
 * (fix3b RBAC-09); backend maydon xatolari maydonga (`applyBackendFieldErrors`); to'lov kuni 1–30.
 */
export const UpdateUserModal = memo(({
  userId,
  onClose,
  initialUser = null,
  isOwnProfile = false,
}: UpdateUserModalProps) => {
  const { t, i18n } = useTranslation(["users", "common", "auth"]);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const authRole = useSelector((state: RootState) => state.role.role);
  const currentUserId = useSelector(
    (state: RootState) => state.user.user?.id ?? state.role.id,
  );
  const { useGetUserById, updateUser, updateMyProfile } = useUser();
  const changeRole = useChangeUserRole();
  const setWarehouseOrder = useSetMarketWarehouseOrder();
  // yXC91RRx: «Ombordan buyurtma yaratish» — tegilmagan bo'lsa `null` (saqlangan qiymat ko'rinadi).
  const [warehouseOrderDraft, setWarehouseOrderDraft] = useState<boolean | null>(null);
  // DtKKY0V8: kuryer «Tuman» — tegilmagan bo'lsa `null` (saqlangan `district_id` ko'rinadi); server xatosi maydonda.
  const [districtDraft, setDistrictDraft] = useState<string | null>(null);
  const [districtError, setDistrictError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [showPassword, setShowPassword] = useState(false);
  // FY-2: rol so'rovi (va undan oldingi viloyatlar so'rovi) ketmoqda; oxirgi rol xatosi; serverda o'zgargan rol
  // (qolgan maydonlar saqlanmay qolsa — oyna ochiq, keyingi saqlashda rol qayta yuborilmaydi).
  const [roleBusy, setRoleBusy] = useState(false);
  const [roleError, setRoleError] = useState<RoleChangeErrorKind | null>(null);
  const [committedRole, setCommittedRole] = useState<string | null>(null);
  // Forma oxirgi marta qaysi foydalanuvchi uchun to'ldirilgan: shu foydalanuvchi ma'lumoti qayta kelsa (rol
  // o'zgargach `[user]` qayta so'raladi) — kiritilganlar saqlanadi, faqat tegilmagan maydonlar yangilanadi.
  const filledForUserRef = useRef<string | null>(null);
  // Ikki marta tez bosish (yoki Enter) ikki oqim boshlamasin — `isPending` keyingi chizishgacha kechikadi.
  const submittingRef = useRef(false);
  // O'z hisobi: profil sahifasi yoki ro'yxatdan o'zini tahrirlash.
  const isSelf =
    isOwnProfile ||
    Boolean(userId && currentUserId && String(userId) === String(currentUserId));

  const shouldFetchUser = Boolean(userId && !initialUser);
  // Ro'yxat qatorida (`GET /users`) kuryer viloyati yo'q — «Ish hududi» uchun tafsilot so'raladi (`GET /users/:id`).
  const needsCourierRegion = Boolean(
    userId && initialUser && !isOwnProfile && initialUser.role === "courier" && initialUser.region === undefined,
  );
  // Viloyat — yordamchi so'rov: xatosi maydonning o'zida («—»), global xabar chiqmaydi.
  const {
    data: rawUser,
    isLoading: isUserLoading,
    isError: isUserError,
  } = useGetUserById(
    shouldFetchUser || needsCourierRegion ? userId ?? "" : "",
    undefined,
    needsCourierRegion ? { silentError: true } : undefined,
  );

  const methods = useForm<UpdateUserFormValues>({
    defaultValues: INITIAL_VALUES,
    mode: "onTouched",
  });

  const {
    control,
    handleSubmit,
    reset,
    setError,
    setFocus,
    clearErrors,
    watch,
  } = methods;

  const userData = initialUser ?? unwrapUserResponse(rawUser) ?? null;
  const isLoading = shouldFetchUser ? isUserLoading : false;

  const role = committedRole ?? userData?.role ?? "";
  // FY-2: rolni faqat superadmin, faqat boshqa xodimniki va faqat almashtiriladigan rollar orasida (backend
  // `CHANGEABLE_ROLES`; o'z rolini o'zgartirish — 400).
  const canChangeRole = authRole === "superadmin" && !isOwnProfile && !isSelf && isChangeableUserRole(role);
  const selectedRole = watch("role");
  // Rolga bog'liq maydonlar (menejer tariflari) tanlangan rol bo'yicha.
  const effectiveRole = canChangeRole && isChangeableUserRole(selectedRole) ? selectedRole : role;
  // Maosh va to'lov kuni: admin, menejer, ro'yxatchi va logist (FY-1, `POST /logists` ham maosh oladi).
  const isAdmin =
    !isOwnProfile && (role === "admin" || role === "manager" || role === "registrator" || role === "logist");
  const isSuperAdmin = role === "superadmin";
  const isCourier = !isOwnProfile && role === "courier";
  const isMarket = !isOwnProfile && (role === "market" || role === "marketing");
  const isCustomer = role === "customer";
  // NFiXfmq6: AI narxini faqat superadmin/admin o'zgartiradi (menejerda maydon yashirin).
  const canEditAiPrice = isMarket && (authRole === "admin" || authRole === "superadmin");
  // yXC91RRx: market «Ombordan buyurtma yaratish» kaliti — faqat superadmin/admin (`PATCH /markets/:id/warehouse-order`).
  const canEditWarehouseOrder = isMarket && (authRole === "admin" || authRole === "superadmin");
  const initialWarehouseOrder = userData?.can_order_from_warehouse === true;
  const warehouseOrder = warehouseOrderDraft ?? initialWarehouseOrder;
  const warehouseOrderChanged = canEditWarehouseOrder && warehouseOrder !== initialWarehouseOrder;
  const fetchedUser = needsCourierRegion ? unwrapUserResponse(rawUser) : null;
  const courierRegion = userData?.region ?? fetchedUser?.region ?? null;
  // DtKKY0V8: joriy tuman — `GET /users/:id` (yoki ro'yxat qatori) `district_id`; viloyat — kuryer hududi.
  const initialDistrictId = String(userData?.district_id ?? fetchedUser?.district_id ?? "");
  const districtValue = districtDraft ?? initialDistrictId;
  const districtChanged = isCourier && districtDraft !== null && districtDraft !== initialDistrictId;
  const courierRegionId =
    courierRegion?.id != null && String(courierRegion.id).trim() ? String(courierRegion.id) : (userData?.region_id ?? null);
  const courierRegionLoading = needsCourierRegion && isUserLoading;
  // So'rov yiqilsa «Biriktirilmagan» deyilmaydi (bu yolg'on bo'lardi) — qiymat noma'lum: «—».
  const courierRegionFailed = needsCourierRegion && isUserError && !fetchedUser;
  // «Boshqa filialga o'tkazish» tugmasi faqat admin/superadminda (UserDetailView `canTransferCourier`).
  const canTransferCourier = authRole === "admin" || authRole === "superadmin";
  const initialAiPrice = userData?.ai_price_per_order != null ? toDigits(userData.ai_price_per_order) : "";
  // Menejer tariflari — faqat saqlangan rol ham, tanlangan rol ham menejer bo'lsa: menejerga o'tkazishda maydonlar
  // qo'shilmaydi (maketlar `*-role-confirm-dialog`, `*-edit-role-error` — forma o'zgarmaydi), menejerdan boshqasiga
  // o'tkazishda yashirinadi va yuborilmaydi (backend tariflarni o'zi tozalaydi).
  const canEditManagerFinancial =
    !isOwnProfile &&
    role === "manager" &&
    effectiveRole === "manager" &&
    (authRole === "admin" || authRole === "superadmin");

  useEffect(() => {
    if (!userData) return;
    // Yangi ochilish yoki boshqa foydalanuvchi — to'liq to'ldirish; o'sha foydalanuvchi qayta kelsa (masalan rol
    // o'zgargach tafsilot qayta so'raldi) — o'zgartirilgan maydonlar joyida qoladi.
    const sameUser = filledForUserRef.current === String(userData.id);
    filledForUserRef.current = String(userData.id);
    reset({
      name: userData.name ?? "",
      phone: userData.phone_number ? toUzbekistanPhoneValue(userData.phone_number) : "",
      password: "",
      status: userData.status ?? "",
      username: userData.username ?? "",
      salary: userData.salary != null ? toDigits(userData.salary) : "",
      payment_day: userData.payment_day != null ? String(userData.payment_day) : "",
      tariff_home: userData.tariff_home != null ? toDigits(userData.tariff_home) : "",
      tariff_center: userData.tariff_center != null ? toDigits(userData.tariff_center) : "",
      default_tariff: toTariffOption(userData.default_tariff),
      ai_price: userData.ai_price_per_order != null ? toDigits(userData.ai_price_per_order) : "",
      role: userData.role ?? "",
    }, sameUser ? { keepDirtyValues: true } : undefined);
  }, [reset, userData]);

  // Oyna yopilganda parol yana yashirin; boshqa foydalanuvchi yoki yopilish — rol holati tozalanadi.
  useEffect(() => {
    setRoleError(null);
    setCommittedRole(null);
    setWarehouseOrderDraft(null);
    setDistrictDraft(null);
    setDistrictError(null);
    if (!userId) {
      setShowPassword(false);
      filledForUserRef.current = null;
    }
  }, [userId]);

  const validateForm = (values: UpdateUserFormValues): boolean => {
    let valid = true;
    clearErrors();
    // Bo'sh / noto'g'ri saqlashda fokus birinchi xato maydonga (klaviatura va ekran o'qigichi xatoni topsin).
    // Tekshiruv tartibi — formadagi tartib; `ref` faqat matn maydonlarida (payment_day — Select, fokussiz).
    const invalid: Path<UpdateUserFormValues>[] = [];
    const fail = (name: Path<UpdateUserFormValues>, message: string) => {
      setError(name, { message });
      invalid.push(name);
      valid = false;
    };

    if (!values.name.trim()) {
      fail("name", t("nameRequired"));
    }

    if (getUzbekistanPhoneDigits(values.phone).length !== 9) {
      fail("phone", t("phoneValidation"));
    }

    // NDmZMzCP: yangi parol (bo'sh — o'zgarmaydi) — kamida 8 (xodim — 10) belgi, boshida/oxirida bo'shliqsiz.
    if (values.password) {
      const passwordIssue = checkPasswordPolicy(values.password, effectiveRole);
      if (passwordIssue && passwordIssue !== "required") {
        fail("password", t(`auth:passwordPolicy.${passwordIssue}`, { min: passwordMinLength(effectiveRole) }));
      }
    }

    if (isAdmin && values.payment_day) {
      const day = Number(values.payment_day);
      if (day < 1 || day > 30) {
        fail("payment_day", t("paymentDayValidation"));
      }
    }

    if (canEditManagerFinancial) {
      const hasHomeTariff = Boolean(values.tariff_home.trim());
      const hasCenterTariff = Boolean(values.tariff_center.trim());
      if (hasHomeTariff !== hasCenterTariff) {
        if (!hasHomeTariff) {
          fail("tariff_home", t("homeTariffRequired"));
        }
        if (!hasCenterTariff) {
          fail("tariff_center", t("centerTariffRequired"));
        }
      }
    }

    // Market tariflari majburiy (maket: «*»): bo'sh qoldirilsa avval ham yuborilmasdi — endi sababi aytiladi.
    if (isMarket) {
      if (!values.tariff_home.trim()) {
        fail("tariff_home", t("v2.edit.marketHomePriceRequired"));
      }
      if (!values.tariff_center.trim()) {
        fail("tariff_center", t("v2.edit.marketCenterPriceRequired"));
      }
    }

    if (canEditAiPrice && values.ai_price.trim() && parseAmount(values.ai_price) > AI_PRICE_MAX_UZS) {
      fail("ai_price", t("v2.edit.aiPriceRange", { max: formatMoneyLocalized(AI_PRICE_MAX_UZS, { language }) }));
    }

    if (invalid[0]) setFocus(invalid[0]);
    return valid;
  };

  /**
   * FY-2: rolni o'zgartirish → qolgan maydonlar. Tasdiq (logistdan chiqishda bo'shaydigan viloyatlar bilan) →
   * `PATCH /users/:id/role`; xato — oyna ichida, qolgan maydonlar yuborilmaydi. So'ng `payload` bo'lsa — `PATCH
   * /users/:id`; u yiqilsa — «Rol o'zgartirildi, qolgani saqlanmadi», oyna ochiq.
   */
  const submitRoleChange = async ({
    targetRole,
    fromRole,
    payload,
    skipConfirm,
  }: {
    targetRole: ChangeableUserRole;
    fromRole: ChangeableUserRole;
    payload: UpdateUserRequest;
    skipConfirm: boolean;
  }) => {
    if (!userId || !userData) return;
    // Saqlangan ism (yangi ism hali yozilmagan).
    const name = userData.name ?? "";
    const transition = { from: t(getUserRoleLabelKey(fromRole)), to: t(getUserRoleLabelKey(targetRole)) };

    setRoleBusy(true);
    try {
      if (!skipConfirm) {
        const releasedRegions = fromRole === "logist" ? await loadReleasedRegionNames(queryClient, userId) : undefined;
        // Tasdiq oynasi ochiq paytda orqadagi oyna tugmalari oddiy holatda (maket `*-role-confirm-dialog`).
        setRoleBusy(false);
        const ok = await confirm(
          buildRoleChangeConfirm({ t, name, from: fromRole, to: targetRole, releasedRegions }),
        );
        if (!ok) return;
      }

      setRoleBusy(true);
      setRoleError(null);
      try {
        await changeRole.mutateAsync({ id: userId, role: targetRole, from: fromRole });
      } catch (error) {
        setRoleError(classifyRoleChangeError(error));
        return;
      }
      setCommittedRole(targetRole);

      const assignLogists =
        fromRole === "logist"
          ? { label: t("v2.role.success.assignLogists"), onClick: () => navigate(LOGIST_ASSIGNMENT_PATH) }
          : undefined;

      if (Object.keys(payload).length > 0) {
        try {
          await updateUser.mutateAsync({ id: userId, data: payload });
        } catch (error) {
          applyBackendFieldErrors(error, setError, SERVER_FIELD_NAME_MAP);
          notify.warning(t("v2.role.partial.title"), {
            description: t("v2.role.partial.text", { name, role: t(`v2.role.as.${targetRole}`) }),
            action: assignLogists,
          });
          return;
        }
      }

      notify.success(t("v2.role.success.title"), {
        description: t("v2.role.success.text", { name, ...transition }),
        action: assignLogists,
      });
      onClose();
    } finally {
      setRoleBusy(false);
    }
  };

  /**
   * yXC91RRx: ombor kaliti alohida endpoint orqali (`PATCH /markets/:id/warehouse-order`) — asosiy maydonlar
   * saqlangach (yoki ular o'zgarmagan bo'lsa). Yiqilsa — oyna ochiq, kalit holati joyida (qayta «Saqlash»).
   */
  const saveWarehouseOrder = async () => {
    if (!userId) return;
    try {
      await setWarehouseOrder.mutateAsync({ marketId: userId, enabled: warehouseOrder });
      notify.success(t(warehouseOrder ? "marketOrder.enabled" : "marketOrder.disabled", { ns: "warehouses" }), {
        description: userData?.name ?? undefined,
      });
      setWarehouseOrderDraft(null);
      onClose();
    } catch (error) {
      notify.error(t("marketOrder.failed", { ns: "warehouses" }), {
        description: getBackendErrorMessage(error) ?? t("editUserError"),
      });
    }
  };

  const onSubmit = (values: UpdateUserFormValues) => submitForm(values, false);

  /** `skipRoleConfirm` — «Qayta urinish» (rol tasdig'i olingan, tanlov o'zgarmagan). */
  const submitForm = async (values: UpdateUserFormValues, skipRoleConfirm: boolean) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      await submitFormOnce(values, skipRoleConfirm);
    } finally {
      submittingRef.current = false;
    }
  };

  const submitFormOnce = async (values: UpdateUserFormValues, skipRoleConfirm: boolean) => {
    if (!userId || !userData || !validateForm(values)) return;
    const targetRole =
      canChangeRole && isChangeableUserRole(values.role) && values.role !== role ? values.role : null;

    const payload: UpdateUserRequest = {};

    if (values.name.trim() && values.name !== userData.name) {
      payload.name = values.name.trim();
    }

    const rawPhone = toUzbekistanPhoneValue(values.phone);
    if (rawPhone !== userData.phone_number) {
      payload.phone_number = rawPhone;
    }

    if (values.password.trim()) payload.password = values.password.trim();
    if (!isOwnProfile && values.status && values.status !== userData.status) {
      payload.status = values.status as UpdateUserRequest["status"];
    }

    if (isAdmin) {
      if (values.salary.trim()) {
        const salary = parseAmount(values.salary);
        if (salary !== Number(userData.salary ?? 0)) {
          payload.salary = salary;
        }
      }

      if (values.payment_day) {
        const paymentDay = Number(values.payment_day);
        if (paymentDay !== Number(userData.payment_day)) {
          payload.payment_day = paymentDay;
        }
      }
    }

    if (canEditManagerFinancial) {
      if (values.tariff_home.trim() && values.tariff_center.trim()) {
        const tariffHome = parseAmount(values.tariff_home);
        const tariffCenter = parseAmount(values.tariff_center);

        if (tariffHome !== Number(userData.tariff_home ?? 0)) {
          payload.tariff_home = tariffHome;
        }

        if (tariffCenter !== Number(userData.tariff_center ?? 0)) {
          payload.tariff_center = tariffCenter;
        }
      }
    }

    if (isCourier || isMarket) {
      if (values.tariff_home) {
        const tariffHome = parseAmount(values.tariff_home);
        if (tariffHome !== userData.tariff_home) {
          payload.tariff_home = tariffHome;
        }
      }

      if (values.tariff_center) {
        const tariffCenter = parseAmount(values.tariff_center);
        if (tariffCenter !== userData.tariff_center) {
          payload.tariff_center = tariffCenter;
        }
      }
    }

    if (isMarket && values.default_tariff && values.default_tariff !== toTariffOption(userData.default_tariff)) {
      payload.default_tariff = values.default_tariff as "address" | "center";
    }

    // AI narxi: faqat o'zgargan bo'lsa (saqlangan kasr qiymat butun songa yaxlitlanib jimgina yozilmasin);
    // bo'sh — `null` (global narx).
    if (canEditAiPrice && values.ai_price.trim() !== initialAiPrice) {
      payload.ai_price_per_order = values.ai_price.trim() ? parseAmount(values.ai_price) : null;
    }

    // DtKKY0V8: tuman faqat o'zgargan bo'lsa (`null` — tozalash). Viloyat bu bilan o'zgarmaydi.
    if (districtChanged) payload.district_id = districtDraft || null;

    if (!targetRole && Object.keys(payload).length === 0) {
      if (warehouseOrderChanged) await saveWarehouseOrder();
      else onClose();
      return;
    }

    // Nofaol qilish kirish huquqini oladi — tasdiqlash oynasi orqali (DESIGN_SYSTEM §8).
    if (payload.status && payload.status !== "active") {
      const name = payload.name ?? userData.name;
      const ok = await confirm({
        tone: "danger",
        title: t("deactivateConfirmTitle"),
        description: t("deactivateConfirmText", { name }),
        details: name,
        confirmLabel: t("deactivateConfirmAction"),
        cancelLabel: t("cancel"),
        icon: UserX,
        confirmIcon: UserX,
      });
      if (!ok) return;
    }

    if (targetRole && isChangeableUserRole(role)) {
      await submitRoleChange({ targetRole, fromRole: role, payload, skipConfirm: skipRoleConfirm });
      return;
    }

    // Parol o'zgarsa backend sessiyalarni yopadi (2026-10-23): O'Z parolida — boshqa barcha qurilmalar darhol
    // chiqadi, shu qurilma qoladi (avval hammasi yopilib, shu yerdan ham chiqarilardi — fix3b RBAC-09); BOSHQA
    // xodimning paroli almashsa — o'sha xodimning barcha qurilmalari chiqadi. Matn shuni aytadi; o'z sessiyalari
    // ro'yxati `useUser` mutatsiyasida yangilanadi (`queryKeys.accountSessions`).
    const passwordChanged = Boolean(payload.password);
    const districtSent = payload.district_id !== undefined;
    const districtErrorText = (error: unknown) => {
      const kind = districtSent ? courierDistrictErrorKind(error, { districtSent }) : null;
      return kind ? t(`v2.courierDistrict.errors.${kind}`) : undefined;
    };
    setDistrictError(null);
    await runUserRequest({
      t,
      request: () =>
        (isOwnProfile
          ? updateMyProfile.mutateAsync(payload)
          : updateUser.mutateAsync({ id: userId, data: payload })
        ).catch((error: unknown) => {
          // Tuman xatosi (400 / 503) — «Tuman» maydoni ostida ham; boshqa maydonlar saqlanmagan, kiritilganlar joyida.
          setDistrictError(districtErrorText(error) ?? null);
          throw error;
        }),
      successMessage: !passwordChanged
        ? t("userUpdatedSuccess", { name: userData.name })
        : isSelf
          ? t("ownPasswordChangedOthersSignedOut")
          : t("userUpdatedPasswordReset", { name: userData.name }),
      errorMessage: t("editUserError"),
      onError: (error) => {
        applyBackendFieldErrors(error, setError, SERVER_FIELD_NAME_MAP);
        const passwordMessage = getPasswordPolicyServerMessage(error);
        if (passwordMessage) setError("password", { type: "server", message: passwordMessage });
      },
      onSuccess: () => (warehouseOrderChanged ? void saveWarehouseOrder() : onClose()),
      describeError: districtErrorText,
    });
  };

  const statusOptions: SelectOption[] = STATUS_OPTION_VALUES.map((value) => ({
    value,
    label: t(`v2.common.status.${value}`),
  }));
  const tariffOptions: SelectOption[] = [
    { value: "address", label: t("v2.create.fields.tariffHome") },
    { value: "center", label: t("v2.create.fields.tariffCenter") },
  ];

  /** Pul maydoni (`so'm` qo'shimchasi o'zi): maosh, tariflar. */
  const renderMoneyField = (name: "salary" | "tariff_home" | "tariff_center", label: string, required = false) => (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field label={label} required={required} error={fieldState.error?.message}>
          <TextInput
            mode="money"
            name={field.name}
            ref={field.ref}
            value={field.value}
            onValueChange={field.onChange}
            onBlur={field.onBlur}
            placeholder={name === "salary" ? t("v2.create.fields.salaryPlaceholder") : name === "tariff_home" ? t("v2.create.fields.homeTariffPlaceholder") : t("v2.create.fields.centerTariffPlaceholder")}
          />
        </Field>
      )}
    />
  );

  const isPending =
    (isOwnProfile ? updateMyProfile.isPending : updateUser.isPending) || roleBusy || setWarehouseOrder.isPending;
  const description = userData
    ? t("v2.edit.description", { name: userData.name, role: t(getUserRoleLabelKey(role)) })
    : undefined;

  return (
    <Dialog
      open={Boolean(userId)}
      onClose={onClose}
      title={t("editUser")}
      description={description}
      icon={Pencil}
      size="xl"
      busy={isPending}
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
      formProps={{ noValidate: true }}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            {t("cancel")}
          </Button>
          <Button type="submit" loading={isPending} loadingText={t("v2.edit.saving")} disabled={isLoading || !userData}>
            {t("saveChanges")}
          </Button>
        </>
      }
    >
      {isLoading || !userData ? (
        <SkeletonLines lines={6} />
      ) : (
        <div className="flex flex-col gap-5">
          {canChangeRole && isChangeableUserRole(role) ? (
            <Controller
              control={control}
              name="role"
              render={({ field }) => (
                <RoleSection
                  value={field.value}
                  onChange={(next) => {
                    field.onChange(next);
                    setRoleError(null);
                  }}
                  onBlur={field.onBlur}
                  originalRole={role}
                  userName={userData.name ?? ""}
                  error={roleError}
                  busy={roleBusy}
                  onRetry={() => void handleSubmit((values) => submitForm(values, true))()}
                />
              )}
            />
          ) : null}
          <FormSection title={t("mainData")}>
            <Controller
              control={control}
              name="name"
              render={({ field, fieldState }) => (
                <Field label={t(isMarket ? "v2.edit.marketName" : "v2.edit.name")} required error={fieldState.error?.message}>
                  <TextInput
                    name={field.name}
                    ref={field.ref}
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    placeholder={t(isMarket ? "v2.edit.marketNamePlaceholder" : "v2.create.fields.namePlaceholder")}
                    autoComplete="off"
                  />
                </Field>
              )}
            />
            <Controller
              control={control}
              name="phone"
              render={({ field, fieldState }) => (
                <Field label={t("v2.edit.phone")} required error={fieldState.error?.message}>
                  <TextInput
                    mode="phone"
                    name={field.name}
                    ref={field.ref}
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    placeholder={t("v2.create.fields.phonePlaceholder")}
                  />
                </Field>
              )}
            />
            {!isCustomer ? (
              <Controller
                control={control}
                name="password"
                render={({ field, fieldState }) => (
                  <Field
                    label={t("v2.edit.newPassword")}
                    hint={`${t("v2.edit.newPasswordHint")}. ${t("auth:passwordPolicy.hint", { min: passwordMinLength(effectiveRole) })}`}
                    error={fieldState.error?.message}
                  >
                    <TextInput
                      type={showPassword ? "text" : "password"}
                      name={field.name}
                      value={field.value}
                      onValueChange={field.onChange}
                      onBlur={field.onBlur}
                      placeholder="••••••"
                      autoComplete="new-password"
                      suffix={
                        <IconButton
                          label={t(showPassword ? "v2.create.fields.hidePassword" : "v2.create.fields.showPassword")}
                          icon={showPassword ? EyeOff : Eye}
                          size="sm"
                          aria-pressed={showPassword}
                          className="-mr-2 max-md:-mr-3"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => setShowPassword((previous) => !previous)}
                        />
                      }
                    />
                  </Field>
                )}
              />
            ) : null}
            {!isCustomer && !isOwnProfile && !isSuperAdmin ? (
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Field label={t("v2.edit.status")} hint={t("v2.edit.statusHint")} labelAs="span">
                    <Select
                      options={statusOptions}
                      value={field.value || null}
                      onChange={(next) => field.onChange(next ?? "")}
                      onBlur={field.onBlur}
                      placeholder={t("statusPlaceholder")}
                    />
                  </Field>
                )}
              />
            ) : null}
          </FormSection>

          {isAdmin ? (
            <FormSection title={t(canEditManagerFinancial ? "v2.create.sections.salaryTariff" : "v2.edit.salaryTitle")}>
              {renderMoneyField("salary", t("v2.edit.salary"))}
              <Controller
                control={control}
                name="payment_day"
                render={({ field, fieldState }) => (
                  <Field label={t("paymentDayRange")} labelAs="span" error={fieldState.error?.message}>
                    {/*
                      Ega qarori 2026-10-16: oylik kalendar o'rniga 1–30 kunlar. Saqlangan 31 yoki noto'g'ri
                      qiymat — maydon bo'sh, forma qiymati o'zgarmaydi (saqlashda «1-30» xatosi).
                    */}
                    <Select
                      options={PAYMENT_DAY_OPTIONS}
                      value={toPaymentDayOption(field.value)}
                      onChange={(next) => field.onChange(next ?? "")}
                      onBlur={field.onBlur}
                      placeholder={t("paymentDayPlaceholder")}
                    />
                  </Field>
                )}
              />
              {canEditManagerFinancial ? (
                <>
                  {renderMoneyField("tariff_home", t("v2.edit.homeTariff"))}
                  {renderMoneyField("tariff_center", t("v2.edit.centerTariff"))}
                </>
              ) : null}
            </FormSection>
          ) : null}

          {isCourier ? (
            // FY-S4: «Ish hududi» — viloyat faqat o'qish (filial biriktiruvidan; filial «Boshqa filialga o'tkazish»
            // oynasi orqali, unda tuman tozalanadi). DtKKY0V8 (maket `superadmin-users-edit-courier-district`):
            // «Tuman» — shu viloyat tumanlari, ixtiyoriy, faqat o'zgargan bo'lsa yuboriladi.
            <FormSection title={t("v2.edit.workArea")}>
              <Field
                label={t("v2.edit.region")}
                hint={canTransferCourier ? t("v2.courierDistrict.regionHintEdit") : undefined}
              >
                {/* Yuklanishda ham 44px maydon (oyna sakramaydi, yorliq boshqaruvga bog'langan). */}
                <TextInput
                  readOnly
                  icon={Building2}
                  aria-busy={courierRegionLoading || undefined}
                  placeholder={courierRegionLoading ? t("loading") : undefined}
                  value={
                    courierRegionLoading
                      ? ""
                      : courierRegionFailed
                        ? "—"
                        : courierRegion?.name || t("v2.edit.regionEmpty")
                  }
                />
              </Field>
              <CourierDistrictField
                regionId={courierRegionFailed ? null : courierRegionId}
                regionName={courierRegion?.name ?? null}
                regionLoading={courierRegionLoading}
                value={districtValue}
                onChange={(next) => {
                  setDistrictDraft(next);
                  setDistrictError(null);
                }}
                error={districtError ?? undefined}
                disabledHint={t("v2.courierDistrict.noRegion")}
              />
            </FormSection>
          ) : null}

          {isCourier ? (
            <FormSection title={t("courierTariff")} minCol={170}>
              {renderMoneyField("tariff_home", t("v2.edit.homeTariff"))}
              {renderMoneyField("tariff_center", t("v2.edit.centerTariff"))}
            </FormSection>
          ) : null}

          {isMarket ? (
            <FormSection title={t("marketInfo")} minCol={canEditAiPrice ? 240 : 170}>
              <Controller
                control={control}
                name="default_tariff"
                render={({ field }) => (
                  <Field label={t("v2.edit.defaultTariff")} required labelAs="span">
                    <Select
                      options={tariffOptions}
                      value={field.value || null}
                      onChange={(next) => field.onChange(next ?? "")}
                      onBlur={field.onBlur}
                      placeholder={t("defaultTariffPlaceholder")}
                    />
                  </Field>
                )}
              />
              {/* CS-C: market yorlig'i — «Uyga / Markazga standart narx» (maket); kuryer/menejer «… tarif» qoladi. */}
              {renderMoneyField("tariff_home", t("v2.edit.marketHomePrice"), true)}
              {renderMoneyField("tariff_center", t("v2.edit.marketCenterPrice"), true)}
              {canEditAiPrice ? (
                <Controller
                  control={control}
                  name="ai_price"
                  render={({ field, fieldState }) => (
                    <Field label={t("v2.edit.aiPrice")} hint={t("v2.edit.aiPriceHint")} error={fieldState.error?.message}>
                      <TextInput
                        mode="money"
                        name={field.name}
                        ref={field.ref}
                        value={field.value}
                        onValueChange={field.onChange}
                        onBlur={field.onBlur}
                        placeholder={t("v2.edit.aiPricePlaceholder")}
                      />
                    </Field>
                  )}
                />
              ) : null}
            </FormSection>
          ) : null}

          {canEditWarehouseOrder ? (
            <WarehouseOrderSection checked={warehouseOrder} onChange={setWarehouseOrderDraft} disabled={isPending} />
          ) : null}
        </div>
      )}
    </Dialog>
  );
});

UpdateUserModal.displayName = "UpdateUserModal";
