import { memo, useEffect } from "react";
import { Controller, useForm, type Path } from "react-hook-form";
import {
  AtSign,
  Building,
  Building2,
  Calendar,
  DollarSign,
  Home,
  Lock,
  Phone,
  Save,
  Store,
  User,
  X,
} from "lucide-react";
import Popup from "../../../../shared/ui/Popup";
import Select from "../../../../shared/ui/Select";
import { useUser } from "../../../../entities/user/api/userApi";
import { useAppNotification } from "../../../../app/providers/notification/NotificationProvider";
import { UserRoleBadge } from "../../../../entities/user/ui/UserRoleBadge";
import type { UpdateUserRequest, User as UserType } from "../../../../entities/user/types/user";
import { applyBackendFieldErrors } from "../../lib/backendFieldErrors";
import { useTranslation } from "react-i18next";

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

interface UpdateUserModalProps {
  userId: string | null;
  onClose: () => void;
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
  region_id: string;
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
  region_id: "",
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
  region: "region_id",
  region_id: "region_id",
  tariff_home: "tariff_home",
  tariff_center: "tariff_center",
  default_tariff: "default_tariff",
};

export const UpdateUserModal = memo(({ userId, onClose }: UpdateUserModalProps) => {
  const { t } = useTranslation("users");
  const { getUserById, updateUser, getRegions } = useUser();
  const { apiRequest } = useAppNotification();

  const { data: rawUser, isLoading } = getUserById(userId ?? "");

  const methods = useForm<UpdateUserFormValues>({
    defaultValues: INITIAL_VALUES,
    mode: "onTouched",
  });

  const {
    control,
    handleSubmit,
    reset,
    setError,
    clearErrors,
  } = methods;

  const userData: UserType | null = (() => {
    const data = rawUser as any;
    if (data?.data?.data) return data.data.data;
    if (data?.data) return data.data;
    return data ?? null;
  })();

  const { data: regionsData } = getRegions();
  const regionList: { id: string; name: string }[] = (() => {
    const data = regionsData as any;
    if (Array.isArray(data)) return data;
    if (data?.data?.items && Array.isArray(data.data.items)) return data.data.items;
    if (data?.data && Array.isArray(data.data)) return data.data;
    if (data?.items && Array.isArray(data.items)) return data.items;
    return [];
  })();

  const role = userData?.role ?? "";
  const isAdmin = role === "admin" || role === "manager" || role === "superadmin";
  const isCourier = role === "courier";
  const isMarket = role === "market" || role === "marketing";
  const isCustomer = role === "customer";

  useEffect(() => {
    if (!userData) return;
    const phone = (userData.phone_number ?? "").replace("+998", "");

    reset({
      name: userData.name ?? "",
      phone: formatPhone(phone),
      password: "",
      status: userData.status ?? "",
      username: userData.username ?? "",
      salary: userData.salary != null ? formatAmount(String(userData.salary)) : "",
      payment_day: userData.payment_day != null ? String(userData.payment_day) : "",
      tariff_home:
        userData.tariff_home != null
          ? formatAmount(String(userData.tariff_home))
          : "",
      tariff_center:
        userData.tariff_center != null
          ? formatAmount(String(userData.tariff_center))
          : "",
      default_tariff: userData.default_tariff ?? "",
      region_id: "",
    });
  }, [reset, userData]);

  const validateForm = (values: UpdateUserFormValues): boolean => {
    let valid = true;
    clearErrors();

    if (!values.name.trim()) {
      setError("name", { message: t("nameRequired") });
      valid = false;
    }

    const rawPhone = parsePhone(values.phone);
    if (!rawPhone || rawPhone.length !== 9) {
      setError("phone", { message: t("phoneValidation") });
      valid = false;
    }

    if (isAdmin && values.payment_day) {
      const day = Number(values.payment_day);
      if (day < 1 || day > 30) {
        setError("payment_day", { message: t("paymentDayValidation") });
        valid = false;
      }
    }

    return valid;
  };

  const onSubmit = async (values: UpdateUserFormValues) => {
    if (!userId || !userData || !validateForm(values)) return;

    const payload: UpdateUserRequest = {};

    if (values.name.trim() && values.name !== userData.name) {
      payload.name = values.name.trim();
    }

    const rawPhone = `+998${parsePhone(values.phone)}`;
    if (rawPhone !== userData.phone_number) {
      payload.phone_number = rawPhone;
    }

    if (values.password.trim()) payload.password = values.password.trim();
    if (values.status && values.status !== userData.status) {
      payload.status = values.status as any;
    }

    if (isAdmin) {
      if (values.salary) {
        const amount = parseAmount(values.salary);
        if (amount !== (userData as any).salary) payload.salary = amount;
      }

      if (values.payment_day) {
        const paymentDay = Number(values.payment_day);
        if (paymentDay !== Number((userData as any).payment_day)) {
          payload.payment_day = paymentDay;
        }
      }
    }

    if (isCourier) {
      if (values.tariff_home) {
        const tariffHome = parseAmount(values.tariff_home);
        if (tariffHome !== (userData as any).tariff_home) {
          payload.tariff_home = tariffHome;
        }
      }

      if (values.tariff_center) {
        const tariffCenter = parseAmount(values.tariff_center);
        if (tariffCenter !== (userData as any).tariff_center) {
          payload.tariff_center = tariffCenter;
        }
      }

      if (values.region_id) payload.region_id = values.region_id;
    }

    if (isMarket) {
      if (values.username && values.username !== userData.username) {
        payload.username = values.username;
      }

      if (values.tariff_home) {
        const tariffHome = parseAmount(values.tariff_home);
        if (tariffHome !== (userData as any).tariff_home) {
          payload.tariff_home = tariffHome;
        }
      }

      if (values.tariff_center) {
        const tariffCenter = parseAmount(values.tariff_center);
        if (tariffCenter !== (userData as any).tariff_center) {
          payload.tariff_center = tariffCenter;
        }
      }

      if (
        values.default_tariff &&
        values.default_tariff !== (userData as any).default_tariff
      ) {
        payload.default_tariff = values.default_tariff as "address" | "center";
      }
    }

    if (Object.keys(payload).length === 0) {
      onClose();
      return;
    }

    await apiRequest({
      request: () => updateUser.mutateAsync({ id: userId, data: payload }),
      successMessage: t("userUpdatedSuccess", { name: userData.name }),
      errorMessage: t("editUserError"),
      onError: (error) => applyBackendFieldErrors(error, setError, SERVER_FIELD_NAME_MAP),
      onSuccess: onClose,
    });
  };

  const inputCls = `
    w-full bg-slate-50 dark:bg-[#1a1f3a] border
    border-slate-200 dark:border-[#4c5798]/20
    focus:border-main dark:focus:border-main focus:ring-main/10
    rounded-xl px-4 py-3 text-slate-800 dark:text-white text-sm font-medium
    placeholder:text-slate-400 dark:placeholder:text-white/30
    focus:outline-none focus:ring-2 transition-all duration-200 shadow-sm
  `;

  const labelCls =
    "block text-xs font-bold text-slate-500 dark:text-white/60 mb-1.5 ml-1 uppercase tracking-wide";

  const SectionDivider = ({ title }: { title: string }) => (
    <div className="col-span-full flex items-center gap-3 py-1">
      <div className="h-px flex-1 bg-slate-100 dark:bg-white/10" />
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-white/40 whitespace-nowrap">
        {title}
      </span>
      <div className="h-px flex-1 bg-slate-100 dark:bg-white/10" />
    </div>
  );

  const renderTextInput = ({
    name,
    label,
    placeholder,
    type = "text",
    prefix,
  }: {
    name: keyof UpdateUserFormValues;
    label: React.ReactNode;
    placeholder: string;
    type?: string;
    prefix?: string;
  }) => (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <div className="relative">
          <label className={labelCls}>{label}</label>
          <div className="relative">
            {prefix && (
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-white/50 font-medium text-sm select-none z-10">
                {prefix}
              </span>
            )}
            <input
              name={field.name}
              type={type}
              value={field.value}
              onBlur={field.onBlur}
              onChange={(event) => {
                const { value } = event.target;
                if (["salary", "tariff_home", "tariff_center"].includes(name)) {
                  field.onChange(formatAmount(value));
                  return;
                }

                if (name === "phone") {
                  field.onChange(formatPhone(value));
                  return;
                }

                field.onChange(value);
              }}
              placeholder={placeholder}
              className={`${inputCls} ${
                fieldState.error
                  ? "border-red-400 dark:border-red-500 focus:ring-red-400/20"
                  : ""
              }`}
              style={prefix ? { paddingLeft: "3.5rem" } : undefined}
            />
          </div>
          {fieldState.error?.message && (
            <p className="absolute -bottom-4 right-0 text-[10px] text-red-500 font-medium">
              {fieldState.error.message}
            </p>
          )}
        </div>
      )}
    />
  );

  const isPending = updateUser.isPending;

  return (
    <Popup isShow={!!userId} onClose={onClose}>
      <div
        className="
          bg-white dark:bg-maindark w-[92vw] max-w-2xl rounded-2xl shadow-2xl
          flex flex-col overflow-hidden
          border border-slate-100 dark:border-primarydark/20
          max-h-[90vh]
        "
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-main/10 flex items-center justify-center">
              <User size={17} className="text-main" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-white leading-tight">
                {isLoading ? t("loading") : t("editUserTitle", { name: userData?.name ?? "" })}
              </h2>
              {userData && (
                <div className="mt-1">
                  <UserRoleBadge role={userData.role} />
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="space-y-1.5">
                  <div className="h-3 w-24 rounded bg-slate-100 dark:bg-white/5 animate-pulse" />
                  <div className="h-11 rounded-xl bg-slate-100 dark:bg-white/5 animate-pulse" />
                </div>
              ))}
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                {!isCustomer && (
                  <div className="col-span-full">
                    <SectionDivider title={t("mainData")} />
                  </div>
                )}

                {renderTextInput({
                  name: "name",
                  label: (
                    <>
                      <User size={11} className="inline mr-1 mb-px" />
                      {t("fullNameShort")}
                    </>
                  ),
                  placeholder: t("fullNamePlaceholder"),
                })}

                {renderTextInput({
                  name: "phone",
                  label: (
                    <>
                      <Phone size={11} className="inline mr-1 mb-px" />
                      {t("phone")}
                    </>
                  ),
                  placeholder: "90 123 45 67",
                  prefix: "+998",
                })}

                {!isCustomer && (
                  <>
                    {renderTextInput({
                      name: "password",
                      type: "password",
                      label: (
                        <>
                          <Lock size={11} className="inline mr-1 mb-px" />
                          {t("newPasswordOptional")}
                        </>
                      ),
                      placeholder: "••••••",
                    })}

                    <Controller
                      control={control}
                      name="status"
                      render={({ field }) => (
                        <Select
                          label={t("status")}
                          name={field.name}
                          value={field.value}
                          onChange={(event) => field.onChange(event.target.value)}
                          options={[
                            { value: "active", label: t("statusActive") },
                            { value: "inactive", label: t("statusInactive") },
                            { value: "blocked", label: t("statusBlocked") },
                          ]}
                          placeholder={t("statusPlaceholder")}
                        />
                      )}
                    />
                  </>
                )}

                {isAdmin && (
                  <>
                    <div className="col-span-full">
                      <SectionDivider title={t("financialInfo")} />
                    </div>

                    {renderTextInput({
                      name: "salary",
                      label: (
                        <>
                          <DollarSign size={11} className="inline mr-1 mb-px" />
                          {t("salaryWithCurrency")}
                        </>
                      ),
                      placeholder: "5 000 000",
                    })}

                    {renderTextInput({
                      name: "payment_day",
                      type: "number",
                      label: (
                        <>
                          <Calendar size={11} className="inline mr-1 mb-px" />
                          {t("paymentDayRange")}
                        </>
                      ),
                      placeholder: "1 – 30",
                    })}
                  </>
                )}

                {isCourier && (
                  <>
                    <div className="col-span-full">
                      <SectionDivider title={t("courierTariff")} />
                    </div>

                    {renderTextInput({
                      name: "tariff_home",
                      label: (
                        <>
                          <Home size={11} className="inline mr-1 mb-px" />
                          {t("homeTariffWithCurrency")}
                        </>
                      ),
                      placeholder: "10 000",
                    })}

                    {renderTextInput({
                      name: "tariff_center",
                      label: (
                        <>
                          <Building2 size={11} className="inline mr-1 mb-px" />
                          {t("centerTariffWithCurrency")}
                        </>
                      ),
                      placeholder: "8 000",
                    })}

                    <div className="relative col-span-full sm:col-span-1">
                      <Controller
                        control={control}
                        name="region_id"
                        render={({ field }) => (
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
                          />
                        )}
                      />
                    </div>
                  </>
                )}

                {isMarket && (
                  <>
                    <div className="col-span-full">
                      <SectionDivider title={t("marketInfo")} />
                    </div>

                    {renderTextInput({
                      name: "username",
                      label: (
                        <>
                          <AtSign size={11} className="inline mr-1 mb-px" />
                          Username
                        </>
                      ),
                      placeholder: "market_01",
                    })}

                    <Controller
                      control={control}
                      name="default_tariff"
                      render={({ field }) => (
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
                        />
                      )}
                    />

                    {renderTextInput({
                      name: "tariff_home",
                      label: (
                        <>
                          <Building size={11} className="inline mr-1 mb-px" />
                          {t("homeTariffWithCurrency")}
                        </>
                      ),
                      placeholder: "10 000",
                    })}

                    {renderTextInput({
                      name: "tariff_center",
                      label: (
                        <>
                          <Store size={11} className="inline mr-1 mb-px" />
                          {t("centerTariffWithCurrency")}
                        </>
                      ),
                      placeholder: "8 000",
                    })}
                  </>
                )}
              </div>
            </form>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-end gap-3 bg-slate-50/50 dark:bg-white/5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl font-semibold text-sm text-slate-500 dark:text-white/60 hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={handleSubmit(onSubmit)}
            disabled={isPending || isLoading}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm text-white bg-main hover:bg-main/90 shadow-md shadow-main/20 transition-all duration-200 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{t("saving")}</span>
              </>
            ) : (
              <>
                <Save size={15} strokeWidth={2.5} />
                <span>{t("saveChanges")}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Popup>
  );
});

UpdateUserModal.displayName = "UpdateUserModal";
