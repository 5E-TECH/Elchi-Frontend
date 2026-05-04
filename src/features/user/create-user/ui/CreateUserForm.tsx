import { memo, useEffect, useState, type ReactNode } from "react";
import { Controller, useForm, useWatch, type Path } from "react-hook-form";
import type {
  CreateAdminRequest,
  CreateCourierRequest,
  CreateManagerRequest,
  CreateMarketRequest,
  CreateRegistratorRequest,
  UserRole,
} from "../../../../entities/user/types/user";
import { RoleSelector } from "./RoleSelector";
import Select from "../../../../shared/ui/Select";
import { useUser } from "../../../../entities/user/api/userApi";
import { useAppNotification } from "../../../../app/providers/notification/NotificationProvider";
import {
  Building,
  Calendar,
  ChevronDown,
  Eye,
  EyeOff,
  Send,
  Shield,
  Store,
  Truck,
  User,
  Users,
  Briefcase,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { applyBackendFieldErrors } from "../../lib/backendFieldErrors";
import { useTranslation } from "react-i18next";
import { getUserRoleLabelKey } from "../../../../entities/user/lib/role";
import { useBranches } from "../../../../entities/branch";

const formatAmount = (value: string): string => {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  const parts: string[] = [];
  let remaining = digits;
  while (remaining.length > 3) {
    parts.unshift(remaining.slice(-3));
    remaining = remaining.slice(0, -3);
  }
  if (remaining) parts.unshift(remaining);
  return parts.join(" ");
};

const parseAmount = (value: string): number =>
  Number(value.replace(/\s/g, ""));

const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 9);
  const parts: string[] = [];
  if (digits.length > 0) parts.push(digits.slice(0, 2));
  if (digits.length > 2) parts.push(digits.slice(2, 5));
  if (digits.length > 5) parts.push(digits.slice(5, 7));
  if (digits.length > 7) parts.push(digits.slice(7, 9));
  return parts.join(" ");
};

const parsePhone = (value: string): string => value.replace(/\s/g, "");

interface CreateUserFormValues {
  role: UserRole;
  fullName: string;
  phone: string;
  username: string;
  password: string;
  salary: string;
  paymentDay: string;
  region: string;
  branchId: string;
  homeRate: string;
  centerRate: string;
  deliveryType: "address" | "center" | "";
}

const INITIAL_FORM: CreateUserFormValues = {
  role: "admin",
  fullName: "",
  phone: "",
  username: "",
  password: "",
  salary: "",
  paymentDay: "",
  region: "",
  branchId: "",
  homeRate: "",
  centerRate: "",
  deliveryType: "",
};

const inputClasses = (hasError: boolean, hasPrefix: boolean) => `
  w-full bg-slate-50 dark:bg-[#1a1f3a] border
  ${
    hasError
      ? "border-red-400 dark:border-red-500 focus:ring-red-400/20"
      : "border-slate-200 dark:border-[#4c5798]/20 focus:border-main dark:focus:border-main focus:ring-main/10"
  }
  rounded-xl ${hasPrefix ? "pl-10" : "px-4"} pr-4 py-3
  text-slate-800 dark:text-white text-sm font-medium
  placeholder:text-slate-400 dark:placeholder:text-white/30
  focus:outline-none focus:ring-2 transition-all duration-200 shadow-sm
`;

const labelClasses =
  "block text-xs font-bold text-slate-500 dark:text-white/60 mb-1.5 ml-1 uppercase tracking-wide";

const FieldError = ({ message }: { message?: string }) => {
  if (!message) return null;
  return (
    <p className="absolute -bottom-4 right-0 text-[10px] text-red-500 font-medium">
      {message}
    </p>
  );
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
  region: "region",
  region_id: "region",
  regionId: "region",
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
};

export const CreateUserForm = memo(() => {
  const { t } = useTranslation("users");
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [isCompactRolePicker, setIsCompactRolePicker] = useState(
    typeof window !== "undefined" ? window.innerWidth < 1280 : false,
  );
  const [isCompactRolePickerOpen, setIsCompactRolePickerOpen] = useState(false);
  const getRoleLabel = (userRole: UserRole) => t(getUserRoleLabelKey(userRole));

  const methods = useForm<CreateUserFormValues>({
    defaultValues: INITIAL_FORM,
    mode: "onTouched",
  });

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    setError,
    clearErrors,
  } = methods;

  const role = useWatch({ control, name: "role" });
  const rolePickerOptions: Array<{ key: UserRole; icon: ReactNode }> = [
    { key: "admin", icon: <Shield size={16} /> },
    { key: "manager", icon: <Briefcase size={16} /> },
    { key: "registrator", icon: <Users size={16} /> },
    { key: "courier", icon: <Truck size={16} /> },
    { key: "marketing", icon: <Store size={16} /> },
  ];
  const activeRoleOption =
    rolePickerOptions.find((option) => option.key === role) ?? rolePickerOptions[0];

  const { createAdmin, createManager, createRegistrator, createMarket, createCourier, getRegions } = useUser();
  const { apiRequest } = useAppNotification();
  const { data: branchesResponse, isLoading: isBranchesLoading } = useBranches({
    page: 1,
    limit: 200,
    status: "active",
  });

  const { data: regionsData } = getRegions();
  const regionList: { id: string; name: string }[] = (() => {
    const data = regionsData;
    if (Array.isArray(data)) return data;
    if (data?.data?.items && Array.isArray(data.data.items)) return data.data.items;
    if (data?.data && Array.isArray(data.data)) return data.data;
    if (data?.items && Array.isArray(data.items)) return data.items;
    return [];
  })();
  const branchOptions = (branchesResponse?.data ?? []).map((branch) => ({
    value: branch.id,
    label: branch.name,
  }));

  useEffect(() => {
    reset({ ...INITIAL_FORM, role });
  }, [role, reset]);

  useEffect(() => {
    const handleResize = () => {
      const compact = window.innerWidth < 1280;
      setIsCompactRolePicker(compact);
      if (!compact) {
        setIsCompactRolePickerOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isPending =
    createAdmin.isPending ||
    createManager.isPending ||
    createRegistrator.isPending ||
    createMarket.isPending ||
    createCourier.isPending;

  const validateByRole = (values: CreateUserFormValues): boolean => {
    let valid = true;
    const rawPhone = parsePhone(values.phone);

    if (!values.fullName.trim()) {
      setError("fullName", { message: t("firstNameRequired") });
      valid = false;
    }

    if (!rawPhone || rawPhone.length !== 9) {
      setError("phone", { message: t("phoneValidation") });
      valid = false;
    }

    if (!values.password.trim()) {
      setError("password", { message: t("passwordRequired") });
      valid = false;
    } else if (values.password.length < 4) {
      setError("password", { message: t("passwordMin") });
      valid = false;
    }

    if (role === "admin" || role === "registrator" || role === "manager") {
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

    if ((role === "manager" || role === "registrator") && !values.branchId) {
      setError("branchId", { message: t("branchRequired") });
      valid = false;
    }

    if (role === "courier") {
      if (!values.branchId) {
        setError("branchId", { message: t("branchRequired") });
        valid = false;
      }
      if (!values.region) {
        setError("region", { message: t("regionRequired") });
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
    }

    if (role === "marketing") {
      if (!values.username.trim()) {
        setError("username", { message: t("usernameRequired") });
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

  const onSubmit = async (values: CreateUserFormValues) => {
    clearErrors();
    if (!validateByRole(values)) return;

    const rawPhone = `+998${parsePhone(values.phone)}`;

    if (role === "admin") {
      const payload: CreateAdminRequest = {
        name: values.fullName,
        phone_number: rawPhone,
        password: values.password,
        salary: parseAmount(values.salary),
        payment_day: Number(values.paymentDay),
      };
      await apiRequest({
        request: () => createAdmin.mutateAsync(payload),
        successMessage: t("createAdmin"),
        errorMessage: t("loadError"),
        onError: (error) => applyBackendFieldErrors(error, setError, SERVER_FIELD_NAME_MAP),
        onSuccess: () => navigate(-1),
      });
      return;
    }

    if (role === "registrator") {
      const payload: CreateRegistratorRequest = {
        name: values.fullName,
        phone_number: rawPhone,
        password: values.password,
        salary: parseAmount(values.salary),
        payment_day: Number(values.paymentDay),
        branch_id: values.branchId,
      };
      await apiRequest({
        request: () => createRegistrator.mutateAsync(payload),
        successMessage: t("createRegistrator"),
        errorMessage: t("loadError"),
        onError: (error) => applyBackendFieldErrors(error, setError, SERVER_FIELD_NAME_MAP),
        onSuccess: () => navigate(-1),
      });
      return;
    }

    if (role === "manager") {
      const payload: CreateManagerRequest = {
        name: values.fullName,
        phone_number: rawPhone,
        password: values.password,
        salary: parseAmount(values.salary),
        branch_id: values.branchId,
      };

      await apiRequest({
        request: () => createManager.mutateAsync(payload),
        successMessage: t("createManager"),
        errorMessage: t("loadError"),
        onError: (error) => applyBackendFieldErrors(error, setError, SERVER_FIELD_NAME_MAP),
        onSuccess: () => navigate(-1),
      });
      return;
    }

    if (role === "courier") {
      const payload: CreateCourierRequest = {
        region_id: values.region,
        branch_id: values.branchId,
        name: values.fullName,
        phone_number: rawPhone,
        password: values.password,
        tariff_home: parseAmount(values.homeRate),
        tariff_center: parseAmount(values.centerRate),
      };

      await apiRequest({
        request: () => createCourier.mutateAsync(payload),
        successMessage: t("createCourier"),
        errorMessage: t("loadError"),
        onError: (error) => applyBackendFieldErrors(error, setError, SERVER_FIELD_NAME_MAP),
        onSuccess: () => navigate(-1),
      });
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

      await apiRequest({
        request: () => createMarket.mutateAsync(payload),
        successMessage: t("createMarket"),
        errorMessage: t("loadError"),
        onError: (error) => applyBackendFieldErrors(error, setError, SERVER_FIELD_NAME_MAP),
        onSuccess: () => navigate(-1),
      });
    }
  };

  const renderInput = ({
    label,
    name,
    type = "text",
    placeholder,
    icon,
    required = true,
  }: {
    label: string;
    name: keyof CreateUserFormValues;
    type?: string;
    placeholder: string;
    icon?: ReactNode;
    required?: boolean;
  }) => (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <div className="space-y-0 relative">
          <label className={labelClasses}>
            {label} {required && <span className="text-red-500">*</span>}
          </label>
          <div className="relative group">
            {icon && (
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40 group-focus-within:text-main transition-colors">
                {icon}
              </div>
            )}
            {name === "phone" && (
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-white/50 font-medium z-10 text-sm select-none">
                +998
              </div>
            )}
            <input
              type={type}
              name={field.name}
              value={field.value}
              onBlur={field.onBlur}
              onChange={(event) => {
                const { value } = event.target;

                if (name === "salary" || name === "homeRate" || name === "centerRate") {
                  field.onChange(formatAmount(value));
                  return;
                }

                if (name === "phone") {
                  field.onChange(formatPhone(value));
                  return;
                }

                if (name === "paymentDay") {
                  const numericValue = parseInt(value, 10);
                  if (value === "" || (numericValue >= 1 && numericValue <= 30)) {
                    field.onChange(value);
                  }
                  return;
                }

                field.onChange(value);
              }}
              placeholder={placeholder}
              className={inputClasses(
                !!fieldState.error,
                !!icon || name === "phone",
              )}
              style={name === "phone" ? { paddingLeft: "3.5rem" } : undefined}
            />
          </div>
          <FieldError message={fieldState.error?.message} />
        </div>
      )}
    />
  );

  const renderPasswordInput = () => (
    <Controller
      control={control}
      name="password"
      render={({ field, fieldState }) => (
        <div className="space-y-0 relative">
          <label className={labelClasses}>
            {t("passwordPlaceholder")} <span className="text-red-500">*</span>
          </label>
          <div className="relative group">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40 group-focus-within:text-main transition-colors">
              <Shield size={18} />
            </div>
            <input
              type={showPassword ? "text" : "password"}
              name={field.name}
              value={field.value}
              onBlur={field.onBlur}
              onChange={field.onChange}
              placeholder="••••••"
              className={inputClasses(!!fieldState.error, true)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-white/40 dark:hover:text-white transition-colors p-1"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <FieldError message={fieldState.error?.message} />
        </div>
      )}
    />
  );

  return (
    <div className="flex w-full min-h-full flex-col overflow-hidden rounded-2xl transition-colors duration-300">
      <div className="shrink-0 border-b border-slate-100 px-3 py-3 dark:border-white/5 sm:px-4 md:px-6">
        <div className="text-right">
          <h2 className="text-base font-bold text-slate-800 dark:text-white sm:text-lg">
            {t("createNewUser")}{" "}
            {getRoleLabel(role)}
          </h2>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-visible px-3 py-3 sm:px-4 sm:py-4 lg:flex-row lg:items-start lg:gap-6 lg:overflow-hidden lg:px-6 lg:py-6">
        <div className="w-full shrink-0 lg:w-72">
          <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm dark:border-primarydark/20 dark:bg-maindark sm:p-4">
            <h3 className="text-xs font-bold text-slate-400 dark:text-white/40 uppercase tracking-wider mb-3 px-1">
              {t("roleSelect")}
            </h3>
            {isCompactRolePicker ? (
              <div>
                <button
                  type="button"
                  onClick={() => setIsCompactRolePickerOpen((prev) => !prev)}
                  className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-main bg-main px-3 py-2.5 text-primary shadow-sm shadow-main/20 dark:text-white"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary dark:bg-white/15 dark:text-white">
                      {activeRoleOption.icon}
                    </span>
                    <span className="truncate text-left text-sm font-semibold">
                      {getRoleLabel(activeRoleOption.key)}
                    </span>
                  </div>
                  <ChevronDown
                    size={16}
                    className={`shrink-0 transition-transform duration-200 ${
                      isCompactRolePickerOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {isCompactRolePickerOpen && (
                  <div className="mt-3 flex flex-col gap-2">
                    {rolePickerOptions
                      .filter((option) => option.key !== role)
                      .map((option) => (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => {
                            setValue("role", option.key);
                            setIsCompactRolePickerOpen(false);
                          }}
                          className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 transition-colors hover:border-main/30 hover:bg-main/5 dark:border-white/10 dark:bg-primarydark dark:text-white/80"
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-main/10 text-main dark:bg-white/15 dark:text-white">
                            {option.icon}
                          </span>
                          <span className="text-left text-sm font-semibold">
                            {getRoleLabel(option.key)}
                          </span>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="max-h-[45vh] overflow-y-auto pr-1 custom-scrollbar lg:max-h-none lg:overflow-visible lg:pr-0">
                <RoleSelector
                  selectedRole={role}
                  onSelect={(nextRole) => setValue("role", nextRole)}
                />
              </div>
            )}
          </div>

          <div className="mt-4 rounded-2xl bg-linear-to-br from-main to-indigo-600 p-4 text-white shadow-lg shadow-main/20 sm:p-5">
            <h3 className="text-base font-bold mb-2">{getRoleLabel(role)}</h3>
            <p className="text-white/80 text-xs leading-relaxed">
              {t("roleMarketCardHint")}
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl shadow-slate-200/50 dark:border-primarydark/20 dark:bg-maindark dark:shadow-black/20">
          <div className="flex shrink-0 items-center gap-3 border-b border-slate-100 bg-slate-50/50 px-3 py-3 dark:border-white/5 dark:bg-main sm:gap-4 sm:px-4 md:px-6">
            <div
              className={`p-2 rounded-xl bg-linear-to-br text-white shadow-md ${
                role === "admin"
                  ? "from-purple-500 to-indigo-600"
                  : role === "manager" || role === "registrator"
                    ? "from-blue-500 to-cyan-500"
                    : role === "courier"
                      ? "from-orange-500 to-amber-500"
                      : "from-emerald-500 to-teal-500"
              }`}
            >
              <ShieldIcon role={role} size={20} />
            </div>
            <h1 className="text-base font-bold text-slate-800 dark:text-white sm:text-lg md:text-xl">
              {t("addRoleTitle", { role: getRoleLabel(role) })}
            </h1>
          </div>

          <div className="overflow-y-auto px-3 py-3 sm:px-4 sm:py-4 md:px-6 md:py-6">
            <form id="create-user-form" onSubmit={handleSubmit(onSubmit)} className="w-full">
              <div className="space-y-8">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 xl:gap-6">
                  {renderInput({
                    label: t("fullNameShort"),
                    name: "fullName",
                    placeholder: t("fullNamePlaceholder"),
                    icon: <User size={18} />,
                  })}
                  {renderInput({
                    label: t("phone"),
                    name: "phone",
                    type: "tel",
                    placeholder: "90 123 45 67",
                  })}
                  {renderPasswordInput()}
                </div>

                <div className="h-px bg-slate-100 dark:bg-white/5" />

                {(role === "admin" || role === "registrator" || role === "manager") && (
                  <div className="grid grid-cols-1 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300 md:grid-cols-2 md:gap-6">
                    {renderInput({
                      label: t("salaryWithCurrency"),
                      name: "salary",
                      placeholder: "Masalan: 5 000 000",
                    })}
                    {(role === "admin" || role === "registrator") &&
                      renderInput({
                        label: t("paymentDay"),
                        name: "paymentDay",
                        type: "number",
                        placeholder: "1-30",
                        icon: <Calendar size={18} />,
                      })}
                  </div>
                )}

                {(role === "manager" || role === "registrator") && (
                  <div className="grid grid-cols-1 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300 md:grid-cols-2 md:gap-6">
                    <Controller
                      control={control}
                      name="branchId"
                      render={({ field, fieldState }) => (
                        <Select
                          label={t("branchLabel")}
                          name={field.name}
                          value={field.value}
                          onChange={(event) => field.onChange(event.target.value)}
                          options={branchOptions}
                          placeholder={branchOptions.length ? t("branchPlaceholder") : t("loading")}
                          error={fieldState.error?.message}
                          loading={isBranchesLoading}
                          required
                        />
                      )}
                    />
                  </div>
                )}

                {role === "courier" && (
                  <div className="grid grid-cols-1 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300 md:grid-cols-2 xl:grid-cols-3 md:gap-6">
                    <Controller
                      control={control}
                      name="branchId"
                      render={({ field, fieldState }) => (
                        <Select
                          label={t("branchLabel")}
                          name={field.name}
                          value={field.value}
                          onChange={(event) => field.onChange(event.target.value)}
                          options={branchOptions}
                          placeholder={branchOptions.length ? t("branchPlaceholder") : t("loading")}
                          error={fieldState.error?.message}
                          loading={isBranchesLoading}
                          required
                        />
                      )}
                    />
                    <Controller
                      control={control}
                      name="region"
                      render={({ field, fieldState }) => (
                        <Select
                          label={t("regionLabel")}
                          name={field.name}
                          value={field.value}
                          onChange={(event) => field.onChange(event.target.value)}
                          options={regionList.map((region) => ({
                            value: String(region.id),
                            label: region.name,
                          }))}
                          placeholder={regionList.length ? t("regionPlaceholder") : t("loading")}
                          error={fieldState.error?.message}
                          required
                        />
                      )}
                    />
                    {renderInput({
                      label: t("homeTariffWithCurrency"),
                      name: "homeRate",
                      placeholder: "Masalan: 10 000",
                      icon: <Building size={18} />,
                    })}
                    {renderInput({
                      label: t("centerTariffWithCurrency"),
                      name: "centerRate",
                      placeholder: "Masalan: 8 000",
                      icon: <Store size={18} />,
                    })}
                  </div>
                )}

                {role === "marketing" && (
                  <div className="grid grid-cols-1 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300 md:grid-cols-2 md:gap-6">
                    {renderInput({
                      label: "Username",
                      name: "username",
                      placeholder: "market_01",
                      icon: <User size={18} />,
                    })}
                    <Controller
                      control={control}
                      name="deliveryType"
                      render={({ field, fieldState }) => (
                        <Select
                          label={t("mainTariff")}
                          name={field.name}
                          value={field.value}
                          onChange={(event) => field.onChange(event.target.value)}
                          options={[
                            { value: "center", label: t("centerOnlyTariff") },
                            { value: "address", label: t("doorTariff") },
                          ]}
                          placeholder={t("defaultTariffPlaceholder")}
                          error={fieldState.error?.message}
                          required
                        />
                      )}
                    />
                    {renderInput({
                      label: t("homeTariffWithCurrency"),
                      name: "homeRate",
                      placeholder: "Masalan: 10 000",
                      icon: <Building size={18} />,
                    })}
                    {renderInput({
                      label: t("centerTariffWithCurrency"),
                      name: "centerRate",
                      placeholder: "Masalan: 8 000",
                      icon: <Store size={18} />,
                    })}
                  </div>
                )}
              </div>

              <div className="mt-8 flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 dark:border-white/5 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="w-full rounded-xl px-6 py-2.5 text-sm font-semibold text-slate-500 transition-all hover:bg-slate-100 dark:text-white/60 dark:hover:bg-white/5 sm:w-auto"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  form="create-user-form"
                  disabled={isPending}
                  className={`relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-8 py-2.5 text-sm font-bold text-white shadow-lg shadow-main/20 transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:transform-none disabled:opacity-70 sm:w-auto ${
                    role === "admin"
                      ? "bg-linear-to-r from-purple-600 to-indigo-600"
                      : role === "manager" || role === "registrator"
                        ? "bg-linear-to-r from-blue-500 to-cyan-500"
                        : role === "courier"
                          ? "bg-linear-to-r from-orange-500 to-amber-500"
                          : "bg-linear-to-r from-emerald-500 to-teal-500"
                  }`}
                >
                  {isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>{t("saving")}</span>
                    </>
                  ) : (
                    <>
                      <span>{t("save")}</span>
                      <Send size={16} strokeWidth={2.5} />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
});

const ShieldIcon = ({
  role,
  size = 20,
}: {
  role: UserRole;
  size?: number;
}) => {
  switch (role) {
    case "admin":
      return <Shield size={size} />;
    case "manager":
    case "registrator":
      return <Calendar size={size} />;
    case "courier":
      return <Store size={size} />;
    default:
      return <Building size={size} />;
  }
};
