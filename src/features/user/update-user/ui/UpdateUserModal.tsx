// dizayn-v2: superadmin-users-edit-dialog, admin-users-edit-dialog, manager-users-edit-dialog
import { memo, useEffect, useState, type ReactNode } from "react";
import { Controller, useForm, type Path } from "react-hook-form";
import { useSelector } from "react-redux";
import { Eye, EyeOff, Pencil, UserX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useUser } from "../../../../entities/user/api/userApi";
import type { UpdateUserRequest, User as UserType } from "../../../../entities/user/types/user";
import { unwrapUserResponse } from "../../../../entities/user/lib/normalizeUser";
import { getUserRoleLabelKey } from "../../../../entities/user/lib/role";
import type { RootState } from "../../../../app/config/store";
import { useLogout } from "../../../../shared/lib/useLogout";
import { rememberLoginNotice } from "../../../../auth/loginNotice";
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

/** Bo'lim sarlavhasi (`.el-overline`) va maydonlar to'ri (maket: `repeat(auto-fit, minmax(260px, 1fr))`). */
const FormSection = ({ title, compact = false, children }: { title: string; compact?: boolean; children: ReactNode }) => (
  <section className="flex flex-col gap-4 border-t border-border pt-5 first:border-t-0 first:pt-0">
    <h3 className="m-0 text-xs font-semibold uppercase tracking-[.05em] text-text-muted">{title}</h3>
    <div
      className={
        compact
          ? "grid grid-cols-[repeat(auto-fit,minmax(min(170px,100%),1fr))] gap-4"
          : "grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-4"
      }
    >
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
  const { t } = useTranslation(["users", "common"]);
  const authRole = useSelector((state: RootState) => state.role.role);
  const currentUserId = useSelector(
    (state: RootState) => state.user.user?.id ?? state.role.id,
  );
  const { useGetUserById, updateUser, updateMyProfile } = useUser();
  const confirm = useConfirm();
  const { logout } = useLogout();
  const [showPassword, setShowPassword] = useState(false);
  // O'z hisobi: profil sahifasi yoki ro'yxatdan o'zini tahrirlash.
  const isSelf =
    isOwnProfile ||
    Boolean(userId && currentUserId && String(userId) === String(currentUserId));

  const shouldFetchUser = Boolean(userId && !initialUser);
  const { data: rawUser, isLoading: isUserLoading } = useGetUserById(shouldFetchUser ? userId ?? "" : "");

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

  const role = userData?.role ?? "";
  const isAdmin = !isOwnProfile && (role === "admin" || role === "manager" || role === "registrator");
  const isSuperAdmin = role === "superadmin";
  const isCourier = !isOwnProfile && role === "courier";
  const isMarket = !isOwnProfile && (role === "market" || role === "marketing");
  const isCustomer = role === "customer";
  const canEditManagerFinancial =
    !isOwnProfile &&
    role === "manager" &&
    (authRole === "admin" || authRole === "superadmin");

  useEffect(() => {
    if (!userData) return;

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
      region_id: "",
    });
  }, [reset, userData]);

  // Oyna yopilganda parol yana yashirin.
  useEffect(() => {
    if (!userId) setShowPassword(false);
  }, [userId]);

  const validateForm = (values: UpdateUserFormValues): boolean => {
    let valid = true;
    clearErrors();

    if (!values.name.trim()) {
      setError("name", { message: t("nameRequired") });
      valid = false;
    }

    if (getUzbekistanPhoneDigits(values.phone).length !== 9) {
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

    if (canEditManagerFinancial) {
      const hasHomeTariff = Boolean(values.tariff_home.trim());
      const hasCenterTariff = Boolean(values.tariff_center.trim());
      if (hasHomeTariff !== hasCenterTariff) {
        if (!hasHomeTariff) {
          setError("tariff_home", { message: t("homeTariffRequired") });
        }
        if (!hasCenterTariff) {
          setError("tariff_center", { message: t("centerTariffRequired") });
        }
        valid = false;
      }
    }

    // Market tariflari majburiy (maket: «*»): bo'sh qoldirilsa avval ham yuborilmasdi — endi sababi aytiladi.
    if (isMarket) {
      if (!values.tariff_home.trim()) {
        setError("tariff_home", { message: t("homeTariffRequired") });
        valid = false;
      }
      if (!values.tariff_center.trim()) {
        setError("tariff_center", { message: t("centerTariffRequired") });
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

    if (Object.keys(payload).length === 0) {
      onClose();
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

    // fix3b RBAC-09: parol o'zgarsa backend o'sha hisobning sessiyasini
    // yopadi (saqlangan refresh o'chiriladi) — keyingi refreshda baribir 401
    // bo'lardi. O'z parolini o'zgartirgan foydalanuvchi darhol chiqariladi va
    // login sahifasida sababi ko'rsatiladi.
    const ownPasswordChanged = isSelf && Boolean(payload.password);
    await runUserRequest({
      t,
      request: () =>
        isOwnProfile
          ? updateMyProfile.mutateAsync(payload)
          : updateUser.mutateAsync({ id: userId, data: payload }),
      successMessage: ownPasswordChanged
        ? t("passwordChangedRelogin", { ns: "auth" })
        : t("userUpdatedSuccess", { name: userData.name }),
      errorMessage: t("editUserError"),
      onError: (error) => applyBackendFieldErrors(error, setError, SERVER_FIELD_NAME_MAP),
      onSuccess: () => {
        onClose();
        if (!ownPasswordChanged) return;
        rememberLoginNotice("passwordChanged");
        void logout();
      },
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
            value={field.value}
            onValueChange={field.onChange}
            onBlur={field.onBlur}
            placeholder={name === "salary" ? t("v2.create.fields.salaryPlaceholder") : name === "tariff_home" ? t("v2.create.fields.homeTariffPlaceholder") : t("v2.create.fields.centerTariffPlaceholder")}
          />
        </Field>
      )}
    />
  );

  const isPending = isOwnProfile ? updateMyProfile.isPending : updateUser.isPending;
  const description = userData
    ? t("v2.edit.description", { name: userData.name, role: t(getUserRoleLabelKey(userData.role)) })
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
          <FormSection title={t("mainData")}>
            <Controller
              control={control}
              name="name"
              render={({ field, fieldState }) => (
                <Field label={t("v2.edit.name")} required error={fieldState.error?.message}>
                  <TextInput
                    name={field.name}
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    placeholder={t("v2.create.fields.namePlaceholder")}
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
                    hint={t("v2.edit.newPasswordHint")}
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
            <FormSection title={t("courierTariff")} compact>
              {renderMoneyField("tariff_home", t("v2.edit.homeTariff"))}
              {renderMoneyField("tariff_center", t("v2.edit.centerTariff"))}
              {/*
                fix3 CODE-21: kuryerning "Hudud" maydoni olib tashlandi — identity `updateUser` `region_id` ni
                e'tiborsiz qoldiradi, kuryer hududi filial biriktiruvidan keladi (R3).
              */}
            </FormSection>
          ) : null}

          {isMarket ? (
            <FormSection title={t("marketInfo")} compact>
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
              {renderMoneyField("tariff_home", t("v2.edit.homeTariff"), true)}
              {renderMoneyField("tariff_center", t("v2.edit.centerTariff"), true)}
            </FormSection>
          ) : null}
        </div>
      )}
    </Dialog>
  );
});

UpdateUserModal.displayName = "UpdateUserModal";
