import { memo, useEffect } from "react";
import { Controller, useForm, type Path } from "react-hook-form";
import {
  Building,
  Building2,
  Calendar,
  Home,
  Lock,
  Phone,
  Store,
  User,
} from "lucide-react";
import UpdatePopup from "../../../../shared/components/popupUpdate";
import SearchableSelect from "../../../../shared/ui/SearchableSelect";
import { useUser } from "../../../../entities/user/api/userApi";
import { useAppNotification } from "../../../../app/providers/notification/NotificationProvider";
import { UserRoleBadge } from "../../../../entities/user/ui/UserRoleBadge";
import type { UpdateUserRequest, User as UserType } from "../../../../entities/user/types/user";
import { unwrapUserResponse } from "../../../../entities/user/lib/normalizeUser";
import { applyBackendFieldErrors } from "../../lib/backendFieldErrors";
import { useTranslation } from "react-i18next";
import { formatUzbekistanPhoneLocal, keepPhoneCaretAfterChange } from "../../../../shared/lib/phone";

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

const parsePhone = (value: string): string => value.replace(/\s/g, "");

type RegionOption = {
  id: string | number;
  name: string;
  sato_code?: string | null;
};

const getRegionOptionLabel = (region: RegionOption) => {
  const satoCode = region.sato_code ? ` • ${region.sato_code}` : "";

  return `${region.name}${satoCode}`;
};

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

export const UpdateUserModal = memo(({
  userId,
  onClose,
  initialUser = null,
  isOwnProfile = false,
}: UpdateUserModalProps) => {
  const { t } = useTranslation("users");
  const { getUserById, updateUser, updateMyProfile, getRegions } = useUser();
  const { apiRequest } = useAppNotification();

  const shouldFetchUser = Boolean(userId && !initialUser);
  const { data: rawUser, isLoading: isUserLoading } = getUserById(shouldFetchUser ? userId ?? "" : "");

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

  const userData = initialUser ?? unwrapUserResponse(rawUser) ?? null;
  const isLoading = shouldFetchUser ? isUserLoading : false;

  const { data: regionsData } = getRegions();
  const regionList: RegionOption[] = (() => {
    const data = regionsData as any;
    if (Array.isArray(data)) return data;
    if (data?.data?.items && Array.isArray(data.data.items)) return data.data.items;
    if (data?.data && Array.isArray(data.data)) return data.data;
    if (data?.items && Array.isArray(data.items)) return data.items;
    return [];
  })();

  const role = userData?.role ?? "";
  const isAdmin = !isOwnProfile && (role === "admin" || role === "manager" || role === "registrator");
  const isSuperAdmin = role === "superadmin";
  const isCourier = !isOwnProfile && role === "courier";
  const isMarket = !isOwnProfile && (role === "market" || role === "marketing");
  const isCustomer = role === "customer";

  useEffect(() => {
    if (!userData) return;
    const phone = (userData.phone_number ?? "").replace("+998", "");

    reset({
      name: userData.name ?? "",
      phone: formatUzbekistanPhoneLocal(phone),
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
    if (!isOwnProfile && values.status && values.status !== userData.status) {
      payload.status = values.status as any;
    }

    if (isAdmin) {
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
      request: () =>
        isOwnProfile
          ? updateMyProfile.mutateAsync(payload)
          : updateUser.mutateAsync({ id: userId, data: payload }),
      successMessage: t("userUpdatedSuccess", { name: userData.name }),
      errorMessage: t("editUserError"),
      onError: (error) => applyBackendFieldErrors(error, setError, SERVER_FIELD_NAME_MAP),
      onSuccess: onClose,
    });
  };

  const inputCls = `
    h-13 w-full rounded-2xl border-2 border-white/70 bg-white/85 px-5
    text-[15px] font-semibold text-maindark shadow-[0_10px_28px_rgba(15,23,42,0.08)]
    outline-none transition-all duration-200
    placeholder:text-slate-400
    hover:border-main/45 hover:bg-white
    focus:border-main focus:bg-white focus:ring-4 focus:ring-main/15
    dark:border-white/10 dark:bg-white/7 dark:text-white
    dark:placeholder:text-white/35 dark:hover:border-main/45 dark:hover:bg-white/10
    dark:focus:border-main dark:focus:bg-white/10
  `;

  const labelCls =
    "mb-2 ml-1 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-white/60";

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
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-white/55 font-bold text-[15px] select-none z-10">
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
                  const nextValue = formatUzbekistanPhoneLocal(value);
                  field.onChange(nextValue);
                  keepPhoneCaretAfterChange(event.target, nextValue);
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
              style={prefix ? { paddingLeft: "4.25rem" } : undefined}
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

  const isPending = isOwnProfile ? updateMyProfile.isPending : updateUser.isPending;

  return (
    <UpdatePopup
      isOpen={!!userId}
      onClose={onClose}
      onSave={handleSubmit(onSubmit)}
      title={isLoading ? t("loading") : t("editUserTitle", { name: userData?.name ?? "" })}
      icon={<User size={20} />}
      saveLabel={t("saveChanges")}
      cancelLabel={t("cancel")}
      isLoading={isPending || isLoading}
    >
      {userData && (
        <div className="mb-4">
          <UserRoleBadge role={userData.role} />
        </div>
      )}

          {isLoading ? (
            <div className="grid grid-cols-1 gap-5">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="space-y-1.5">
                  <div className="h-3 w-24 rounded bg-slate-100 dark:bg-white/5 animate-pulse" />
                  <div className="h-11 rounded-xl bg-slate-100 dark:bg-white/5 animate-pulse" />
                </div>
              ))}
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="grid grid-cols-1 gap-y-5">
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

                    {!isOwnProfile && !isSuperAdmin && (
                      <Controller
                        control={control}
                        name="status"
                        render={({ field }) => (
                          <SearchableSelect
                            label={t("status")}
                            name={field.name}
                            value={field.value}
                            onChange={field.onChange}
                            options={[
                              { value: "active", label: t("statusActive") },
                              { value: "inactive", label: t("statusInactive") },
                              { value: "blocked", label: t("statusBlocked") },
                            ]}
                            placeholder={t("statusPlaceholder")}
                            icon={User}
                            surface="search"
                          />
                        )}
                      />
                    )}
                  </>
                )}

                {isAdmin && (
                  <>
                    <div className="col-span-full">
                      <SectionDivider title={t("financialInfo")} />
                    </div>

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

                    <div className="relative col-span-full">
                      <Controller
                        control={control}
                        name="region_id"
                        render={({ field }) => (
                          <SearchableSelect
                            label={t("regionLabel")}
                            name={field.name}
                            value={field.value}
                            onChange={field.onChange}
                            options={regionList.map((region) => ({
                              value: String(region.id),
                              label: getRegionOptionLabel(region),
                            }))}
                            placeholder={regionList.length ? t("regionPlaceholder") : t("loading")}
                            icon={Building}
                            surface="search"
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

                    <Controller
                      control={control}
                      name="default_tariff"
                      render={({ field }) => (
                        <SearchableSelect
                          label={t("mainTariff")}
                          name={field.name}
                          value={field.value}
                          onChange={field.onChange}
                          options={[
                            { value: "center", label: t("centerOnlyTariff") },
                            { value: "address", label: t("doorTariff") },
                          ]}
                          placeholder={t("defaultTariffPlaceholder")}
                          icon={Store}
                          surface="search"
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
    </UpdatePopup>
  );
});

UpdateUserModal.displayName = "UpdateUserModal";
