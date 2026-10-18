// dizayn-v2: superadmin-notifications-sms-settings
import { useState, type ReactNode } from "react";
import { Eye, EyeOff, KeyRound, Lock } from "lucide-react";
import { useSelector } from "react-redux";
import { Trans, useTranslation } from "react-i18next";
import type { RootState } from "../../../app/config/store";
import { NoticeAlert } from "../../../entities/notification";
import {
  useGrantSmsConsent,
  useRevokeSmsConsent,
  useSmsAccounts,
  useSmsStatus,
  useUpsertSmsAccount,
  type SmsAccount,
} from "../../../entities/sms";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../shared/lib/formatMoney";
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  QueryBoundary,
  Select,
  SkeletonLines,
  SkeletonTable,
  TextInput,
  type DataTableColumn,
} from "../../../shared/ui/primitives";

const hhmm = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

type Feedback = { type: "success" | "error"; text: string } | null;
type ConsentSource = "shartnoma" | "veb-forma" | "buyurtma" | "operator";

/** `+998` + 9 raqam — to'liq telefon (`TextInput mode="phone"` qiymati). */
const isFullPhone = (value: string) => /^\+998\d{9}$/.test(value);

/** `.el-kv` qatori: chapda yorliq (muted), o'ngda qiymat. */
const KvRow = ({
  label,
  sub,
  children,
}: {
  label: ReactNode;
  sub?: ReactNode;
  children: ReactNode;
}) => (
  <>
    <dt className="flex min-w-0 flex-col text-text-muted">
      {label}
      {sub ? <span className="text-xs text-text-subtle">{sub}</span> : null}
    </dt>
    <dd className="m-0 min-w-0 text-text">{children}</dd>
  </>
);

/**
 * SMS SOZLAMALARI, dizayn v2 — maket `superadmin-notifications-sms-settings`.
 *
 * «Holat» (yoqilgan/o'chiq badge; provayder, akkauntlar, bugungi sarf + chegara chizig'i, reklama taqiqi, tariflar;
 * `SMS_CREDENTIAL_SECRET` yo'q — ogohlantirish), «Reklama roziligi» (Telefon*, Manba, qayd etish / bekor qilish),
 * «Provayder akkauntlari» (faqat superadmin: ro'yxat + «Akkauntni qo'shish yoki yangilash»). Mutatsiyalar avvalgidek:
 * `POST …/consents`, `POST …/consents/revoke`, `PUT …/accounts`.
 */
const SmsSettingsTab = () => {
  const { t, i18n } = useTranslation("sms");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const isSuperadmin = useSelector((state: RootState) => state.role.role) === "superadmin";
  const status = useSmsStatus({ silentError: true });
  const accounts = useSmsAccounts(isSuperadmin, { silentError: true });
  const upsertAccount = useUpsertSmsAccount();
  const grant = useGrantSmsConsent();
  const revoke = useRevokeSmsConsent();

  const [account, setAccount] = useState({
    provider: "eskiz" as "eskiz" | "playmobile",
    sender_profile: "default" as "default" | "otp",
    login: "",
    password: "",
    sender: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [accountFeedback, setAccountFeedback] = useState<Feedback>(null);
  const [consent, setConsent] = useState<{ phone: string; source: ConsentSource }>({
    phone: "",
    source: "operator",
  });
  const [consentFeedback, setConsentFeedback] = useState<Feedback>(null);

  const num = (value: number) => formatNumberLocalized(value, { language });
  const providerLabel = (provider: string) =>
    t(`settings.providers.${provider}`, { defaultValue: provider });
  const profileLabel = (profile: string) =>
    t(profile === "otp" ? "settings.profileOtp" : "settings.profileDefault");
  const configured = (ok: boolean | undefined) =>
    ok ? (
      <Badge tone="success" dot>
        {t("settings.configured")}
      </Badge>
    ) : (
      <Badge tone="warning" dot>
        {t("settings.notConfigured")}
      </Badge>
    );

  const secretMissing = status.data ? status.data.credential_secret_configured === false : false;
  // Javob massiv bo'lmasa (kutilmagan konvert) — sahifa yiqilmasin.
  const accountsQuery = {
    ...accounts,
    data:
      accounts.data === undefined ? undefined : Array.isArray(accounts.data) ? accounts.data : [],
  };

  const saveAccount = async () => {
    setAccountFeedback(null);
    try {
      await upsertAccount.mutateAsync(account);
      setAccountFeedback({ type: "success", text: t("settings.accountSaved") });
      setAccount((current) => ({ ...current, password: "" }));
    } catch (error) {
      setAccountFeedback({ type: "error", text: getBackendErrorMessage(error) ?? String(error) });
    }
  };

  const consentAction = async (kind: "grant" | "revoke") => {
    setConsentFeedback(null);
    try {
      if (kind === "grant") await grant.mutateAsync(consent);
      else await revoke.mutateAsync(consent.phone);
      setConsentFeedback({ type: "success", text: t("settings.consentSaved") });
    } catch (error) {
      setConsentFeedback({ type: "error", text: getBackendErrorMessage(error) ?? String(error) });
    }
  };

  const accountColumns: DataTableColumn<SmsAccount>[] = [
    {
      id: "provider",
      header: t("settings.provider"),
      cell: (row) => <span className="font-semibold">{providerLabel(row.provider)}</span>,
    },
    {
      id: "profile",
      header: t("settings.profile"),
      cell: (row) => <Badge>{profileLabel(row.sender_profile)}</Badge>,
    },
    {
      id: "login",
      header: t("settings.login"),
      cell: (row) => <span className="[overflow-wrap:anywhere]">{row.login}</span>,
    },
    {
      id: "sender",
      header: t("settings.sender"),
      cell: (row) => <span className="font-semibold">{row.sender}</span>,
    },
    {
      id: "state",
      header: t("settings.state"),
      cell: (row) => (
        <Badge tone={row.is_active ? "success" : "neutral"} dot>
          {t(row.is_active ? "settings.active" : "settings.inactive")}
        </Badge>
      ),
    },
  ];

  const canSaveAccount =
    Boolean(account.login && account.password && account.sender) && !secretMissing;
  const phoneReady = isFullPhone(consent.phone);

  return (
    <>
      <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(360px,100%),1fr))] items-start gap-6 max-md:gap-4">
        <Card
          title={t("settings.status")}
          actions={
            typeof status.data?.enabled === "boolean" ? (
              <Badge tone={status.data.enabled ? "success" : "warning"} dot>
                {t(status.data.enabled ? "settings.enabled" : "settings.disabled")}
              </Badge>
            ) : null
          }
        >
          <QueryBoundary
            query={status}
            // Kutilmagan javob (holat maydonlari yo'q) — yiqilmasin, xato holati.
            isEmpty={(s) => typeof s.enabled !== "boolean" || !s.quiet_hours || !s.tariffs}
            empty={
              <ErrorState
                title={t("settings.statusLoadError")}
                onRetry={() => void status.refetch()}
              />
            }
            loadingLabel={t("settings.statusLoading")}
            loading={<SkeletonLines lines={6} />}
            error={(error, retry) => (
              <ErrorState error={error} title={t("settings.statusLoadError")} onRetry={retry} />
            )}
          >
            {(s) => (
              <div className="flex min-w-0 flex-col gap-4">
                <dl className="m-0 grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-x-4 gap-y-3 text-sm">
                  <KvRow label={t("settings.provider")}>{providerLabel(s.provider)}</KvRow>
                  <KvRow label={t("settings.defaultAccount")}>
                    {configured(s.default_account)}
                  </KvRow>
                  <KvRow label={t("settings.otpAccount")} sub={t("settings.otpAccountSub")}>
                    {configured(s.otp_account)}
                  </KvRow>
                  <KvRow label={t("settings.today")}>
                    <span className="flex min-w-0 flex-col gap-1.5">
                      <span className="font-semibold tabular-nums">
                        {t("settings.usedToday", {
                          used: num(s.used_today),
                          cap: num(s.daily_cap),
                        })}
                      </span>
                      <span
                        role="img"
                        aria-label={t("settings.usedAria", {
                          value: num(
                            s.daily_cap > 0 ? Math.round((s.used_today / s.daily_cap) * 100) : 0,
                          ),
                        })}
                        className="block h-1.5 max-w-[240px] overflow-hidden rounded-full bg-sunken"
                      >
                        <span
                          className="block h-full rounded-full bg-action"
                          style={{
                            width: `${s.daily_cap > 0 ? Math.min((s.used_today / s.daily_cap) * 100, 100) : 0}%`,
                          }}
                        />
                      </span>
                    </span>
                  </KvRow>
                  <KvRow label={t("settings.quietHoursLabel")}>
                    <span className="font-semibold tabular-nums">
                      {t("settings.quietHours", {
                        from: hhmm(s.quiet_hours.start),
                        to: hhmm(s.quiet_hours.end),
                      })}
                    </span>
                  </KvRow>
                  <KvRow label={t("settings.tariffLabel")}>
                    <span className="flex flex-col gap-0.5 font-semibold">
                      <span>
                        {t("settings.tariffTransactional", {
                          value:
                            s.tariffs.transactional === null
                              ? t("settings.tariffNone")
                              : formatMoneyLocalized(s.tariffs.transactional, { language }),
                        })}
                      </span>
                      <span>
                        {t("settings.tariffPromo", {
                          value:
                            s.tariffs.promo === null
                              ? t("settings.tariffNone")
                              : formatMoneyLocalized(s.tariffs.promo, { language }),
                        })}
                      </span>
                    </span>
                  </KvRow>
                </dl>
                {!s.credential_secret_configured ? (
                  <NoticeAlert tone="warning" id="sms-secret-alert">
                    <span className="text-sm">
                      <Trans
                        t={t}
                        i18nKey="settings.secretMissing"
                        components={{ b: <span className="font-bold" /> }}
                      />
                    </span>
                  </NoticeAlert>
                ) : null}
              </div>
            )}
          </QueryBoundary>
        </Card>

        <Card
          title={t("settings.consent")}
          description={t("settings.consentHint")}
          bodyClassName="flex flex-col gap-4"
        >
          <Field label={t("settings.phone")} required>
            <TextInput
              mode="phone"
              value={consent.phone}
              onValueChange={(phone) => setConsent((current) => ({ ...current, phone }))}
            />
          </Field>
          <Field label={t("settings.source")} labelAs="span">
            <Select
              options={(["shartnoma", "veb-forma", "buyurtma", "operator"] as const).map(
                (value) => ({ value, label: t(`sources.${value}`) }),
              )}
              value={consent.source}
              onChange={(value) => {
                if (value) setConsent((current) => ({ ...current, source: value }));
              }}
            />
          </Field>
          <div className="flex flex-wrap gap-2 [&>*]:flex-[1_1_auto]">
            <Button
              variant="secondary"
              disabled={!phoneReady}
              loading={grant.isPending}
              onClick={() => void consentAction("grant")}
            >
              {t("settings.grant")}
            </Button>
            <Button
              variant="danger-soft"
              disabled={!phoneReady}
              loading={revoke.isPending}
              onClick={() => void consentAction("revoke")}
            >
              {t("settings.revoke")}
            </Button>
          </div>
          {consentFeedback ? (
            <NoticeAlert
              tone={consentFeedback.type === "success" ? "success" : "danger"}
              title={consentFeedback.text}
            />
          ) : null}
        </Card>
      </div>

      {isSuperadmin ? (
        <Card
          padding="none"
          title={t("settings.accounts")}
          description={
            <span className="inline-flex items-center gap-1.5">
              <Lock aria-hidden="true" size={14} className="shrink-0" />
              {t("settings.accountsHint")}
            </span>
          }
          footer={
            <>
              <span
                id="sms-save-hint"
                className="min-w-0 flex-[1_1_260px] text-[13px] text-text-muted"
              >
                {t("settings.saveHint")}
              </span>
              <Button
                className="ml-auto max-md:w-full"
                loading={upsertAccount.isPending}
                disabled={!canSaveAccount}
                aria-describedby={
                  secretMissing ? "sms-save-hint sms-secret-alert" : "sms-save-hint"
                }
                onClick={() => void saveAccount()}
              >
                {t("settings.saveAccount")}
              </Button>
            </>
          }
        >
          <QueryBoundary
            query={accountsQuery}
            loadingLabel={t("settings.accountsLoading")}
            loading={
              <SkeletonTable
                framed={false}
                columns={[t("settings.provider"), t("settings.profile"), t("settings.login")]}
                rows={2}
              />
            }
            empty={<EmptyState icon={KeyRound} title={t("settings.accountsEmpty")} />}
            error={(error, retry) => (
              <ErrorState error={error} title={t("settings.accountsLoadError")} onRetry={retry} />
            )}
          >
            {(rows) => (
              <DataTable
                rows={rows}
                columns={accountColumns}
                getRowKey={(row) => row.id}
                label={t("settings.accountsLabel")}
                renderCard={(row) => (
                  <div className="flex min-w-0 flex-col gap-1 px-4 py-3">
                    <span className="flex min-w-0 justify-between gap-2">
                      <span className="font-semibold text-text">
                        {providerLabel(row.provider)} · {profileLabel(row.sender_profile)}
                      </span>
                      <Badge tone={row.is_active ? "success" : "neutral"} dot>
                        {t(row.is_active ? "settings.active" : "settings.inactive")}
                      </Badge>
                    </span>
                    <span className="text-xs text-text-muted [overflow-wrap:anywhere]">
                      {row.login} · {row.sender}
                    </span>
                  </div>
                )}
              />
            )}
          </QueryBoundary>

          <div className="flex min-w-0 flex-col gap-4 border-t border-border p-5 max-md:p-4">
            <h3 className="m-0 text-sm font-semibold text-text">{t("settings.accountForm")}</h3>
            <div className="flex min-w-0 flex-wrap gap-4 [&>*]:flex-[1_1_180px]">
              <Field label={t("settings.provider")} labelAs="span">
                <Select
                  options={[
                    { value: "eskiz", label: providerLabel("eskiz") },
                    { value: "playmobile", label: providerLabel("playmobile") },
                  ]}
                  value={account.provider}
                  onChange={(value) => {
                    if (value) setAccount((current) => ({ ...current, provider: value }));
                  }}
                />
              </Field>
              <Field label={t("settings.profile")} labelAs="span">
                <Select
                  options={[
                    { value: "default", label: t("settings.profileDefault") },
                    { value: "otp", label: t("settings.profileOtp") },
                  ]}
                  value={account.sender_profile}
                  onChange={(value) => {
                    if (value) setAccount((current) => ({ ...current, sender_profile: value }));
                  }}
                />
              </Field>
              <Field label={t("settings.login")} required>
                <TextInput
                  type="email"
                  autoComplete="off"
                  placeholder={t("settings.loginPlaceholder")}
                  value={account.login}
                  onValueChange={(login) => setAccount((current) => ({ ...current, login }))}
                />
              </Field>
              <Field label={t("settings.password")} required>
                <TextInput
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={account.password}
                  onValueChange={(password) => setAccount((current) => ({ ...current, password }))}
                  suffix={
                    <IconButton
                      size="sm"
                      icon={showPassword ? EyeOff : Eye}
                      label={t(showPassword ? "settings.hidePassword" : "settings.showPassword")}
                      onClick={() => setShowPassword((value) => !value)}
                      className="-mr-2"
                    />
                  }
                />
              </Field>
              <Field label={t("settings.sender")} required>
                <TextInput
                  placeholder={t("settings.senderPlaceholder")}
                  value={account.sender}
                  onValueChange={(sender) => setAccount((current) => ({ ...current, sender }))}
                />
              </Field>
            </div>
            {accountFeedback ? (
              <NoticeAlert
                tone={accountFeedback.type === "success" ? "success" : "danger"}
                title={accountFeedback.text}
              />
            ) : null}
          </div>
        </Card>
      ) : null}
    </>
  );
};

export default SmsSettingsTab;
