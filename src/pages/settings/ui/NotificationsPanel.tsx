// dizayn-v2: common-settings-notifications, common-settings-notifications-pwa
import { useId, useState, type ReactNode } from "react";
import { ArrowRight, Clock, Info, ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  NOTIFICATION_CHANNEL_IDS,
  type AppSettings,
  type AppSettingsPatch,
  type NotificationChannelId,
} from "../../../entities/settings";
import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
} from "../../../entities/notification-inbox";
import { PushPermissionButton } from "../../../features/push-notifications";
import { AppInstallStatusBlock } from "../../../features/pwa-install";
import { buttonClasses, Card, Field, TextInput } from "../../../shared/ui/primitives";
import { SectionHead, SwitchList, SwitchRow } from "./settingsUi";

/** Marketing alohida blokda ("Reklama va aksiyalar") — opt-out ko'zga tashlansin. */
const SERVICE_CATEGORIES = NOTIFICATION_CATEGORIES.filter(
  (category): category is Exclude<NotificationCategory, "marketing"> => category !== "marketing",
);

const CLOCK_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Karta: sarlavha + izoh (`.el-card-pad`), so'ng kalitlar ro'yxati. */
const SwitchCard = ({
  title,
  hint,
  children,
  testId,
}: {
  title: string;
  hint: string;
  children: ReactNode;
  testId?: string;
}) => {
  const headId = useId();
  return (
    <Card padding="none" data-testid={testId} aria-labelledby={headId}>
      <div className="p-5 max-md:p-4">
        <SectionHead id={headId} title={title} hint={hint} />
      </div>
      <SwitchList labelledBy={headId}>{children}</SwitchList>
    </Card>
  );
};

/** «2215» / «22:15» → «22:15»; yozilayotgan qism («2», «22:1») o'zgarishsiz qoladi. */
const toClockDraft = (raw: string) => {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
};

/**
 * Sokin soat maydoni — `HH:mm`, 24 soatlik, Toshkent vaqti. Brauzerning `type="time"` maydoni EMAS: u brauzer
 * tiliga qarab «10:00 PM» ko'rsatardi (eski antd `TimePicker` — doim «22:00»). Raqam yoziladi, «:» o'zi qo'yiladi;
 * to'liq va o'zgargan qiymat — `onCommit`, noto'g'ri qiymat maydondan chiqqanda saqlangan qiymatga qaytadi.
 */
const QuietTimeField = ({
  label,
  value,
  disabled,
  onCommit,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onCommit: (value: string) => void;
}) => {
  const [draft, setDraft] = useState(value);
  // Saqlangan qiymat o'zgarsa (server, boshqa tab) — qoralama unga tenglashadi (effektsiz, render paytida).
  const [synced, setSynced] = useState(value);
  if (synced !== value) {
    setSynced(value);
    setDraft(value);
  }
  return (
    <Field label={label} disabled={disabled} className="w-40 max-md:w-full max-md:flex-1">
      <TextInput
        icon={Clock}
        inputMode="numeric"
        autoComplete="off"
        maxLength={5}
        placeholder="22:00"
        value={draft}
        onValueChange={(next) => {
          const formatted = toClockDraft(next);
          setDraft(formatted);
          if (CLOCK_TIME.test(formatted) && formatted !== value) onCommit(formatted);
        }}
        onBlur={() => {
          if (!CLOCK_TIME.test(draft)) setDraft(value);
        }}
      />
    </Field>
  );
};

/**
 * «BILDIRISHNOMALAR» — maket `common-settings-notifications`: «Qurilma bildirishnomalari» (push kaliti, brauzer
 * ruxsati, bloklanganda yo'riqnoma — `PushPermissionButton variant="switch"`), pastida «Qutini ochish»; so'ng «Ilova»
 * kartasi (maket `common-settings-notifications-pwa`, KI-2) — o'rnatish holati `AppInstallStatusBlock` (4 holat).
 *
 * Maketda yo'q, lekin kodda bor bo'limlar (kanallar, kategoriyalar, reklama, sokin soatlar — e2e
 * `settings-notifications.*`) — spec §10 savol 3 sukuti: saqlanadi, qurilma blokidan keyin maket kartalari
 * uslubida. ⚠️ Backend xabar yuborishda bu tanlovlarni hali O'QIMAYDI — ochiq ogohlantirish
 * (`notifications-scope-notice`) majburiy; filtr chiqqach olib tashlanadi.
 */
export const NotificationsPanel = ({
  settings,
  persist,
}: {
  settings: AppSettings["notifications"];
  persist: (patch: AppSettingsPatch) => void;
}) => {
  const { t } = useTranslation(["settings", "notifications"]);
  const muted = new Set(settings.muted_categories);
  const quiet = settings.quiet_hours;
  const deviceHeadId = useId();
  const appHeadId = useId();

  const onChannel = (id: NotificationChannelId, on: boolean) =>
    persist({ notifications: { channels: { [id]: on } } });
  // Kalit "olaman" ma'nosida: o'chirilsa — kategoriya ovozi o'chiriladi.
  const onCategory = (category: NotificationCategory, receive: boolean) =>
    persist({ notifications: { mute: { [category]: !receive } } });

  return (
    <div className="flex flex-col gap-4">
      <Card padding="none" aria-labelledby={deviceHeadId}>
        <div className="flex flex-col gap-4 p-5 max-md:p-4">
          <SectionHead
            id={deviceHeadId}
            title={t("settings:notifications.device_title")}
            hint={t("settings:notifications.device_hint")}
          />
          <PushPermissionButton variant="switch" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border px-5 py-3 max-md:flex-col max-md:items-start max-md:px-4">
          <span className="text-[13px] text-text-muted">{t("settings:notifications.footer")}</span>
          <Link
            to="/inbox"
            className={buttonClasses({ variant: "link", className: "-ml-1 max-md:min-h-11" })}
          >
            {t("settings:notifications.open_inbox")}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </Card>

      <Card padding="none" aria-labelledby={appHeadId} data-testid="settings-app-install">
        <div className="flex flex-col gap-4 p-5 max-md:p-4">
          <SectionHead
            id={appHeadId}
            title={t("settings:notifications.app_title")}
            hint={t("settings:notifications.app_hint")}
          />
          <AppInstallStatusBlock />
        </div>
      </Card>

      <div
        role="note"
        data-testid="notifications-scope-notice"
        className="flex items-start gap-3 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning-fg"
      >
        <Info size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="font-bold">{t("settings:notifications.scope_title")}</p>
          <p className="mt-1 text-[13px] text-text">{t("settings:notifications.scope_body")}</p>
        </div>
      </div>

      <SwitchCard
        title={t("settings:notifications.channels_title")}
        hint={t("settings:notifications.channels_hint")}
      >
        {NOTIFICATION_CHANNEL_IDS.map((id) => (
          <li key={id}>
            <SwitchRow
              title={t(`settings:notifications.channel_${id}`)}
              hint={t(`settings:notifications.channel_${id}_hint`)}
              checked={settings.channels[id]}
              onToggle={(on) => onChannel(id, on)}
            />
          </li>
        ))}
      </SwitchCard>

      <SwitchCard
        title={t("settings:notifications.categories_title")}
        hint={t("settings:notifications.categories_hint")}
      >
        <li>
          <SwitchRow
            title={t("settings:notifications.critical")}
            hint={t("settings:notifications.critical_hint")}
            checked
            disabled
            onToggle={() => undefined}
            addon={<ShieldAlert size={16} aria-hidden="true" className="text-danger-fg" />}
          />
        </li>
        {SERVICE_CATEGORIES.map((category) => (
          <li key={category}>
            <SwitchRow
              title={t(`notifications:category.${category}`)}
              checked={!muted.has(category)}
              onToggle={(receive) => onCategory(category, receive)}
            />
          </li>
        ))}
      </SwitchCard>

      <SwitchCard
        testId="notifications-marketing"
        title={t("settings:notifications.marketing_title")}
        hint={t("settings:notifications.marketing_hint")}
      >
        <li>
          <SwitchRow
            title={t("settings:notifications.marketing_toggle")}
            hint={t("settings:notifications.marketing_toggle_hint")}
            checked={!muted.has("marketing")}
            onToggle={(receive) => onCategory("marketing", receive)}
          />
        </li>
      </SwitchCard>

      <SwitchCard
        title={t("settings:notifications.quiet_title")}
        hint={t("settings:notifications.quiet_hint")}
      >
        <li>
          <SwitchRow
            title={t("settings:notifications.quiet_enabled")}
            checked={quiet.enabled}
            onToggle={(enabled) => persist({ notifications: { quiet_hours: { enabled } } })}
          />
        </li>
        <li className="flex flex-wrap items-end gap-4 px-5 py-4 max-md:px-4">
          {(["from", "to"] as const).map((key) => (
            <QuietTimeField
              key={key}
              label={t(`settings:notifications.quiet_${key}`)}
              value={quiet[key]}
              disabled={!quiet.enabled}
              onCommit={(value) => persist({ notifications: { quiet_hours: { [key]: value } } })}
            />
          ))}
          <span className="pb-2.5 text-[13px] font-semibold text-text-muted max-md:w-full max-md:pb-0">
            {t("settings:notifications.quiet_timezone")}
          </span>
        </li>
      </SwitchCard>
    </div>
  );
};
