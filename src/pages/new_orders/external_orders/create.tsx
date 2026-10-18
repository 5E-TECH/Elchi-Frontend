// dizayn-v2: superadmin-integrations-legacy-source-create
import { memo, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMarkets } from "../../../entities/markets";
import {
  getIntegrationErrorMessage,
  type CreateIntegrationPayload,
  type IntegrationAuthType,
  useCreateIntegration,
} from "../../../entities/integrations";
import { formatPhone } from "../../../shared/lib/formatPhone";
import { notify } from "../../../shared/lib/notify";
import { Button, Card, Field, PageHeader, Select, TextInput, type SelectOption } from "../../../shared/ui/primitives";
import { SecretInput, Switch } from "../../integrations/ui";
import { LEGACY_AUTH_LABEL_KEY, LEGACY_AUTH_TYPES, buildLegacyAuthCreate } from "./legacyAuth";

/**
 * ESKI TASHQI MANBA — yaratish (maket `*-integrations-legacy-source-create`; admin/menejer/registrator — shu).
 *
 * Uch bo'lim bitta kartada: «Asosiy ma'lumotlar» (nom, slug — nomdan avtomatik, market), «Ulanish sozlamalari»
 * (API manzili, avtorizatsiya turi → login/parol yoki token), «Integratsiya holati» (kalit). Saqlangach —
 * `/integrations/sources` (kanonik yo'l). Payload: `type: "api"`, `credentials`, `market_id`; avtorizatsiya turi —
 * backend qiymatlari `login` | `api_key`, token `credentials.api_key` da (`legacyAuth.ts`).
 */

type MarketOptionSource = { id?: string | number; name?: string; username?: string | null; phone_number?: string | null };

const makeSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const getMarketItems = (value: unknown): MarketOptionSource[] => {
  const response = value as { data?: MarketOptionSource[] | { items?: MarketOptionSource[] } };
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.items)) return response.data.items;
  return [];
};

const Section = ({ title, description, children }: { title: string; description: string; children: ReactNode }) => (
  <section className="flex min-w-0 flex-col gap-4 border-t border-border p-5 first:border-t-0 max-md:p-4">
    <div className="flex flex-col gap-0.5">
      <h2 className="text-base font-bold text-text">{title}</h2>
      <p className="text-[13px] leading-[18px] text-text-muted">{description}</p>
    </div>
    {children}
  </section>
);

const ExternalIntegrationCreatePage = () => {
  const { t } = useTranslation("integrations");
  const navigate = useNavigate();
  const { useGetMarkets } = useMarkets();
  const marketsQuery = useGetMarkets({ status: "active", limit: 100 }, true);
  const createIntegration = useCreateIntegration();

  const [form, setForm] = useState({
    name: "",
    slug: "",
    api_url: "",
    auth_url: "",
    auth_type: "login" as IntegrationAuthType,
    username: "",
    password: "",
    token: "",
    market_id: "",
    is_active: true,
  });
  const [touched, setTouched] = useState(false);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  const marketOptions = useMemo<SelectOption[]>(
    () =>
      getMarketItems(marketsQuery.data).map((market) => ({
        value: String(market.id ?? ""),
        label: `${market.name ?? `#${market.id}`}${
          market.phone_number ? ` · ${formatPhone(market.phone_number)}` : market.username ? ` · ${market.username}` : ""
        }`,
      })),
    [marketsQuery.data],
  );
  const authOptions = useMemo<SelectOption<IntegrationAuthType>[]>(
    () => LEGACY_AUTH_TYPES.map((value) => ({ value, label: t(LEGACY_AUTH_LABEL_KEY[value]) })),
    [t],
  );

  const required = (value: string) => (touched && !value.trim() ? t("legacySources.required") : undefined);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!form.name.trim() || !form.slug.trim() || !form.api_url.trim() || !form.market_id) return;
    if (createIntegration.isPending) return;
    try {
      const payload: CreateIntegrationPayload = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        type: "api",
        status: form.is_active ? "active" : "inactive",
        base_url: form.api_url.trim(),
        ...buildLegacyAuthCreate(form),
        market_id: form.market_id,
        is_active: form.is_active,
      };
      await createIntegration.mutateAsync(payload);
      notify.success(t("legacySources.createSuccess"));
      navigate("/integrations/sources");
    } catch (error) {
      notify.error(
        error instanceof Error ? error.message : getIntegrationErrorMessage(error) || t("legacySources.createError"),
      );
    }
  };

  const actions = (
    <>
      <Button variant="secondary" onClick={() => navigate("/integrations/sources")} disabled={createIntegration.isPending}>
        {t("npCancel")}
      </Button>
      <Button type="submit" loading={createIntegration.isPending} loadingText={t("legacySources.saving")}>
        {t("console.save")}
      </Button>
    </>
  );

  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      <PageHeader
        back="/integrations/sources"
        backLabel={t("legacySources.title")}
        title={t("legacySources.createTitle")}
        description={t("legacySources.createSub")}
      />

      <form onSubmit={(event) => void onSubmit(event)} noValidate>
        <Card
          padding="none"
          aria-label={t("legacySources.createTitle")}
          footer={
            <div className="flex w-full flex-wrap items-center justify-between gap-3">
              <span className="min-w-0 flex-[1_1_240px] text-xs text-text-muted">{t("legacySources.readyHint")}</span>
              <div className="flex flex-wrap gap-2 max-md:w-full max-md:[&>*]:flex-1">{actions}</div>
            </div>
          }
        >
          <Section title={t("legacySources.basicsTitle")} description={t("legacySources.basicsSub")}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label={t("legacySources.name")} required error={required(form.name)}>
                <TextInput
                  value={form.name}
                  onValueChange={(value) => setForm((f) => ({ ...f, name: value, slug: makeSlug(value) }))}
                  placeholder={t("legacySources.namePlaceholder")}
                />
              </Field>
              <Field label={t("legacySources.slug")} required hint={t("legacySources.slugHint")} error={required(form.slug)}>
                <TextInput value={form.slug} onValueChange={(value) => set("slug", value)} placeholder={t("legacySources.slugPlaceholder")} />
              </Field>
              <Field
                label={t("legacySources.market")}
                required
                labelAs="span"
                hint={t("legacySources.marketHint")}
                error={touched && !form.market_id ? t("legacySources.required") : undefined}
                className="md:col-span-2"
              >
                <Select
                  searchable
                  options={marketOptions}
                  value={form.market_id || null}
                  onChange={(value) => set("market_id", value ?? "")}
                  loading={marketsQuery.isLoading}
                  placeholder={t("legacySources.selectMarket")}
                />
              </Field>
            </div>
          </Section>

          <Section title={t("legacySources.connTitle")} description={t("legacySources.connSub")}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label={t("legacySources.apiUrl")} required hint={t("legacySources.apiUrlHint")} error={required(form.api_url)} className="md:col-span-2">
                <TextInput
                  type="url"
                  inputMode="url"
                  value={form.api_url}
                  onValueChange={(value) => set("api_url", value)}
                  placeholder="https://api.example.com/orders"
                />
              </Field>
              <Field label={t("legacySources.authType")} labelAs="span" hint={t("legacySources.authTypeHint")}>
                <Select
                  options={authOptions}
                  value={form.auth_type}
                  onChange={(value) => setForm((f) => ({ ...f, auth_type: value ?? "login", token: value === "api_key" ? f.token : "" }))}
                />
              </Field>
              <Field label={t("legacySources.authUrl")} hint={t("legacySources.optional")}>
                <TextInput
                  type="url"
                  inputMode="url"
                  value={form.auth_url}
                  onValueChange={(value) => set("auth_url", value)}
                  placeholder="https://api.example.com/auth"
                />
              </Field>
              {form.auth_type === "login" ? (
                <>
                  <Field label={t("legacySources.username")}>
                    <TextInput value={form.username} onValueChange={(value) => set("username", value)} placeholder={t("legacySources.usernamePlaceholder")} autoComplete="off" />
                  </Field>
                  <Field label={t("legacySources.password")}>
                    <SecretInput value={form.password} onValueChange={(value) => set("password", value)} placeholder={t("legacySources.passwordPlaceholder")} />
                  </Field>
                </>
              ) : null}
              {form.auth_type === "api_key" ? (
                <Field label={t("legacySources.token")} hint={t("legacySources.tokenHint")} className="md:col-span-2">
                  <SecretInput value={form.token} onValueChange={(value) => set("token", value)} placeholder={t("legacySources.tokenPlaceholder")} />
                </Field>
              ) : null}
            </div>
          </Section>

          <Section title={t("legacySources.stateTitle")} description={t("legacySources.stateSub")}>
            <Switch
              checked={form.is_active}
              onChange={(next) => set("is_active", next)}
              aria-label={t("legacySources.activeAria")}
              label={form.is_active ? t("legacySources.active") : t("legacySources.inactive")}
              description={form.is_active ? t("legacySources.activeHint") : t("legacySources.inactiveHint")}
            />
          </Section>
        </Card>
      </form>
    </div>
  );
};

export default memo(ExternalIntegrationCreatePage);
