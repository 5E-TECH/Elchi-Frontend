// dizayn-v2: superadmin-users-create, admin-users-create, manager-users-create-courier, manager-users-create-hybrid, superadmin-users-create-logist, admin-users-create-logist, superadmin-users-create-courier-district
import { memo, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { Controller, useForm, useWatch, type Path } from "react-hook-form";
import { useSelector } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Briefcase,
  Check,
  ClipboardPenLine,
  Eye,
  EyeOff,
  KeyRound,
  Map as MapIcon,
  MapPin,
  Route,
  Store,
  Truck,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import type {
  CreateAdminRequest,
  CreateCourierRequest,
  CreateLogistRequest,
  CreateManagerRequest,
  CreateMarketRequest,
  CreateRegistratorRequest,
  UserRole,
} from "../../../../entities/user/types/user";
import { useUser } from "../../../../entities/user/api/userApi";
import { getUserRoleLabelKey } from "../../../../entities/user/lib/role";
import { useBranches, type Branch } from "../../../../entities/branch";
import type { RootState } from "../../../../app/config/store";
import { cx } from "../../../../shared/lib/cx";
import { notify } from "../../../../shared/lib/notify";
import { getUzbekistanPhoneDigits, toUzbekistanPhoneValue } from "../../../../shared/lib/phone";
import {
  Button,
  Card,
  Field,
  IconButton,
  PageHeader,
  SegmentedControl,
  Select,
  TextInput,
  TONE_SOFT,
  type SelectOption,
} from "../../../../shared/ui/primitives";
import { applyBackendFieldErrors } from "../../lib/backendFieldErrors";
import {
  checkPasswordPolicy,
  getPasswordPolicyServerMessage,
  passwordMinLength,
} from "../../../../shared/lib/passwordPolicy";
import { PAYMENT_DAY_OPTIONS, toPaymentDayOption } from "../../lib/paymentDay";
import { runUserRequest } from "../../lib/userRequest";
import { readViewerBranch } from "../../lib/viewerBranch";
import { getBranchOptionsForRole, isManagerHqSelection } from "../lib/branchOptions";
import { CourierDistrictField } from "../../courier-district/ui/CourierDistrictField";
import { courierDistrictErrorKind } from "../../courier-district/model/courierDistrict";
import {
  areCourierTariffsRequired,
  buildCourierTariffs,
  getMissingCourierTariffs,
} from "../lib/courierTariffs";

const parseAmount = (value: string): number => Number(value.replace(/\D/g, ""));

interface CreateUserFormValues {
  role: UserRole;
  fullName: string;
  phone: string;
  username: string;
  password: string;
  salary: string;
  paymentDay: string;
  branchId: string;
  homeRate: string;
  centerRate: string;
  deliveryType: "address" | "center" | "";
  /** DtKKY0V8 — kuryer tumani (ixtiyoriy, `""` — tumansiz). */
  districtId: string;
}

const INITIAL_FORM: CreateUserFormValues = {
  role: "admin",
  fullName: "",
  phone: "",
  username: "",
  password: "",
  salary: "",
  paymentDay: "",
  branchId: "",
  homeRate: "",
  centerRate: "",
  deliveryType: "",
  districtId: "",
};

const SERVER_FIELD_NAME_MAP: Record<string, Path<CreateUserFormValues>> = {
  name: "fullName",
  full_name: "fullName",
  fullName: "fullName",
  phone: "phone",
  phone_number: "phone",
  phoneNumber: "phone",
  username: "username",
  password: "password",
  salary: "salary",
  payment_day: "paymentDay",
  paymentDay: "paymentDay",
  branch_id: "branchId",
  branchId: "branchId",
  tariff_home: "homeRate",
  tariffHome: "homeRate",
  home_rate: "homeRate",
  tariff_center: "centerRate",
  tariffCenter: "centerRate",
  center_rate: "centerRate",
  default_tariff: "deliveryType",
  defaultTariff: "deliveryType",
  delivery_type: "deliveryType",
  deliveryType: "deliveryType",
  district_id: "districtId",
};

const getBranchOptionLabel = (branch: Branch) => {
  const code = branch.code ? `${branch.code} • ` : "";
  const type = branch.type ? `${branch.type} • ` : "";
  const region = branch.region?.name && branch.region.name !== "—" ? ` • ${branch.region.name}` : "";

  return `${code}${type}${branch.name}${region}`;
};

/** Rol kartalari (maket: ikonka + nom + izoh). `marketing` — market yaratish (API rol nomi). */
const ROLE_ICONS: Record<string, LucideIcon> = {
  admin: UserCog,
  manager: Briefcase,
  registrator: ClipboardPenLine,
  logist: Route,
  courier: Truck,
  marketing: Store,
};
/** Superadmin/admin rollari (LG-2: Admin · Menejer · Ro'yxatchi · Logist · Kuryer · Market). */
const ROLE_ORDER: UserRole[] = ["admin", "manager", "registrator", "logist", "courier", "marketing"];

/** `?role=logist` («Logist biriktirish» → «Logist yaratish») — shu rol tanlangan holda ochiladi. */
const readRoleParam = (value: string | null, allowed: readonly UserRole[]): UserRole | null =>
  value && (allowed as readonly string[]).includes(value) ? (value as UserRole) : null;

/** Logist yaratilgach — «Logist biriktirish» shu logist tanlangan holda. */
const logistAssignmentPath = (id: unknown) =>
  typeof id === "string" || typeof id === "number"
    ? `/regions/logist-assignment?logist=${encodeURIComponent(String(id))}`
    : "/regions/logist-assignment";

/** `POST /logists` javobidan yangi logist id'si (`successRes(user)` → `data.id`; axios javobi ham bo'lishi mumkin). */
const createdIdOf = (response: unknown): unknown => {
  const body = (response as { data?: unknown } | null)?.data ?? response;
  const data = (body as { data?: unknown } | null)?.data ?? body;
  return (data as { id?: unknown } | null)?.id;
};

const statusOf = (error: unknown): number | undefined =>
  (error as { response?: { status?: unknown } } | null)?.response?.status as number | undefined;

/** `.el-overline` — bo'lim sarlavhasi. */
const OVERLINE = "m-0 text-xs font-semibold uppercase tracking-[.05em] text-text-muted";
/** Maydonlar to'ri (maket: `repeat(auto-fit, minmax(…, 1fr))`). */
const GRID_200 = "grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-4";
const GRID_260 = "grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-4";

const FormSection = ({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) => (
  <div className="flex flex-col gap-4 border-t border-border px-5 py-5 first:border-t-0 max-md:px-4">
    <div className="flex flex-col gap-1">
      <h3 className={OVERLINE}>{title}</h3>
      {note ? <p className="m-0 text-[13px] text-text-muted">{note}</p> : null}
    </div>
    {children}
  </div>
);

/**
 * YANGI FOYDALANUVCHI — `/all-users/create-user` sahifasining butun tarkibi (dizayn v2).
 *
 * Maketlar: `superadmin-users-create` (= admin; 5 rol), `manager-users-create-courier` (REGIONAL menejer —
 * rol tanlanmaydi, «Biriktirish» kartasi), `manager-users-create-hybrid` (HYBRID menejer — Kuryer, Ro'yxatchi,
 * Market). Chapda rol kartasi + «Kirish ma'lumotlarini o'zingiz bering» izohi; o'ngda forma kartasi
 * («{Rol} qo'shish»): «Asosiy ma'lumotlar» → rolga qarab maosh/tarif, filial, kirish ma'lumotlari, yetkazish tarifi;
 * pastda «Bekor qilish» · «Saqlash». Telefonda ustma-ust.
 *
 * Xulq AYNAN saqlangan: rollar (`managerAllowedRoles`), filial ro'yxati va HQ cheklovi, maosh/to'lov kuni
 * qoidalari, kuryer tariflari (fix3b FE-USR-11), har rol payload'i, backend maydon xatolari, muvaffaqiyatda
 * `navigate(-1)`. Filiallar so'rovi faqat superadmin/admin uchun (menejerga `GET branches` 403).
 */
export const CreateUserForm = memo(() => {
  const { t } = useTranslation(["users", "common", "auth"]);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const formId = useId();
  const authRole = useSelector((state: RootState) => state.role.role);
  const viewerBranch = useSelector((state: RootState) => readViewerBranch(state.user.user), shallowBranch);

  const currentBranchType = viewerBranch.type;
  const currentBranchId = viewerBranch.id;
  const isManagerHybridCreator = authRole === "manager" && currentBranchType === "HYBRID";
  // REGIONAL menejer — faqat kuryer (avvalgidek). fix3 CODE-21: boshqa
  // turdagi (PICKUP/HQ/noma'lum) menejer uchun avval `null` = HAMMA rollar
  // ochilardi. Hozir bu sahifaga ular kira olmaydi (`staff` qobiliyati yo'q),
  // lekin yo'l ochilsa — eng tor to'plam (backend baribir tekshiradi).
  const managerAllowedRoles = useMemo<UserRole[] | null>(
    () =>
      authRole !== "manager"
        ? null
        : isManagerHybridCreator
          ? ["courier", "registrator", "marketing"]
          : ["courier"],
    [authRole, isManagerHybridCreator],
  );

  const [showPassword, setShowPassword] = useState(false);
  const getRoleLabel = (userRole: UserRole) => t(getUserRoleLabelKey(userRole));

  const [initialRole] = useState<UserRole>(
    () => readRoleParam(searchParams.get("role"), managerAllowedRoles ?? ROLE_ORDER) ?? INITIAL_FORM.role,
  );
  const methods = useForm<CreateUserFormValues>({
    defaultValues: { ...INITIAL_FORM, role: initialRole },
    mode: "onTouched",
  });

  const { control, handleSubmit, reset, setValue, setError, clearErrors } = methods;

  const role = useWatch({ control, name: "role" });
  // DtKKY0V8: kuryer «Ish hududi» — tanlangan filial (superadmin/admin) va uning viloyati.
  const watchedBranchId = useWatch({ control, name: "branchId" }) ?? "";
  // fix3b FE-USR-11: kuryer tariflari maosh kiritilmaguncha majburiy (yulduzcha).
  const salaryValue = useWatch({ control, name: "salary" }) ?? "";
  const courierTariffsRequired = areCourierTariffsRequired({ salary: salaryValue });
  // Menejer: o'z tartibida (maket `manager-users-create-hybrid`: Kuryer, Ro'yxatchi, Market).
  const visibleRoles = managerAllowedRoles ?? ROLE_ORDER;
  const shouldShowRolePanel = visibleRoles.length > 1;

  const { createAdmin, createManager, createRegistrator, createMarket, createCourier, createLogist } = useUser();
  // Filial tanlovi faqat superadmin/admin formasida — menejer uchun `GET branches` 403 (BatchesPage naqshi).
  const canLoadBranches = authRole === "superadmin" || authRole === "admin";
  const { data: branchesResponse, isLoading: isBranchesLoading } = useBranches(
    { page: 1, limit: 500 },
    canLoadBranches,
  );

  // Menejer uchun HQ ko'rsatilmaydi (HQ da menejer bo'lmaydi), registrator
  // uchun HQ qoladi — qoida `getBranchOptionsForRole` da.
  const branchOptions: SelectOption[] = getBranchOptionsForRole(branchesResponse?.data, role).map((branch) => ({
    value: branch.id,
    label: getBranchOptionLabel(branch),
  }));
  // Kuryer viloyati: menejer — o'z filiali; superadmin/admin — tanlangan filial (tanlanmasa HQ — viloyat noma'lum,
  // tuman tanlanmaydi: maket «Avval filialni tanlang»).
  const selectedCourierBranch = canLoadBranches
    ? (branchesResponse?.data ?? []).find((branch) => String(branch.id) === String(watchedBranchId)) ?? null
    : null;
  const selectedBranchRegion =
    selectedCourierBranch?.region?.id && selectedCourierBranch.region.name !== "—" ? selectedCourierBranch.region : null;
  const courierRegionId = canLoadBranches ? (selectedBranchRegion?.id ?? null) : viewerBranch.regionId || null;
  const courierRegionName = canLoadBranches ? (selectedBranchRegion?.name ?? null) : viewerBranch.regionName;

  useEffect(() => {
    reset({ ...INITIAL_FORM, role });
  }, [role, reset]);

  useEffect(() => {
    if (managerAllowedRoles && !managerAllowedRoles.includes(role)) {
      setValue("role", managerAllowedRoles[0]);
    }
  }, [managerAllowedRoles, role, setValue]);

  const isPending =
    createAdmin.isPending ||
    createManager.isPending ||
    createRegistrator.isPending ||
    createMarket.isPending ||
    createCourier.isPending ||
    createLogist.isPending;

  const validateByRole = (values: CreateUserFormValues): boolean => {
    let valid = true;

    if (!values.fullName.trim()) {
      setError("fullName", { message: t(role === "marketing" ? "v2.create.errors.marketNameRequired" : "firstNameRequired") });
      valid = false;
    }

    if (getUzbekistanPhoneDigits(values.phone).length !== 9) {
      setError("phone", { message: t("phoneValidation") });
      valid = false;
    }

    // NDmZMzCP: kamida 8 (xodim — 10) belgi, boshida/oxirida bo'shliqsiz; qolganini (oddiy / ketma-ket / telefon) server.
    const passwordIssue = checkPasswordPolicy(values.password, role);
    if (passwordIssue === "required") {
      setError("password", { message: t("passwordRequired") });
      valid = false;
    } else if (passwordIssue) {
      setError("password", {
        message: t(`auth:passwordPolicy.${passwordIssue}`, { min: passwordMinLength(role) }),
      });
      valid = false;
    }

    if (role === "admin" || role === "registrator" || role === "logist") {
      if (!values.salary) {
        setError("salary", { message: t("salaryRequired") });
        valid = false;
      }
    }

    if (role === "admin" || role === "registrator") {
      if (!values.paymentDay) {
        setError("paymentDay", { message: t("dateRequired") });
        valid = false;
      } else {
        const day = Number(values.paymentDay);
        if (day < 1 || day > 30) {
          setError("paymentDay", { message: t("paymentDayValidation") });
          valid = false;
        }
      }
    }

    const isHybridManagerRegistrator = isManagerHybridCreator && role === "registrator";
    const resolvedBranchId = isHybridManagerRegistrator ? currentBranchId : values.branchId;

    if ((role === "manager" || role === "registrator") && !resolvedBranchId) {
      setError("branchId", { message: t("branchRequired") });
      valid = false;
    } else if (isManagerHqSelection(branchesResponse?.data, role, resolvedBranchId)) {
      // Himoya: HQ ga menejer biriktirilmaydi (backend ham 400 qaytaradi).
      setError("branchId", { message: t("managerHqNotAllowed") });
      valid = false;
    }

    // Logist: to'lov kuni ixtiyoriy (backend sukuti — biznes to'lov kuni), berilsa 1–30.
    if (role === "logist" && values.paymentDay) {
      const day = Number(values.paymentDay);
      if (day < 1 || day > 30) {
        setError("paymentDay", { message: t("paymentDayValidation") });
        valid = false;
      }
    }

    if (role === "courier" || role === "manager") {
      const hasSalary = Boolean(values.salary.trim());
      if (hasSalary && !values.paymentDay) {
        setError("paymentDay", { message: t("dateRequired") });
        valid = false;
      } else if (hasSalary && values.paymentDay) {
        const day = Number(values.paymentDay);
        if (day < 1 || day > 30) {
          setError("paymentDay", { message: t("paymentDayValidation") });
          valid = false;
        }
      }

      const hasHomeRate = Boolean(values.homeRate.trim());
      const hasCenterRate = Boolean(values.centerRate.trim());
      // fix3b FE-USR-11: maoshsiz kuryerda ikkala tarif ham majburiy (0 ga
      // tushirish faqat maoshli kuryer uchun). Menejerda tariflar ixtiyoriy.
      const missingCourierTariffs =
        role === "courier" ? getMissingCourierTariffs(values) : { home: false, center: false };
      if (missingCourierTariffs.home || missingCourierTariffs.center) {
        if (missingCourierTariffs.home) {
          setError("homeRate", { message: t("homeTariffRequiredNoSalary") });
        }
        if (missingCourierTariffs.center) {
          setError("centerRate", { message: t("centerTariffRequiredNoSalary") });
        }
        valid = false;
      } else if (hasHomeRate !== hasCenterRate) {
        if (!hasHomeRate) {
          setError("homeRate", { message: t("homeTariffRequired") });
        }
        if (!hasCenterRate) {
          setError("centerRate", { message: t("centerTariffRequired") });
        }
        valid = false;
      }
    }

    if (role === "marketing") {
      if (!values.username.trim()) {
        // Eski «Username kiritilmadi» — inglizcha so'z; maketdagi maydon nomi «Login».
        setError("username", { message: t("v2.create.errors.loginRequired") });
        valid = false;
      }
      if (!values.homeRate) {
        setError("homeRate", { message: t("homeTariffRequired") });
        valid = false;
      }
      if (!values.centerRate) {
        setError("centerRate", { message: t("centerTariffRequired") });
        valid = false;
      }
      if (!values.deliveryType) {
        setError("deliveryType", { message: t("deliveryTypeRequired") });
        valid = false;
      }
    }

    return valid;
  };

  const submitRequest = <T,>(
    request: () => Promise<T>,
    successMessage: string,
    describeError?: (error: unknown) => string | undefined,
  ) =>
    runUserRequest({
      t,
      request,
      successMessage,
      errorMessage: t("loadError"),
      onError: (error) => {
        applyBackendFieldErrors(error, setError, SERVER_FIELD_NAME_MAP);
        // Parol siyosati 400 (`message` massivi, `errors` siz) — matn parol maydoni ostida ham.
        const passwordMessage = getPasswordPolicyServerMessage(error);
        if (passwordMessage) setError("password", { type: "server", message: passwordMessage });
      },
      onSuccess: () => navigate(-1),
      describeError,
    });

  const onSubmit = async (values: CreateUserFormValues) => {
    clearErrors();
    if (!validateByRole(values)) return;

    const rawPhone = toUzbekistanPhoneValue(values.phone);

    if (role === "admin") {
      const payload: CreateAdminRequest = {
        name: values.fullName,
        phone_number: rawPhone,
        password: values.password,
        salary: parseAmount(values.salary),
        payment_day: Number(values.paymentDay),
      };
      await submitRequest(() => createAdmin.mutateAsync(payload), t("createAdmin"));
      return;
    }

    if (role === "registrator") {
      const branchId = isManagerHybridCreator && currentBranchId ? currentBranchId : values.branchId;

      const payload: CreateRegistratorRequest = {
        name: values.fullName,
        phone_number: rawPhone,
        password: values.password,
        salary: parseAmount(values.salary),
        payment_day: Number(values.paymentDay),
        branch_id: branchId,
      };
      await submitRequest(() => createRegistrator.mutateAsync(payload), t("createRegistrator"));
      return;
    }

    if (role === "manager") {
      const payload: CreateManagerRequest = {
        name: values.fullName,
        phone_number: rawPhone,
        password: values.password,
        branch_id: values.branchId,
      };

      if (values.salary.trim()) {
        payload.salary = parseAmount(values.salary);
        if (values.paymentDay) {
          payload.payment_day = Number(values.paymentDay);
        }
      }
      if (values.homeRate.trim() && values.centerRate.trim()) {
        payload.tariff_home = parseAmount(values.homeRate);
        payload.tariff_center = parseAmount(values.centerRate);
      }

      await submitRequest(() => createManager.mutateAsync(payload), t("createManager"));
      return;
    }

    if (role === "courier") {
      const payload: CreateCourierRequest = {
        name: values.fullName,
        phone_number: rawPhone,
        password: values.password,
      };
      // `region_id` yuborilmaydi: gateway DTO'sida yo'q (doim 400 edi) — hudud filialdan olinadi.
      if (authRole === "manager" && currentBranchId) payload.branch_id = currentBranchId;
      // perqZ3oM / FY-6 (maket `superadmin-users-create-courier-district`): superadmin/admin filial tanlasa — kuryer
      // o'sha filialda (viloyati filialdan); tanlanmasa — avvalgidek HQ.
      if (canLoadBranches && values.branchId) payload.branch_id = values.branchId;
      // DtKKY0V8: tuman — ixtiyoriy, faqat kuryer viloyatidan (backend ham tekshiradi: 400 / 503).
      if (values.districtId) payload.district_id = values.districtId;
      if (values.salary.trim()) {
        payload.salary = parseAmount(values.salary);
        if (values.paymentDay) {
          payload.payment_day = Number(values.paymentDay);
        }
      }
      // Backend ikkala tarifni ham majburiy qiladi. Bo'sh tariflar 0 bo'ladi
      // FAQAT maoshli kuryerda (fix3 FE-USR-11, fix3b) — boshqa holatni forma
      // tekshiruvi to'xtatgan; bu himoya tekshiruvi.
      const tariffs = buildCourierTariffs(values);
      if (!tariffs) return;
      payload.tariff_home = tariffs.tariff_home;
      payload.tariff_center = tariffs.tariff_center;

      const districtSent = Boolean(payload.district_id);
      const districtError = (error: unknown) => {
        const kind = courierDistrictErrorKind(error, { districtSent });
        return kind ? t(`v2.courierDistrict.errors.${kind}`) : undefined;
      };
      await submitRequest(
        () =>
          createCourier.mutateAsync(payload).catch((error: unknown) => {
            // Tuman xatosi — maydon ostida ham (kuryer yaratilmagan, kiritilganlar joyida).
            const message = districtError(error);
            if (message) setError("districtId", { type: "server", message });
            throw error;
          }),
        t("createCourier"),
        districtError,
      );
      return;
    }

    if (role === "logist") {
      const payload: CreateLogistRequest = {
        name: values.fullName.trim(),
        phone_number: rawPhone,
        password: values.password,
        salary: parseAmount(values.salary),
      };
      if (values.paymentDay) payload.payment_day = Number(values.paymentDay);
      try {
        const response = await createLogist.mutateAsync(payload);
        notify.success(t("v2.logist.created"), {
          description: t("v2.logist.createdDescription", { name: payload.name }),
        });
        navigate(logistAssignmentPath(createdIdOf(response)));
      } catch (error) {
        // Server matni ko'rsatilmaydi: 409 — telefon band (maydon ostida), qolgani — umumiy xabar.
        const passwordMessage = getPasswordPolicyServerMessage(error);
        if (statusOf(error) === 409) {
          setError("phone", { type: "server", message: t("v2.logist.phoneTaken") });
        } else if (passwordMessage) {
          setError("password", { type: "server", message: passwordMessage });
        } else {
          notify.error(t("v2.logist.createError"), { description: t("v2.logist.createErrorText") });
        }
      }
      return;
    }

    if (role === "marketing") {
      const payload: CreateMarketRequest = {
        name: values.fullName,
        phone_number: rawPhone,
        username: values.username,
        password: values.password,
        tariff_home: parseAmount(values.homeRate),
        tariff_center: parseAmount(values.centerRate),
        default_tariff: values.deliveryType === "center" ? "center" : "address",
      };

      await submitRequest(() => createMarket.mutateAsync(payload), t("createMarket"));
    }
  };

  // ─── Maydonlar ────────────────────────────────────────────────────────────

  const renderTextField = (
    name: "fullName" | "username",
    label: string,
    placeholder: string,
    hint?: string,
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field label={label} required hint={hint} error={fieldState.error?.message}>
          <TextInput
            name={field.name}
            value={field.value}
            onValueChange={field.onChange}
            onBlur={field.onBlur}
            placeholder={placeholder}
            autoComplete="off"
          />
        </Field>
      )}
    />
  );

  const renderMoneyField = (
    name: "salary" | "homeRate" | "centerRate",
    label: string,
    placeholder: string,
    { required, hint }: { required: boolean; hint?: string },
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field label={label} required={required} hint={hint} error={fieldState.error?.message}>
          <TextInput
            mode="money"
            name={field.name}
            value={field.value}
            onValueChange={field.onChange}
            onBlur={field.onBlur}
            placeholder={placeholder}
          />
        </Field>
      )}
    />
  );

  const phoneField = (
    <Controller
      control={control}
      name="phone"
      render={({ field, fieldState }) => (
        <Field label={t("v2.create.fields.phone")} required error={fieldState.error?.message}>
          <TextInput
            mode="phone"
            name={field.name}
            value={field.value}
            onValueChange={field.onChange}
            onBlur={field.onBlur}
            placeholder={t("v2.create.fields.phonePlaceholder")}
          />
        </Field>
      )}
    />
  );

  const passwordField = (
    <Controller
      control={control}
      name="password"
      render={({ field, fieldState }) => (
        <Field
          label={t("v2.create.fields.password")}
          required
          hint={t("auth:passwordPolicy.hint", { min: passwordMinLength(role) })}
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
  );

  const renderPaymentDayField = (required: boolean, hint?: string) => (
    <Controller
      control={control}
      name="paymentDay"
      render={({ field, fieldState }) => (
        <Field
          label={t("v2.create.fields.paymentDay")}
          labelAs="span"
          required={required}
          hint={hint ?? t(required ? "v2.create.fields.paymentDayHintRequired" : "v2.create.fields.paymentDayHint")}
          error={fieldState.error?.message}
        >
          {/* Ega qarori 2026-10-16: oylik kalendar o'rniga 1–30 kunlar; qiymat avvalgidek satr. */}
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
  );

  const branchField = (
    <Controller
      control={control}
      name="branchId"
      render={({ field, fieldState }) => (
        <Field label={t("v2.create.fields.branch")} labelAs="span" required error={fieldState.error?.message}>
          <Select
            searchable
            options={branchOptions}
            value={field.value || null}
            onChange={(next) => field.onChange(next ?? "")}
            onBlur={field.onBlur}
            placeholder={t("branchPlaceholder")}
            loading={isBranchesLoading}
          />
        </Field>
      )}
    />
  );

  // DtKKY0V8 (maketlar `superadmin-users-create-courier-district`, `manager-users-create-courier-district`):
  // superadmin/admin — Filial (ixtiyoriy) · Viloyat (filialdan, faqat o'qish) · Tuman; menejer — faqat Tuman (o'z
  // filiali viloyati). Filial almashsa tuman tozalanadi (boshqa viloyat tumani 400 bo'lardi).
  const courierDistrictField = (
    <Controller
      control={control}
      name="districtId"
      render={({ field, fieldState }) => (
        <CourierDistrictField
          regionId={courierRegionId}
          regionName={courierRegionName}
          value={field.value}
          onChange={field.onChange}
          onBlur={field.onBlur}
          error={fieldState.error?.message}
          disabledHint={
            canLoadBranches && !watchedBranchId
              ? t("v2.courierDistrict.needBranch")
              : t("v2.courierDistrict.branchNoRegion")
          }
        />
      )}
    />
  );
  const courierWorkArea = (
    <FormSection title={t("v2.edit.workArea")}>
      <div className={GRID_200}>
        {canLoadBranches ? (
          <>
            <Controller
              control={control}
              name="branchId"
              render={({ field, fieldState }) => (
                <Field
                  label={t("v2.create.fields.branch")}
                  labelAs="span"
                  hint={t("v2.courierDistrict.branchHint")}
                  error={fieldState.error?.message}
                >
                  <Select
                    searchable
                    clearable
                    options={branchOptions}
                    value={field.value || null}
                    onChange={(next) => {
                      field.onChange(next ?? "");
                      setValue("districtId", "");
                      clearErrors("districtId");
                    }}
                    onBlur={field.onBlur}
                    placeholder={t("branchPlaceholder")}
                    loading={isBranchesLoading}
                  />
                </Field>
              )}
            />
            <Field label={t("v2.edit.region")} hint={t("v2.courierDistrict.regionHint")}>
              <TextInput readOnly icon={MapPin} value={selectedBranchRegion?.name ?? "—"} />
            </Field>
          </>
        ) : null}
        {courierDistrictField}
      </div>
    </FormSection>
  );

  const salaryPlaceholder = t("v2.create.fields.salaryPlaceholder");
  const homeTariff = (required: boolean) =>
    renderMoneyField("homeRate", t("v2.create.fields.homeTariff"), t("v2.create.fields.homeTariffPlaceholder"), {
      required,
      hint: t("v2.create.fields.homeTariffHint"),
    });
  const centerTariff = (required: boolean) =>
    renderMoneyField("centerRate", t("v2.create.fields.centerTariff"), t("v2.create.fields.centerTariffPlaceholder"), {
      required,
      hint: t("v2.create.fields.centerTariffHint"),
    });

  const showBranchField =
    role === "manager" || (role === "registrator" && !(isManagerHybridCreator && Boolean(currentBranchId)));
  const isMarketRole = role === "marketing";
  const RoleIcon = ROLE_ICONS[role] ?? UserCog;

  const roleHint = (key: UserRole) => {
    if (key === "marketing") return t("v2.create.roleHint.market");
    if (key === "logist") return t("v2.logist.roleHint");
    if (key === "registrator" && isManagerHybridCreator) return t("v2.create.roleHint.registratorOwnBranch");
    return t(`v2.create.roleHint.${key}`);
  };

  // ─── Chap ustun: rol kartasi / biriktirish kartasi + izoh ────────────────

  const rolePanel = shouldShowRolePanel ? (
    <Card title={t("v2.create.roleCard")} divided padding="none">
      <fieldset className="m-0 grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-2 border-0 p-4">
        <legend className="sr-only">{t("v2.create.roleGroup")}</legend>
        {visibleRoles.map((key, index) => {
          const Icon = ROLE_ICONS[key] ?? UserCog;
          const selected = key === role;
          const lastOdd = index === visibleRoles.length - 1 && visibleRoles.length % 2 === 1;
          return (
            <label
              key={key}
              className={cx(
                "flex min-h-[60px] cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5",
                "transition-[background-color,border-color] duration-150 motion-reduce:transition-none",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-action",
                selected ? "border-action bg-action-soft" : "border-border bg-surface hover:bg-sunken",
                lastOdd && "col-span-full",
              )}
            >
              <input
                type="radio"
                name={`${formId}-role`}
                value={key}
                checked={selected}
                onChange={() => setValue("role", key)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={cx(
                  "inline-flex size-9 shrink-0 items-center justify-center rounded-[10px]",
                  selected ? "bg-surface text-action-fg" : "bg-sunken text-text-muted",
                )}
              >
                <Icon size={18} strokeWidth={2} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-semibold text-text">{getRoleLabel(key)}</span>
                <span className="text-xs text-text-muted">{roleHint(key)}</span>
              </span>
              {selected ? <Check size={18} strokeWidth={2} aria-hidden="true" className="shrink-0 text-action-fg" /> : null}
            </label>
          );
        })}
        {isManagerHybridCreator ? (
          <p className="col-span-full m-0 text-[13px] text-text-muted">
            {viewerBranch.name
              ? t("v2.create.hybridNote", { branch: viewerBranch.name })
              : t("v2.create.hybridNoteOwnBranch")}
          </p>
        ) : null}
      </fieldset>
    </Card>
  ) : (
    <Card title={t("v2.create.assignCard")} divided bodyClassName="flex flex-col gap-4">
      <div className="flex items-center gap-3 rounded-xl border border-action bg-action-soft px-3.5 py-2.5">
        <span
          aria-hidden="true"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-surface text-action-fg"
        >
          <Truck size={18} strokeWidth={2} />
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="font-semibold text-text">{t("v2.create.assignCourier")}</span>
          <span className="text-xs text-text-muted">{t("v2.create.assignCourierHint")}</span>
        </span>
      </div>
      <dl className="m-0 grid grid-cols-2 gap-4 text-sm">
        <div className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-[13px] text-text-muted">{t("v2.create.assignBranch")}</dt>
          <dd className="m-0 font-semibold text-text">{viewerBranch.name ?? "—"}</dd>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-[13px] text-text-muted">{t("v2.create.assignRegion")}</dt>
          <dd className="m-0 font-semibold text-text">{viewerBranch.regionName ?? "—"}</dd>
        </div>
      </dl>
      <p className="m-0 text-[13px] text-text-muted">{t("v2.create.assignNote")}</p>
    </Card>
  );

  const credentialsNote = (
    <div role="note" className={cx("flex min-w-0 items-start gap-3 rounded-xl px-4 py-3 text-sm", TONE_SOFT.info)}>
      <KeyRound size={18} aria-hidden="true" className="mt-px shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-1 text-text">
        <div className="font-bold">{t("v2.create.alertTitle")}</div>
        <div className="text-[13px] leading-[18px]">
          {t(shouldShowRolePanel ? "v2.create.alertText" : "v2.create.alertTextCourier")}
        </div>
      </div>
    </div>
  );

  // ─── O'ng ustun: forma kartasi ────────────────────────────────────────────

  const formDescription =
    role === "courier"
      ? t("v2.create.formDescription.courier")
      : isMarketRole
        ? t("v2.create.formDescription.market")
        : role === "logist"
          ? t("v2.logist.formDescription")
          : undefined;

  const formTitle = (
    <span className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden="true"
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-sunken text-text-muted"
      >
        <RoleIcon size={20} strokeWidth={2} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span>{t("addRoleTitle", { role: getRoleLabel(role) })}</span>
        {formDescription ? <span className="text-[13px] font-normal text-text-muted">{formDescription}</span> : null}
      </span>
    </span>
  );

  return (
    <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
      <PageHeader
        back="/all-users"
        backLabel={t("v2.common.back")}
        title={t("createNewUser")}
        description={
          <>
            {shouldShowRolePanel ? t("v2.create.description") : t("v2.create.descriptionCourierOnly")}
          </>
        }
      />

      <div className="flex flex-wrap items-start gap-6 max-md:gap-4">
        <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-4">
          {rolePanel}
          {credentialsNote}
        </div>

        <form
          id={formId}
          noValidate
          onSubmit={(event) => void handleSubmit(onSubmit)(event)}
          aria-label={t("addRoleTitle", { role: getRoleLabel(role) })}
          className="min-w-0 flex-[3_1_520px]"
        >
          <Card
            as="div"
            padding="none"
            title={formTitle}
            divided
            footer={
              <div className="ml-auto flex gap-2 max-md:w-full max-md:[&>*]:flex-1">
                <Button variant="secondary" onClick={() => navigate(-1)} disabled={isPending}>
                  {t("cancel")}
                </Button>
                <Button type="submit" loading={isPending} loadingText={t("v2.create.saving")}>
                  {t("save")}
                </Button>
              </div>
            }
          >
            <FormSection title={t("v2.create.sections.main")}>
              <div className={GRID_200}>
                {renderTextField(
                  "fullName",
                  t(isMarketRole ? "v2.create.fields.marketName" : "v2.create.fields.name"),
                  t(isMarketRole ? "v2.create.fields.marketNamePlaceholder" : "v2.create.fields.namePlaceholder"),
                )}
                {phoneField}
                {isMarketRole ? null : passwordField}
              </div>
            </FormSection>

            {showBranchField ? (
              <FormSection title={t("v2.create.sections.branch")}>
                <div className={GRID_260}>{branchField}</div>
              </FormSection>
            ) : null}

            {role === "admin" || role === "registrator" ? (
              <FormSection title={t("v2.create.sections.salary")}>
                <div className={GRID_260}>
                  {renderMoneyField("salary", t("v2.create.fields.salary"), salaryPlaceholder, { required: true })}
                  {renderPaymentDayField(true)}
                </div>
              </FormSection>
            ) : null}

            {role === "logist" ? (
              <>
                <FormSection title={t("v2.logist.sections.salary")}>
                  <div className={GRID_260}>
                    {renderMoneyField("salary", t("v2.create.fields.salary"), salaryPlaceholder, {
                      required: true,
                      hint: t("v2.logist.salaryHint"),
                    })}
                    {renderPaymentDayField(false, t("v2.logist.paymentDayHint"))}
                  </div>
                </FormSection>
                <FormSection title={t("v2.logist.sections.regions")}>
                  <div className="flex items-start gap-3 rounded-xl bg-sunken px-4 py-3">
                    <MapIcon size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-text-subtle" />
                    <p className="m-0 min-w-0 text-[13px] leading-[18px] text-text">{t("v2.logist.regionsNote")}</p>
                  </div>
                </FormSection>
              </>
            ) : null}

            {role === "manager" ? (
              <FormSection title={t("v2.create.sections.salaryTariff")}>
                <div className={GRID_260}>
                  {renderMoneyField("salary", t("v2.create.fields.salary"), salaryPlaceholder, {
                    required: false,
                    hint: t("v2.create.fields.salaryOptional"),
                  })}
                  {renderPaymentDayField(false)}
                </div>
                <div className={GRID_260}>
                  {homeTariff(false)}
                  {centerTariff(false)}
                </div>
              </FormSection>
            ) : null}

            {role === "courier" ? courierWorkArea : null}

            {role === "courier" ? (
              <FormSection title={t("v2.create.sections.salaryTariff")} note={t("v2.create.fields.courierSalaryNote")}>
                <div className={GRID_260}>
                  {renderMoneyField("salary", t("v2.create.fields.salary"), salaryPlaceholder, {
                    required: false,
                    hint: t("v2.create.fields.salaryOptional"),
                  })}
                  {renderPaymentDayField(false)}
                </div>
                <div className={GRID_260}>
                  {homeTariff(courierTariffsRequired)}
                  {centerTariff(courierTariffsRequired)}
                </div>
              </FormSection>
            ) : null}

            {isMarketRole ? (
              <>
                <FormSection title={t("v2.create.sections.login")}>
                  <div className={GRID_260}>
                    {renderTextField(
                      "username",
                      t("v2.create.fields.login"),
                      t("v2.create.fields.loginPlaceholder"),
                      t("v2.create.fields.loginHint"),
                    )}
                    {passwordField}
                  </div>
                </FormSection>
                <FormSection title={t("v2.create.sections.delivery")}>
                  <Controller
                    control={control}
                    name="deliveryType"
                    render={({ field, fieldState }) => (
                      <Field
                        label={t("v2.create.fields.defaultTariff")}
                        labelAs="span"
                        required
                        hint={t("v2.create.fields.defaultTariffHint")}
                        error={fieldState.error?.message}
                      >
                        <SegmentedControl
                          ariaLabel={t("v2.create.fields.defaultTariff")}
                          value={field.value || ""}
                          onValueChange={(next) => {
                            field.onChange(next);
                            field.onBlur();
                          }}
                          options={[
                            { value: "address", label: t("v2.create.fields.tariffHome") },
                            { value: "center", label: t("v2.create.fields.tariffCenter") },
                          ]}
                          className="self-start max-md:self-stretch"
                        />
                      </Field>
                    )}
                  />
                  <div className={GRID_260}>
                    {homeTariff(true)}
                    {centerTariff(true)}
                  </div>
                </FormSection>
              </>
            ) : null}
          </Card>
        </form>
      </div>
    </div>
  );
});

CreateUserForm.displayName = "CreateUserForm";

/** `readViewerBranch` har chaqiruvda yangi obyekt — selektor qayta chizishni maydonlar bo'yicha solishtiradi. */
function shallowBranch(left: ReturnType<typeof readViewerBranch>, right: ReturnType<typeof readViewerBranch>) {
  return (
    left.id === right.id &&
    left.name === right.name &&
    left.type === right.type &&
    left.regionId === right.regionId &&
    left.regionName === right.regionName
  );
}
