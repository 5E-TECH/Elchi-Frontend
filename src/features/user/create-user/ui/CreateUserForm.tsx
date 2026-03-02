import React, { memo, useState, useEffect } from "react";
import type {
  UserRole,
  CreateAdminRequest,
  CreateCourierRequest,
  CreateMarketRequest,
} from "../../../../entities/user/types/user";

import { RoleSelector } from "./RoleSelector";
import Select from "../../../../shared/ui/Select";
import { useUser } from "../../../../entities/user/api/userApi";
import { useAppNotification } from "../../../../app/providers/notification/NotificationProvider";
import {
  Eye,
  EyeOff,
  Send,
  Shield,
  Users,
  Truck,
  Store,
  Building,
  Calendar,
  User,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

// ─── Constants ────────────────────────────────────────────────────────────────

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

// ─── Formatters ───────────────────────────────────────────────────────────────

/** Summani formatlaydi: 10000 → "10 000" */
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

/** Formatlangan summadan sof raqam oladi: "10 000" → 10000 */
const parseAmount = (value: string): number =>
  Number(value.replace(/\s/g, ""));

/** Telefon raqamni formatlaydi: "901234567" → "90 123 45 67" */
const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 9);
  const parts: string[] = [];
  if (digits.length > 0) parts.push(digits.slice(0, 2));
  if (digits.length > 2) parts.push(digits.slice(2, 5));
  if (digits.length > 5) parts.push(digits.slice(5, 7));
  if (digits.length > 7) parts.push(digits.slice(7, 9));
  return parts.join(" ");
};

/** Formatlangan telefondan sof raqam oladi: "90 123 45 67" → "901234567" */
const parsePhone = (value: string): string => value.replace(/\s/g, "");

// ─── Initial State ────────────────────────────────────────────────────────────

const INITIAL_FORM = {
  fullName: "",
  phone: "",
  username: "",
  password: "",
  salary: "",
  paymentDay: "",
  region: "",
  homeRate: "",
  centerRate: "",
  marketName: "",
  deliveryType: "" as "address" | "center" | "",
};

// ─── Component ────────────────────────────────────────────────────────────────

export const CreateUserForm = memo(() => {
  const navigate = useNavigate();
  const [role, setRole] = useState<UserRole>("admin");
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { createAdmin, createMarket, createCourier, getRegions } = useUser();
  const { apiRequest } = useAppNotification();

  // Viloyatlar API dan olinadi
  const { data: regionsData } = getRegions();
  const regionList: { id: string; name: string }[] = (() => {
    const d = regionsData;
    if (Array.isArray(d)) return d;
    if (d?.data?.items && Array.isArray(d.data.items)) return d.data.items;
    if (d?.data && Array.isArray(d.data)) return d.data;
    if (d?.items && Array.isArray(d.items)) return d.items;
    return [];
  })();

  // Role o'zgarganda xatolar va forma tozalansin
  useEffect(() => {
    setErrors({});
    setFormData(INITIAL_FORM);
  }, [role]);

  // ─── Input Handler ─────────────────────────────────────────────────────────

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;

    if (name === "salary" || name === "homeRate" || name === "centerRate") {
      setFormData((prev) => ({ ...prev, [name]: formatAmount(value) }));
    } else if (name === "phone") {
      setFormData((prev) => ({ ...prev, [name]: formatPhone(value) }));
    } else if (name === "paymentDay") {
      const num = parseInt(value);
      if (value === "" || (num >= 1 && num <= 30)) {
        setFormData((prev) => ({ ...prev, [name]: value }));
      }
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  // ─── Validation ────────────────────────────────────────────────────────────

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    const rawPhone = parsePhone(formData.phone);

    if (!formData.fullName.trim()) newErrors.fullName = "Ism talab qilinadi";
    if (!rawPhone || rawPhone.length !== 9)
      newErrors.phone = "9 ta raqam kiriting";
    if (!formData.password.trim()) newErrors.password = "Parol talab qilinadi";
    else if (formData.password.length < 4) newErrors.password = "Min 4 ta belgi";

    if (role === "admin" || role === "manager") {
      if (!formData.salary) newErrors.salary = "Maosh kiritilmadi";
      if (!formData.paymentDay) newErrors.paymentDay = "Sana kiritilmadi";
      else {
        const day = Number(formData.paymentDay);
        if (day < 1 || day > 30) newErrors.paymentDay = "1-30 oralig'ida";
      }
    }

    if (role === "courier") {
      if (!formData.region) newErrors.region = "Viloyat tanlang";
      if (!formData.homeRate) newErrors.homeRate = "Uy tarifi yo'q";
      if (!formData.centerRate) newErrors.centerRate = "Markaz tarifi yo'q";
    }

    if (role === "marketing") {
      if (!formData.username.trim()) newErrors.username = "Username kiritilmadi";
      if (!formData.homeRate) newErrors.homeRate = "Uy tarifi yo'q";
      if (!formData.centerRate) newErrors.centerRate = "Markaz tarifi yo'q";
      if (!formData.deliveryType) newErrors.deliveryType = "Tur tanlang";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ─── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const rawPhone = `+998${parsePhone(formData.phone)}`;

    // ── Admin ──
    if (role === "admin") {
      const payload: CreateAdminRequest = {
        name: formData.fullName,
        phone_number: rawPhone,
        password: formData.password,
        salary: parseAmount(formData.salary),
        payment_day: Number(formData.paymentDay),
      };

      await apiRequest({
        request: () => createAdmin.mutateAsync(payload),
        successMessage: `Admin "${formData.fullName}" muvaffaqiyatli yaratildi!`,
        errorMessage: "Admin yaratishda xatolik yuz berdi",
        onSuccess: () => navigate(-1),
      });
      return;
    }

    // ── Courier ──
    if (role === "courier") {
      const payload: CreateCourierRequest = {
        region_id: formData.region,
        name: formData.fullName,
        phone_number: rawPhone,
        password: formData.password,
        tariff_home: parseAmount(formData.homeRate),
        tariff_center: parseAmount(formData.centerRate),
      };

      await apiRequest({
        request: () => createCourier.mutateAsync(payload),
        successMessage: `Kuryer "${formData.fullName}" muvaffaqiyatli yaratildi!`,
        errorMessage: "Kuryer yaratishda xatolik yuz berdi",
        onSuccess: () => navigate(-1),
      });
      return;
    }

    // ── Market ──
    if (role === "marketing") {
      // deliveryType dan aniq mapping — type cast emas, aniq qiymat
      const defaultTariff = formData.deliveryType === "center" ? "center" : "address";

      const payload: CreateMarketRequest = {
        name: formData.fullName,
        phone_number: rawPhone,
        username: formData.username,
        password: formData.password,
        tariff_home: parseAmount(formData.homeRate),
        tariff_center: parseAmount(formData.centerRate),
        default_tariff: defaultTariff,
      };

      await apiRequest({
        request: () => createMarket.mutateAsync(payload),
        successMessage: `Market "${formData.fullName}" muvaffaqiyatli yaratildi!`,
        errorMessage: "Market yaratishda xatolik yuz berdi",
        onSuccess: () => navigate(-1),
      });
      return;
    }

    // ── Boshqa rollar ──
    console.log("Role:", ROLE_LABELS[role], "| FormData:", formData);
  };

  // ─── Helpers (UI) ──────────────────────────────────────────────────────────

  const inputClasses = (hasError: boolean, hasPrefix: boolean) => `
    w-full bg-slate-50 dark:bg-[#1a1f3a] border 
    ${hasError
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

  const renderInput = (
    label: string,
    name: string,
    type: string = "text",
    placeholder: string,
    Icon?: React.ElementType | null,
    required: boolean = true,
  ) => (
    <div className="space-y-0 relative">
      <label className={labelClasses}>
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative group">
        {Icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40 group-focus-within:text-main transition-colors">
            <Icon size={18} />
          </div>
        )}
        {name === "phone" && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-white/50 font-medium z-10 text-sm select-none">
            +998
          </div>
        )}
        <input
          type={type}
          name={name}
          value={(formData as Record<string, string>)[name]}
          onChange={handleInputChange}
          placeholder={placeholder}
          required={required}
          className={inputClasses(!!errors[name], !!Icon || name === "phone")}
          style={name === "phone" ? { paddingLeft: "3.5rem" } : {}}
        />
      </div>
      {errors[name] && (
        <p className="absolute -bottom-4 right-0 text-[10px] text-red-500 font-medium">
          {errors[name]}
        </p>
      )}
    </div>
  );

  const renderPasswordInput = () => (
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
          name="password"
          value={formData.password}
          onChange={handleInputChange}
          placeholder="••••••"
          required
          className={inputClasses(!!errors.password, true)}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-white/40 dark:hover:text-white transition-colors p-1"
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {errors.password && (
        <p className="absolute -bottom-4 right-0 text-[10px] text-red-500 font-medium">
          {errors.password}
        </p>
      )}
    </div>
  );

  const isPending = createAdmin.isPending || createMarket.isPending || createCourier.isPending;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="w-full h-full  rounded-2xl flex flex-col overflow-hidden transition-colors duration-300">
      {/* Header */}
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

      {/* Main Container */}
      <div className="flex flex-1 gap-6 overflow-hidden px-6 py-6">
        {/* Sidebar — Role Selection */}
        <div className="w-72 flex flex-col gap-4 shrink-0">
          <div className="bg-white dark:bg-maindark p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-primarydark/20">
            <h3 className="text-xs font-bold text-slate-400 dark:text-white/40 uppercase tracking-wider mb-3 px-1">
              Rol Tanlash
            </h3>
            <RoleSelector selectedRole={role} onSelect={setRole} />
          </div>

          <div className="bg-linear-to-br from-main to-indigo-600 rounded-2xl p-5 text-white shadow-lg shadow-main/20">
            <h3 className="text-base font-bold mb-2">{ROLE_LABELS[role]}</h3>
            <p className="text-white/80 text-xs leading-relaxed">
              Yangi foydalanuvchi tizimga kiritilgach, unga SMS orqali login va
              parol yuboriladi.
            </p>
          </div>
        </div>

        {/* Form Area */}
        <div className="flex-1 bg-white dark:bg-maindark rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-black/20 border border-slate-100 dark:border-primarydark/20 flex flex-col overflow-hidden">
          {/* Form Header */}
          <div className="px-6 py-4 border-b border-slate-100  dark:border-white/5 bg-slate-50/50 dark:bg-main shrink-0 flex items-center gap-4">
            <div
              className={`p-2 rounded-xl bg-linear-to-br text-white shadow-md ${role === "admin"
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

          {/* Form Content — Scrollable */}
          <div className="flex-1 px-6 py-6 overflow-y-auto">
            <form onSubmit={handleSubmit} className="w-full">
              <div className="space-y-8">

                {/* ── Umumiy ma'lumotlar ── */}
                <div className="grid grid-cols-3 gap-6">
                  {renderInput("Ism Familya", "fullName", "text", "F.I.O", User)}
                  {renderInput("Telefon", "phone", "tel", "90 123 45 67")}
                  {renderPasswordInput()}
                </div>

                <div className="h-px bg-slate-100 dark:bg-white/5" />

                {/* ── Admin / Manager ── */}
                {(role === "admin" || role === "manager") && (
                  <div className="grid grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {renderInput("Maosh (so'm)", "salary", "text", "Masalan: 5 000 000", null)}
                    {renderInput("To'lov Kuni", "paymentDay", "number", "1–30", Calendar)}
                  </div>
                )}

                {/* ── Courier ── */}
                {role === "courier" && (
                  <div className="grid grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <Select
                      label="Viloyat"
                      name="region"
                      value={formData.region}
                      onChange={handleInputChange}
                      options={regionList.map((r) => ({
                        value: String(r.id),
                        label: r.name,
                      }))}
                      placeholder={regionList.length ? "Tanlang" : "Yuklanmoqda..."}
                      error={errors.region}
                      required
                    />
                    {renderInput("Uyga (so'm)", "homeRate", "text", "Masalan: 10 000", Building)}
                    {renderInput("Markazga (so'm)", "centerRate", "text", "Masalan: 8 000", Store)}
                  </div>
                )}

                {/* ── Market (marketing) ── */}
                {role === "marketing" && (
                  <div className="grid grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {renderInput("Username", "username", "text", "market_01", User)}
                    <Select
                      label="Asosiy Tarif"
                      name="deliveryType"
                      value={formData.deliveryType}
                      onChange={handleInputChange}
                      options={[
                        { value: "center", label: "Markazgacha" },
                        { value: "address", label: "Eshikkacha" },
                      ]}
                      placeholder="Tanlang"
                      error={errors.deliveryType}
                      required
                    />
                    {renderInput("Uyga Tarif (so'm)", "homeRate", "text", "Masalan: 10 000", Building)}
                    {renderInput("Markazga Tarif (so'm)", "centerRate", "text", "Masalan: 8 000", Store)}
                  </div>
                )}

              </div>
            </form>
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-end gap-4 bg-slate-50/50 dark:bg-white/5 shrink-0">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-6 py-2.5 rounded-xl font-semibold text-slate-500 dark:text-white/60 hover:bg-slate-100 dark:hover:bg-white/5 transition-all text-sm"
            >
              Bekor qilish
            </button>
            <button
              onClick={handleSubmit}
              disabled={isPending}
              className={`relative overflow-hidden flex items-center gap-2 px-8 py-2.5 rounded-xl font-bold text-white shadow-lg shadow-main/20 transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none text-sm ${role === "admin"
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

// ─── Role Icon ─────────────────────────────────────────────────────────────────

const ShieldIcon = ({
  role,
  size = 24,
  className,
}: {
  role: string;
  size?: number;
  className?: string;
}) => {
  switch (role) {
    case "admin":
      return <Shield size={size} className={className} />;
    case "manager":
      return <Users size={size} className={className} />;
    case "courier":
      return <Truck size={size} className={className} />;
    case "marketing":
      return <Store size={size} className={className} />;
    default:
      return <Shield size={size} className={className} />;
  }
};

CreateUserForm.displayName = "CreateUserForm";
