import { memo, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Activity,
  Cable,
  CheckCircle2,
  DatabaseZap,
  Eye,
  EyeOff,
  Globe2,
  KeyRound,
  Link2,
  LockKeyhole,
  PlugZap,
  Save,
  Store,
} from "lucide-react";
import BackButton from "../../../shared/ui/BackButton";
import HeaderName from "../../../shared/components/headerName";
import SearchableSelect from "../../../shared/ui/SearchableSelect";
import Button from "../../../shared/components/button";
import { useMarkets } from "../../../entities/markets";
import {
  getIntegrationErrorMessage,
  type CreateIntegrationPayload,
  useCreateIntegration,
} from "../../../entities/integrations";
import { useAppNotification } from "../../../app/providers/notification/NotificationProvider";

type MarketOptionSource = {
  id?: string | number;
  name?: string;
  username?: string | null;
  phone_number?: string | null;
};

type IntegrationCreateForm = {
  name: string;
  slug: string;
  api_url: string;
  auth_url: string;
  auth_type: string;
  username: string;
  password: string;
  token: string;
  market_id: string;
  is_active: boolean;
};

const authTypes = ["none", "bearer", "basic"] as const;

const platformOptions = [
  { value: "custom", labelKey: "platformCustom", icon: PlugZap },
  { value: "marketplace", labelKey: "platformMarketplace", icon: Store },
  { value: "crm", labelKey: "platformCrm", icon: DatabaseZap },
];

const makeSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const getMarketItems = (value: unknown): MarketOptionSource[] => {
  const response = value as {
    data?: MarketOptionSource[] | { items?: MarketOptionSource[] };
  };

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  if (Array.isArray(response?.data?.items)) {
    return response.data.items;
  }

  return [];
};

const ExternalIntegrationCreatePage = () => {
  const { t } = useTranslation(["newOrders", "common"]);
  const navigate = useNavigate();
  const { api: notificationApi } = useAppNotification();
  const [platform, setPlatform] = useState("custom");
  const [showPassword, setShowPassword] = useState(false);
  const { useGetMarkets } = useMarkets();
  const marketsQuery = useGetMarkets({ status: "active", limit: 100 }, true);
  const createIntegration = useCreateIntegration();

  const {
    register,
    clearErrors,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<IntegrationCreateForm>({
    defaultValues: {
      name: "",
      slug: "",
      api_url: "",
      auth_url: "",
      auth_type: "basic",
      username: "",
      password: "",
      token: "",
      market_id: "",
      is_active: true,
    },
  });

  const selectedAuthType = watch("auth_type");
  const selectedMarketId = watch("market_id");
  const isActive = watch("is_active");

  const marketOptions = useMemo(
    () =>
      getMarketItems(marketsQuery.data).map((market) => ({
        value: String(market.id ?? ""),
        label: `${market.name ?? `#${market.id}`} ${
          market.phone_number ? `• ${market.phone_number}` : market.username ? `• ${market.username}` : ""
        }`,
      })),
    [marketsQuery.data, t],
  );

  const authOptions = useMemo(
    () =>
      authTypes.map((value) => ({
        value,
        label: t(`authTypes.${value}`),
      })),
    [t],
  );

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (!values.market_id) {
        setError("market_id", { type: "required", message: t("requiredField") });
        return;
      }

      const credentials: Record<string, string> = {};
      const authUrl = values.auth_url.trim();
      const username = values.username.trim();
      const password = values.password.trim();
      const token = values.token.trim();

      if (authUrl) credentials.auth_url = authUrl;
      if (selectedAuthType === "basic") {
        if (username) credentials.username = username;
        if (password) credentials.password = password;
      }
      if (selectedAuthType === "bearer" && token) credentials.token = token;

      const payload: CreateIntegrationPayload = {
        name: values.name.trim(),
        slug: values.slug.trim(),
        type: "api",
        status: values.is_active ? "active" : "inactive",
        base_url: values.api_url.trim(),
        auth_type: values.auth_type,
        credentials,
        market_id: values.market_id,
        is_active: values.is_active,
      };

      await createIntegration.mutateAsync(payload);
      notificationApi.success({
        message: t("integrationCreateSuccess"),
        placement: "topRight",
      });
      navigate("/new-orders/integrations");
    } catch (error) {
      notificationApi.error({
        message:
          error instanceof Error
            ? error.message
            : getIntegrationErrorMessage(error) || t("integrationCreateError"),
        placement: "topRight",
      });
    }
  });

  return (
    <div className="space-y-5 pb-20 sm:pb-24 md:pb-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <BackButton to="/new-orders/integrations" className="h-10 min-w-10 rounded-xl px-2" label="" />
          <HeaderName
            name={t("createIntegrationTitle")}
            description={t("createIntegrationSubtitle")}
            icon={<Cable />}
          />
        </div>
      </div>

      <form onSubmit={onSubmit} className="grid gap-5 xl:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
        <section className="space-y-4 rounded-3xl border border-glass-border bg-white/95 p-4 shadow-sm dark:bg-primarydark sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-main/10 text-main">
              <PlugZap size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-maindark dark:text-primary">
                {t("integrationBasics")}
              </h3>
              <p className="mt-1 text-sm text-maindark/50 dark:text-primary/55">
                {t("integrationBasicsDescription")}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {platformOptions.map((option) => {
              const Icon = option.icon;
              const selected = platform === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPlatform(option.value)}
                  className={`flex min-h-23 flex-col items-start justify-between rounded-2xl border p-3 text-left transition-all ${
                    selected
                      ? "border-main bg-main/12 text-main shadow-[0_12px_28px_rgba(124,58,237,0.18)]"
                      : "border-glass-border bg-sidebar/50 text-maindark hover:border-main/40 dark:bg-maindark/35 dark:text-primary"
                  }`}
                >
                  <Icon size={20} />
                  <span className="text-sm font-bold">{t(option.labelKey)}</span>
                </button>
              );
            })}
          </div>

          <div className="grid gap-4">
            <label className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-maindark/55 dark:text-primary/55">
                {t("integrationName")} *
              </span>
              <input
                {...register("name", { required: t("requiredField") })}
                onChange={(event) => {
                  const value = event.target.value;
                  setValue("name", value, { shouldValidate: true });
                  setValue("slug", makeSlug(value), { shouldValidate: true });
                }}
                className="h-12 w-full rounded-2xl border-2 border-glass-border bg-sidebar/70 px-4 text-sm font-semibold text-maindark outline-none transition focus:border-main dark:bg-maindark/55 dark:text-primary"
                placeholder={t("integrationNamePlaceholder")}
              />
              {errors.name?.message && <span className="text-xs font-semibold text-error">{errors.name.message}</span>}
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-maindark/55 dark:text-primary/55">
                {t("integrationSlug")} *
              </span>
              <input
                {...register("slug", { required: t("requiredField") })}
                className="h-12 w-full rounded-2xl border-2 border-glass-border bg-sidebar/70 px-4 text-sm font-semibold text-maindark outline-none transition focus:border-main dark:bg-maindark/55 dark:text-primary"
                placeholder={t("integrationSlugPlaceholder")}
              />
              {errors.slug?.message && <span className="text-xs font-semibold text-error">{errors.slug.message}</span>}
            </label>

            <SearchableSelect
              label={t("market")}
              name="market_id"
              value={selectedMarketId}
              onChange={(value) => {
                setValue("market_id", value, { shouldValidate: true });
                clearErrors("market_id");
              }}
              options={marketOptions}
              placeholder={t("selectMarket")}
              icon={Store}
              loading={marketsQuery.isLoading}
            />
            {errors.market_id?.message && (
              <span className="text-xs font-semibold text-error">
                {errors.market_id.message}
              </span>
            )}
          </div>
        </section>

        <section className="space-y-4 rounded-3xl border border-glass-border bg-white/95 p-4 shadow-sm dark:bg-primarydark sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-success/10 text-success">
              <Globe2 size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-maindark dark:text-primary">
                {t("connectionSettings")}
              </h3>
              <p className="mt-1 text-sm text-maindark/50 dark:text-primary/55">
                {t("connectionSettingsDescription")}
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="space-y-1.5 lg:col-span-2">
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-maindark/55 dark:text-primary/55">
                <Link2 size={12} className="text-main" />
                {t("apiUrl")} *
              </span>
              <input
                {...register("api_url", {
                  required: t("requiredField"),
                  pattern: {
                    value: /^https?:\/\/.+/i,
                    message: t("urlField"),
                  },
                })}
                className="h-12 w-full rounded-2xl border-2 border-glass-border bg-sidebar/70 px-4 text-sm font-semibold text-maindark outline-none transition focus:border-main dark:bg-maindark/55 dark:text-primary"
                placeholder={t("apiUrlPlaceholder")}
              />
              {errors.api_url?.message && <span className="text-xs font-semibold text-error">{errors.api_url.message}</span>}
            </label>

            <SearchableSelect
              label={t("authType")}
              name="auth_type"
              value={selectedAuthType}
              onChange={(value) => setValue("auth_type", value)}
              options={authOptions}
              icon={LockKeyhole}
            />

            <label className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-maindark/55 dark:text-primary/55">
                {t("authUrl")}
              </span>
              <input
                {...register("auth_url")}
                className="h-12 w-full rounded-2xl border-2 border-glass-border bg-sidebar/70 px-4 text-sm font-semibold text-maindark outline-none transition focus:border-main dark:bg-maindark/55 dark:text-primary"
                placeholder={t("authUrlPlaceholder")}
              />
            </label>

            {selectedAuthType === "basic" && (
              <>
                <label className="space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-maindark/55 dark:text-primary/55">
                    {t("username")}
                  </span>
                  <input
                    {...register("username")}
                    className="h-12 w-full rounded-2xl border-2 border-glass-border bg-sidebar/70 px-4 text-sm font-semibold text-maindark outline-none transition focus:border-main dark:bg-maindark/55 dark:text-primary"
                    placeholder={t("usernamePlaceholder")}
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-maindark/55 dark:text-primary/55">
                    {t("password")}
                  </span>
                  <div className="relative">
                    <input
                      {...register("password")}
                      type={showPassword ? "text" : "password"}
                      className="h-12 w-full rounded-2xl border-2 border-glass-border bg-sidebar/70 px-4 pr-12 text-sm font-semibold text-maindark outline-none transition focus:border-main dark:bg-maindark/55 dark:text-primary"
                      placeholder={t("passwordPlaceholder")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                      className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-maindark/45 transition hover:bg-main/10 hover:text-main dark:text-primary/50 dark:hover:text-primary"
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </label>
              </>
            )}

            {selectedAuthType === "bearer" && (
              <label className="space-y-1.5 lg:col-span-2">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-maindark/55 dark:text-primary/55">
                  <KeyRound size={12} className="text-main" />
                  {t("token")}
                </span>
                <input
                  {...register("token")}
                  className="h-12 w-full rounded-2xl border-2 border-glass-border bg-sidebar/70 px-4 text-sm font-semibold text-maindark outline-none transition focus:border-main dark:bg-maindark/55 dark:text-primary"
                  placeholder={t("tokenPlaceholder")}
                />
              </label>
            )}
          </div>

          <div className="flex items-center justify-between gap-4 rounded-2xl border border-glass-border bg-sidebar/50 px-4 py-3 dark:bg-maindark/35">
            <div>
              <h4 className="text-sm font-bold text-maindark dark:text-primary">
                {t("integrationStatus")}
              </h4>
              <p className="text-xs font-medium text-maindark/45 dark:text-primary/45">
                {isActive ? t("integrationActiveHint") : t("integrationInactiveHint")}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isActive}
              onClick={() => setValue("is_active", !isActive, { shouldDirty: true })}
              className={`flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition ${
                isActive ? "bg-success shadow-md shadow-success/20" : "bg-maindark/15 dark:bg-white/12"
              }`}
            >
              <span
                className={`h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${
                  isActive ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-glass-border pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => navigate("/new-orders/integrations")}
              className="h-11 rounded-xl border border-glass-border px-5 text-sm font-bold text-maindark transition hover:border-main/50 hover:text-main dark:text-primary"
            >
              {t("cancel", { ns: "common" })}
            </button>
            <Button
              type="submit"
              disabled={createIntegration.isPending}
              label={createIntegration.isPending ? t("savingIntegration") : t("save", { ns: "common" })}
              icon={createIntegration.isPending ? <Activity size={16} className="animate-spin" /> : <Save size={16} />}
              className="h-11 min-w-40"
            />
          </div>

          <div className="flex items-center gap-2 rounded-2xl bg-success/10 px-4 py-3 text-sm font-semibold text-success">
            <CheckCircle2 size={17} />
            <span>{t("integrationReadyHint")}</span>
          </div>
        </section>
      </form>
    </div>
  );
};

export default memo(ExternalIntegrationCreatePage);
