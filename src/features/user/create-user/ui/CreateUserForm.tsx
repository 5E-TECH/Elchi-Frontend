import { memo, useEffect, useState, type ReactNode } from "react";
import { Controller, useForm, useWatch, type Path } from "react-hook-form";
import type {
  CreateAdminRequest,
  CreateCourierRequest,
  CreateMarketRequest,
  UserRole,
} from "../../../../entities/user/types/user";
import { RoleSelector } from "./RoleSelector";
import Select from "../../../../shared/ui/Select";
import { useUser } from "../../../../entities/user/api/userApi";
import { useAppNotification } from "../../../../app/providers/notification/NotificationProvider";
import {
  Building,
  Calendar,
  Eye,
  EyeOff,
  Send,
  Shield,
  Store,
  User,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { applyBackendFieldErrors } from "../../lib/backendFieldErrors";

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  manager: "Ro'yxatchi",
  courier: "Kuryer",
  marketing: "Market",
  operator: "Operator",
  market: "Market",
  superadmin: "Super Admin",
  customer: "Mijoz",
};

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
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

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

  const { createAdmin, createMarket, createCourier, getRegions } = useUser();
  const { apiRequest } = useAppNotification();

  const { data: regionsData } = getRegions();
  const regionList: { id: string; name: string }[] = (() => {
    const data = regionsData;
    if (Array.isArray(data)) return data;
    if (data?.data?.items && Array.isArray(data.data.items)) return data.data.items;
    if (data?.data && Array.isArray(data.data)) return data.data;
    if (data?.items && Array.isArray(data.items)) return data.items;
    return [];
  })();

  useEffect(() => {
    reset({ ...INITIAL_FORM, role });
  }, [role, reset]);

  const isPending =
    createAdmin.isPending || createMarket.isPending || createCourier.isPending;

  const validateByRole = (values: CreateUserFormValues): boolean => {
    let valid = true;
    const rawPhone = parsePhone(values.phone);

    if (!values.fullName.trim()) {
      setError("fullName", { message: "Ism talab qilinadi" });
      valid = false;
    }

    if (!rawPhone || rawPhone.length !== 9) {
      setError("phone", { message: "9 ta raqam kiriting" });
      valid = false;
    }

    if (!values.password.trim()) {
      setError("password", { message: "Parol talab qilinadi" });
      valid = false;
    } else if (values.password.length < 4) {
      setError("password", { message: "Min 4 ta belgi" });
      valid = false;
    }

    if (role === "admin" || role === "manager") {
      if (!values.salary) {
        setError("salary", { message: "Maosh kiritilmadi" });
        valid = false;
      }

      if (!values.paymentDay) {
        setError("paymentDay", { message: "Sana kiritilmadi" });
        valid = false;
      } else {
        const day = Number(values.paymentDay);
        if (day < 1 || day > 30) {
          setError("paymentDay", { message: "1-30 oralig'ida" });
          valid = false;
        }
      }
    }

    if (role === "courier") {
      if (!values.region) {
        setError("region", { message: "Viloyat tanlang" });
        valid = false;
      }
      if (!values.homeRate) {
        setError("homeRate", { message: "Uy tarifi yo'q" });
        valid = false;
      }
      if (!values.centerRate) {
        setError("centerRate", { message: "Markaz tarifi yo'q" });
        valid = false;
      }
    }

    if (role === "marketing") {
      if (!values.username.trim()) {
        setError("username", { message: "Username kiritilmadi" });
        valid = false;
      }
      if (!values.homeRate) {
        setError("homeRate", { message: "Uy tarifi yo'q" });
        valid = false;
      }
      if (!values.centerRate) {
        setError("centerRate", { message: "Markaz tarifi yo'q" });
        valid = false;
      }
      if (!values.deliveryType) {
        setError("deliveryType", { message: "Tur tanlang" });
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
        successMessage: `Admin "${values.fullName}" muvaffaqiyatli yaratildi!`,
        errorMessage: "Admin yaratishda xatolik yuz berdi",
        onError: (error) => applyBackendFieldErrors(error, setError, SERVER_FIELD_NAME_MAP),
        onSuccess: () => navigate(-1),
      });
      return;
    }

    if (role === "courier") {
      const payload: CreateCourierRequest = {
        region_id: values.region,
        name: values.fullName,
        phone_number: rawPhone,
        password: values.password,
        tariff_home: parseAmount(values.homeRate),
        tariff_center: parseAmount(values.centerRate),
      };

      await apiRequest({
        request: () => createCourier.mutateAsync(payload),
        successMessage: `Kuryer "${values.fullName}" muvaffaqiyatli yaratildi!`,
        errorMessage: "Kuryer yaratishda xatolik yuz berdi",
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
        successMessage: `Market "${values.fullName}" muvaffaqiyatli yaratildi!`,
        errorMessage: "Market yaratishda xatolik yuz berdi",
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
            Parol <span className="text-red-500">*</span>
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
    <div className="w-full h-full rounded-2xl flex flex-col overflow-hidden transition-colors duration-300">
      <div className="flex items-center justify-between px-6 py-4 shrink-0 border-b border-slate-100 dark:border-white/5">
        <div className="text-right">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">
            Yangi{" "}
            {role === "manager"
              ? "Ro'yxatchi"
              : role.charAt(0).toUpperCase() + role.slice(1)}
          </h2>
        </div>
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden px-6 py-6">
        <div className="w-72 flex flex-col gap-4 shrink-0">
          <div className="bg-white dark:bg-maindark p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-primarydark/20">
            <h3 className="text-xs font-bold text-slate-400 dark:text-white/40 uppercase tracking-wider mb-3 px-1">
              Rol Tanlash
            </h3>
            <RoleSelector
              selectedRole={role}
              onSelect={(nextRole) => setValue("role", nextRole)}
            />
          </div>

          <div className="bg-linear-to-br from-main to-indigo-600 rounded-2xl p-5 text-white shadow-lg shadow-main/20">
            <h3 className="text-base font-bold mb-2">{ROLE_LABELS[role]}</h3>
            <p className="text-white/80 text-xs leading-relaxed">
              Yangi foydalanuvchi tizimga kiritilgach, unga SMS orqali login va
              parol yuboriladi.
            </p>
          </div>
        </div>

        <div className="flex-1 bg-white dark:bg-maindark rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-black/20 border border-slate-100 dark:border-primarydark/20 flex flex-col overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-main shrink-0 flex items-center gap-4">
            <div
              className={`p-2 rounded-xl bg-linear-to-br text-white shadow-md ${
                role === "admin"
                  ? "from-purple-500 to-indigo-600"
                  : role === "manager"
                    ? "from-blue-500 to-cyan-500"
                    : role === "courier"
                      ? "from-orange-500 to-amber-500"
                      : "from-emerald-500 to-teal-500"
              }`}
            >
              <ShieldIcon role={role} size={20} />
            </div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-white">
              Foydalanuvchi Qo'shish
            </h1>
          </div>

          <div className="flex-1 px-6 py-6 overflow-y-auto">
            <form onSubmit={handleSubmit(onSubmit)} className="w-full">
              <div className="space-y-8">
                <div className="grid grid-cols-3 gap-6">
                  {renderInput({
                    label: "Ism Familya",
                    name: "fullName",
                    placeholder: "F.I.O",
                    icon: <User size={18} />,
                  })}
                  {renderInput({
                    label: "Telefon",
                    name: "phone",
                    type: "tel",
                    placeholder: "90 123 45 67",
                  })}
                  {renderPasswordInput()}
                </div>

                <div className="h-px bg-slate-100 dark:bg-white/5" />

                {(role === "admin" || role === "manager") && (
                  <div className="grid grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {renderInput({
                      label: "Maosh (so'm)",
                      name: "salary",
                      placeholder: "Masalan: 5 000 000",
                    })}
                    {renderInput({
                      label: "To'lov Kuni",
                      name: "paymentDay",
                      type: "number",
                      placeholder: "1–30",
                      icon: <Calendar size={18} />,
                    })}
                  </div>
                )}

                {role === "courier" && (
                  <div className="grid grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <Controller
                      control={control}
                      name="region"
                      render={({ field, fieldState }) => (
                        <Select
                          label="Viloyat"
                          name={field.name}
                          value={field.value}
                          onChange={(event) => field.onChange(event.target.value)}
                          options={regionList.map((region) => ({
                            value: String(region.id),
                            label: region.name,
                          }))}
                          placeholder={regionList.length ? "Tanlang" : "Yuklanmoqda..."}
                          error={fieldState.error?.message}
                          required
                        />
                      )}
                    />
                    {renderInput({
                      label: "Uyga (so'm)",
                      name: "homeRate",
                      placeholder: "Masalan: 10 000",
                      icon: <Building size={18} />,
                    })}
                    {renderInput({
                      label: "Markazga (so'm)",
                      name: "centerRate",
                      placeholder: "Masalan: 8 000",
                      icon: <Store size={18} />,
                    })}
                  </div>
                )}

                {role === "marketing" && (
                  <div className="grid grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
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
                          label="Asosiy Tarif"
                          name={field.name}
                          value={field.value}
                          onChange={(event) => field.onChange(event.target.value)}
                          options={[
                            { value: "center", label: "Markazgacha" },
                            { value: "address", label: "Eshikkacha" },
                          ]}
                          placeholder="Tanlang"
                          error={fieldState.error?.message}
                          required
                        />
                      )}
                    />
                    {renderInput({
                      label: "Uyga Tarif (so'm)",
                      name: "homeRate",
                      placeholder: "Masalan: 10 000",
                      icon: <Building size={18} />,
                    })}
                    {renderInput({
                      label: "Markazga Tarif (so'm)",
                      name: "centerRate",
                      placeholder: "Masalan: 8 000",
                      icon: <Store size={18} />,
                    })}
                  </div>
                )}
              </div>
            </form>
          </div>

          <div className="px-6 py-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-end gap-4 bg-slate-50/50 dark:bg-white/5 shrink-0">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-6 py-2.5 rounded-xl font-semibold text-slate-500 dark:text-white/60 hover:bg-slate-100 dark:hover:bg-white/5 transition-all text-sm"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              onClick={handleSubmit(onSubmit)}
              disabled={isPending}
              className={`relative overflow-hidden flex items-center gap-2 px-8 py-2.5 rounded-xl font-bold text-white shadow-lg shadow-main/20 transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none text-sm ${
                role === "admin"
                  ? "bg-linear-to-r from-purple-600 to-indigo-600"
                  : role === "manager"
                    ? "bg-linear-to-r from-blue-500 to-cyan-500"
                    : role === "courier"
                      ? "bg-linear-to-r from-orange-500 to-amber-500"
                      : "bg-linear-to-r from-emerald-500 to-teal-500"
              }`}
            >
              {isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saqlanmoqda...</span>
                </>
              ) : (
                <>
                  <span>Saqlash</span>
                  <Send size={16} strokeWidth={2.5} />
                </>
              )}
            </button>
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
      return <Calendar size={size} />;
    case "courier":
      return <Store size={size} />;
    default:
      return <Building size={size} />;
  }
};
