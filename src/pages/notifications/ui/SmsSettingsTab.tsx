import { useState } from "react";
import { Alert, Button, Input, Select, Table, Tag } from "antd";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import type { RootState } from "../../../app/config/store";
import {
  useGrantSmsConsent,
  useRevokeSmsConsent,
  useSmsAccounts,
  useSmsStatus,
  useUpsertSmsAccount,
  type SmsAccount,
} from "../../../entities/sms";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";

const hhmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

type Feedback = { type: "success" | "error"; text: string } | null;

/** Holat, provayder akkauntlari (faqat superadmin) va reklama roziligi. */
const SmsSettingsTab = () => {
  const { t } = useTranslation("sms");
  const isSuperadmin = useSelector((state: RootState) => state.role.role) === "superadmin";
  const status = useSmsStatus();
  const accounts = useSmsAccounts(isSuperadmin);
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
  const [accountFeedback, setAccountFeedback] = useState<Feedback>(null);
  const [consent, setConsent] = useState({ phone: "", source: "operator" as const as "shartnoma" | "veb-forma" | "buyurtma" | "operator" });
  const [consentFeedback, setConsentFeedback] = useState<Feedback>(null);

  const s = status.data;
  const yes = (ok: boolean | undefined) =>
    ok ? <Tag color="green">{t("settings.configured")}</Tag> : <Tag color="red">{t("settings.notConfigured")}</Tag>;

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

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <section className="flex flex-col gap-2 rounded-2xl border border-[color:var(--color-border-soft)] p-4">
        <h3 className="m-0 text-base font-bold text-maindark dark:text-white">{t("settings.status")}</h3>
        {s ? (
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm">
            <li>{s.enabled ? <Tag color="green">{t("settings.enabled")}</Tag> : <Tag color="orange">{t("settings.disabled")}</Tag>}</li>
            <li>{t("settings.provider")}: <b>{s.provider}</b></li>
            <li>{t("settings.defaultAccount")}: {yes(s.default_account)}</li>
            <li>{t("settings.otpAccount")}: {yes(s.otp_account)}</li>
            <li>{t("settings.usedToday", { used: s.used_today, cap: s.daily_cap })}</li>
            <li>{t("settings.quietHours", { from: hhmm(s.quiet_hours.start), to: hhmm(s.quiet_hours.end) })}</li>
            <li>
              {t("settings.tariffs", {
                transactional: s.tariffs.transactional ?? "—",
                promo: s.tariffs.promo ?? "—",
              })}
            </li>
          </ul>
        ) : null}
        {s && !s.credential_secret_configured ? <Alert type="warning" showIcon message={t("settings.secretMissing")} /> : null}
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-[color:var(--color-border-soft)] p-4">
        <h3 className="m-0 text-base font-bold text-maindark dark:text-white">{t("settings.consent")}</h3>
        <p className="m-0 text-xs text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">{t("settings.consentHint")}</p>
        <Input
          aria-label={t("settings.phone")}
          placeholder="+998901234567"
          value={consent.phone}
          onChange={(event) => setConsent((current) => ({ ...current, phone: event.target.value }))}
        />
        <Select
          aria-label={t("settings.source")}
          value={consent.source}
          onChange={(value) => setConsent((current) => ({ ...current, source: value }))}
          options={(["shartnoma", "veb-forma", "buyurtma", "operator"] as const).map((value) => ({ value, label: t(`sources.${value}`) }))}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="primary" disabled={!consent.phone.trim()} loading={grant.isPending} onClick={() => void consentAction("grant")}>
            {t("settings.grant")}
          </Button>
          <Button danger disabled={!consent.phone.trim()} loading={revoke.isPending} onClick={() => void consentAction("revoke")}>
            {t("settings.revoke")}
          </Button>
        </div>
        {consentFeedback ? <Alert type={consentFeedback.type} showIcon message={consentFeedback.text} /> : null}
      </section>

      {isSuperadmin ? (
        <section className="flex flex-col gap-2 rounded-2xl border border-[color:var(--color-border-soft)] p-4 lg:col-span-2">
          <h3 className="m-0 text-base font-bold text-maindark dark:text-white">{t("settings.accounts")}</h3>
          <p className="m-0 text-xs text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">{t("settings.accountsHint")}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <Select
              aria-label={t("settings.provider")}
              value={account.provider}
              onChange={(value) => setAccount((current) => ({ ...current, provider: value }))}
              options={[{ value: "eskiz", label: "Eskiz" }, { value: "playmobile", label: "Play Mobile" }]}
            />
            <Select
              aria-label={t("settings.profile")}
              value={account.sender_profile}
              onChange={(value) => setAccount((current) => ({ ...current, sender_profile: value }))}
              options={[
                { value: "default", label: t("settings.profileDefault") },
                { value: "otp", label: t("settings.profileOtp") },
              ]}
            />
            <Input aria-label={t("settings.login")} placeholder={t("settings.login")} value={account.login} onChange={(e) => setAccount((c) => ({ ...c, login: e.target.value }))} />
            <Input.Password aria-label={t("settings.password")} placeholder={t("settings.password")} value={account.password} onChange={(e) => setAccount((c) => ({ ...c, password: e.target.value }))} />
            <Input aria-label={t("settings.sender")} placeholder={t("settings.sender")} value={account.sender} onChange={(e) => setAccount((c) => ({ ...c, sender: e.target.value }))} />
          </div>
          <Button
            type="primary"
            className="self-start"
            loading={upsertAccount.isPending}
            disabled={!account.login || !account.password || !account.sender}
            onClick={() => void saveAccount()}
          >
            {t("settings.saveAccount")}
          </Button>
          {accountFeedback ? <Alert type={accountFeedback.type} showIcon message={accountFeedback.text} /> : null}
          <Table<SmsAccount>
            rowKey="id"
            size="small"
            pagination={false}
            loading={accounts.isLoading}
            dataSource={accounts.data ?? []}
            scroll={{ x: "max-content" }}
            columns={[
              { title: t("settings.provider"), dataIndex: "provider" },
              { title: t("settings.profile"), dataIndex: "sender_profile" },
              { title: t("settings.login"), dataIndex: "login" },
              { title: t("settings.sender"), dataIndex: "sender" },
              { title: "", dataIndex: "is_active", render: (v: boolean) => yes(v) },
            ]}
          />
        </section>
      ) : null}
    </div>
  );
};

export default SmsSettingsTab;
