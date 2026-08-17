import { memo, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Eye, EyeOff, Loader2, Lock, Phone, Plus, UserRound, UsersRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useUser } from "../../entities/user/api/userApi";
import type { User } from "../../entities/user/types/user";
import { UserStatusBadge } from "../../entities/user/ui/UserStatusBadge";
import HeaderName from "../../shared/components/headerName";
import FormPopup from "../../shared/ui/FormPopup";
import PageContainer from "../../shared/ui/PageContainer";
import { useAppNotification } from "../../app/providers/notification/NotificationProvider";
import {
  formatUzbekistanPhoneLocal,
  isCompleteUzbekistanPhone,
  keepPhoneCaretAfterChange,
  toUzbekistanPhoneValue,
  UZBEKISTAN_PHONE_PREFIX,
} from "../../shared/lib/phone";
import {
  buildCreateMarketOperatorPayload,
  type MarketOperatorCreateFormValues,
} from "./model/createMarketOperator";

const DEFAULT_CREATE_VALUES: MarketOperatorCreateFormValues = {
  name: "",
  phone_number: UZBEKISTAN_PHONE_PREFIX,
  password: "",
};

const labelClassName =
  "mb-2 flex items-center gap-1 text-xs font-black uppercase tracking-[0.08em] text-[color:var(--color-text-muted)] dark:text-white/65";

const iconClassName =
  "pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--color-text-muted)] dark:text-white/45";

const baseInputClassName =
  "h-12 w-full rounded-2xl border bg-white/80 text-sm font-bold text-maindark outline-none transition placeholder:text-[color:var(--color-text-muted)] focus:ring-2 dark:bg-white/[0.075] dark:text-white dark:placeholder:text-white/38";

const inputStateClassName = (hasError: boolean) =>
  hasError
    ? "border-red-400 focus:border-red-400 focus:ring-red-400/15"
    : "border-[color:var(--color-border-strong)] hover:border-main/50 focus:border-main focus:ring-main/20 dark:border-white/14";

const formatPhoneNumber = (phone?: string | null) => {
  const digits = String(phone ?? "").replace(/\D/g, "");
  const local = digits.startsWith("998") ? digits.slice(3) : digits;

  if (local.length === 9) {
    return `+998 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5, 7)} ${local.slice(7, 9)}`;
  }

  return phone || "—";
};

const getInitials = (name?: string | null) => {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (parts[0]?.slice(0, 2) || "OP").toUpperCase();
};

const OperatorCard = memo(({ operator }: { operator: User }) => (
  <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 transition hover:border-main/30 hover:bg-white/8 dark:bg-white/[0.035]">
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-main/15 text-sm font-black text-main dark:bg-white/10 dark:text-white">
        {getInitials(operator.name)}
      </div>
      <div className="min-w-0">
        <p className="m-0 truncate text-sm font-black text-maindark dark:text-white">
          {operator.name || "—"}
        </p>
        <p className="m-0 mt-1 flex items-center gap-1.5 truncate text-xs font-semibold text-[color:var(--color-text-muted)] dark:text-white/55">
          <Phone size={13} />
          {formatPhoneNumber(operator.phone_number)}
        </p>
      </div>
    </div>
    <UserStatusBadge status={operator.status} />
  </div>
));

OperatorCard.displayName = "OperatorCard";

const MarketOperatorsPage = () => {
  const { t } = useTranslation("marketOperators");
  const { api } = useAppNotification();
  const { useGetUser } = useUser();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MarketOperatorCreateFormValues>({
    defaultValues: DEFAULT_CREATE_VALUES,
    mode: "onSubmit",
  });
  const { data, isLoading, isError, refetch } = useGetUser({
    role: "operator",
    page: 1,
    limit: 100,
  });

  const operators = useMemo(
    () => (data?.data?.items ?? []).filter((user) => user.role === "operator"),
    [data?.data?.items],
  );

  const closeCreateModal = () => {
    setIsCreateOpen(false);
    setShowPassword(false);
    reset(DEFAULT_CREATE_VALUES);
  };

  const handleCreateSubmit = (values: MarketOperatorCreateFormValues) => {
    buildCreateMarketOperatorPayload(values);
    api.warning({
      message: t("createUnavailableTitle"),
      description: t("createUnavailableDescription"),
      placement: "topRight",
      duration: 4,
    });
  };

  return (
    <PageContainer className="flex min-h-full flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <HeaderName
          name={t("title")}
          description={t("description")}
          icon={<UsersRound />}
          iconClassName="bg-blue-600/20 text-blue-400 dark:bg-blue-500/20 dark:text-blue-300"
        />
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-main px-4 text-sm font-black text-white shadow-lg shadow-main/20 transition hover:bg-main/90 active:scale-[0.99] sm:px-5"
        >
          <Plus size={17} />
          {t("newOperator")}
        </button>
      </div>

      <section className="flex min-h-[calc(100vh-18rem)] flex-1 flex-col overflow-hidden rounded-[24px] border border-white/10 bg-primary/45 shadow-sm dark:bg-white/[0.025]">
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3 text-[color:var(--color-text-muted)]">
              <Loader2 className="h-8 w-8 animate-spin text-main" />
              <p className="m-0 text-sm font-semibold">{t("loading")}</p>
            </div>
          </div>
        ) : isError ? (
          <div className="flex flex-1 items-center justify-center px-4 py-20 text-center">
            <div>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-400">
                <UsersRound size={30} />
              </div>
              <p className="m-0 text-base font-black text-maindark dark:text-white">{t("loadError")}</p>
              <button
                type="button"
                onClick={() => void refetch()}
                className="mt-4 min-h-10 rounded-xl border border-white/10 px-4 text-sm font-bold text-main transition hover:border-main/40"
              >
                {t("retry")}
              </button>
            </div>
          </div>
        ) : operators.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-4 py-20 text-center">
            <div>
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-[color:var(--color-text-muted)] dark:bg-white/5">
                <UsersRound size={34} />
              </div>
              <p className="m-0 text-base font-semibold text-[color:var(--color-text-muted)] dark:text-white/60">
                {t("emptyTitle")}
              </p>
              <p className="m-0 mt-2 text-xs font-semibold text-[color:var(--color-text-muted)] dark:text-white/45">
                {t("emptyDescription")}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            {operators.map((operator) => (
              <OperatorCard key={operator.id} operator={operator} />
            ))}
          </div>
        )}
      </section>

      <FormPopup
        isOpen={isCreateOpen}
        onClose={closeCreateModal}
        onSubmit={(event) => {
          void handleSubmit(handleCreateSubmit)(event);
        }}
        title={t("createTitle")}
        description={t("createDescription")}
        icon={<UsersRound size={22} />}
        submitLabel={t("save")}
        cancelLabel={t("cancel")}
        widthClassName="max-w-[520px]"
        theme="market"
      >
        <div className="space-y-4">
          <Controller
            control={control}
            name="name"
            rules={{ required: t("nameRequired") }}
            render={({ field }) => (
              <label className="block">
                <span className="mb-2 flex items-center gap-1 text-xs font-black uppercase tracking-[0.08em] text-[color:var(--color-text-muted)] dark:text-white/65">
                  {t("nameLabel")} <span className="text-red-400">*</span>
                </span>
                <div className="relative">
                  <UserRound
                    size={18}
                    className={iconClassName}
                  />
                  <input
                    {...field}
                    autoComplete="name"
                    placeholder={t("namePlaceholder")}
                    className={`${baseInputClassName} pl-11 pr-4 ${inputStateClassName(!!errors.name)}`}
                  />
                </div>
                {errors.name ? <span className="mt-1.5 block text-xs font-semibold text-red-400">{errors.name.message}</span> : null}
              </label>
            )}
          />

          <Controller
            control={control}
            name="phone_number"
            rules={{
              validate: (value) =>
                isCompleteUzbekistanPhone(value) || t("phoneRequired"),
            }}
            render={({ field }) => (
              <label className="block">
                <span className={labelClassName}>
                  {t("phoneLabel")} <span className="text-red-400">*</span>
                </span>
                <div className="relative">
                  <Phone
                    size={18}
                    className={iconClassName}
                  />
                  <span className="pointer-events-none absolute left-11 top-1/2 -translate-y-1/2 text-sm font-bold text-maindark dark:text-white">
                    {UZBEKISTAN_PHONE_PREFIX}
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="off"
                    name={field.name}
                    value={formatUzbekistanPhoneLocal(field.value)}
                    onChange={(event) => {
                      const nextValue = toUzbekistanPhoneValue(event.target.value);
                      const nextDisplayValue = formatUzbekistanPhoneLocal(nextValue);
                      field.onChange(nextValue);
                      keepPhoneCaretAfterChange(event.target, nextDisplayValue);
                    }}
                    onBlur={field.onBlur}
                    placeholder="90 123 45 67"
                    className={`${baseInputClassName} pl-[5.65rem] pr-4 ${inputStateClassName(!!errors.phone_number)}`}
                  />
                </div>
                {errors.phone_number ? (
                  <span className="mt-1.5 block text-xs font-semibold text-red-400">{errors.phone_number.message}</span>
                ) : null}
              </label>
            )}
          />

          <Controller
            control={control}
            name="password"
            rules={{
              required: t("passwordRequired"),
              minLength: { value: 4, message: t("passwordMinLength") },
            }}
            render={({ field }) => (
              <label className="block">
                <span className={labelClassName}>
                  {t("passwordLabel")} <span className="text-red-400">*</span>
                </span>
                <div className="relative">
                  <Lock
                    size={18}
                    className={iconClassName}
                  />
                  <input
                    {...field}
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder={t("passwordPlaceholder")}
                    className={`${baseInputClassName} pl-11 pr-12 ${inputStateClassName(!!errors.password)}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                    className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-[color:var(--color-text-muted)] transition hover:bg-main/10 hover:text-main dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-white"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.password ? (
                  <span className="mt-1.5 block text-xs font-semibold text-red-400">{errors.password.message}</span>
                ) : null}
              </label>
            )}
          />
        </div>
      </FormPopup>
    </PageContainer>
  );
};

export default memo(MarketOperatorsPage);
