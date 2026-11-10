// dizayn-v2: (maket yo'q) superadmin-payments-shift-settings
import { useId, useMemo, useState, type ReactNode } from "react";
import { Bell, Clock, Info, Plus, Power, Timer, X, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  SHIFT_AUTO_CLOSE_DEFAULT_WARN_MIN,
  SHIFT_AUTO_CLOSE_MAX_TIMES,
  type ShiftAutoCloseScope,
  type ShiftAutoCloseSettings,
  type ShiftAutoOpenSettings,
  type ShiftLateAlertSettings,
} from "../../../entities/payments";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { Button, Card, Field, IconButton, Pressable, Select } from "../../../shared/ui/primitives";
import { SwitchRow } from "../../settings/ui/settingsUi";

/**
 * «Kun tartibi» — smena jadvali kartalari (maket yo'q — eng yaqini `superadmin-payments-shift-settings`, o'sha
 * «Avtomatik yopish» kartasi):
 *  - «Avtomatik ochish» (yangi, `auto_open`) — kalit, kuniga ochish vaqtlari, qaysi kassalarda;
 *  - «Avtomatik yopish» (`auto_close`) — «Smena sozlamalari» sahifasidan ko'chdi (ega 2026-11-10), matni o'sha;
 *  - «Kechikish haqida xabar» (yangi, `late_alert`) — vaqtida ochilmasa / yopilmasa superadminlarga, necha daqiqadan
 *    keyin va qaysi kanallarda.
 * Har karta faqat backend javobida bo'lsa chiziladi (`null` — eski backend).
 */

/** Vaqt tanlovi qadami — 15 daqiqa (00:00, 00:15 … 23:45); backend istalgan `HH:MM` ni qabul qiladi. */
const TIME_STEP_MIN = 15;
const TIME_SLOTS = Array.from({ length: (24 * 60) / TIME_STEP_MIN }, (_, index) => {
  const minutes = index * TIME_STEP_MIN;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});
const MINUTE_OPTIONS = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180];

const CHIP =
  "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border border-border-strong bg-surface pl-3 pr-1.5 text-[13px] font-medium text-text max-md:h-11";
const CHIP_X =
  "inline-flex size-5 items-center justify-center rounded-full text-text-muted hover:text-text max-md:relative max-md:after:absolute max-md:after:-inset-3 max-md:after:content-['']";

const CardTitle = ({ icon: Icon, title }: { icon: LucideIcon; title: string }) => (
  <span className="inline-flex items-center gap-3">
    <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-sunken text-text-muted">
      <Icon aria-hidden="true" size={18} />
    </span>
    {title}
  </span>
);

const CardNote = ({ children }: { children: ReactNode }) => (
  <span className="flex items-start gap-2 text-[13px] text-text-muted">
    <Info aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
    {children}
  </span>
);

/** Kuniga vaqtlar: chiplar («×» — olib tashlash) + «Vaqt qo'shish» (15 daqiqalik tanlov), o'sish tartibida, takrorsiz. */
const TimesField = ({
  label,
  hint,
  error,
  times,
  onChange,
}: {
  label: string;
  hint: string;
  error?: string;
  times: string[];
  onChange: (times: string[]) => void;
}) => {
  const { t } = useTranslation("payments");
  const [adding, setAdding] = useState(false);
  const full = times.length >= SHIFT_AUTO_CLOSE_MAX_TIMES;
  const slotOptions = useMemo(
    () => TIME_SLOTS.filter((slot) => !times.includes(slot)).map((slot) => ({ value: slot, label: slot })),
    [times],
  );
  const addTime = (time: string | null) => {
    setAdding(false);
    if (!time || times.includes(time) || full) return;
    onChange([...times, time].sort());
  };
  return (
    <Field label={label} labelAs="span" hint={hint} error={error}>
      <div className="flex flex-wrap items-center gap-2">
        {times.length ? (
          <ul aria-label={label} className="m-0 flex list-none flex-wrap gap-1.5 p-0">
            {times.map((time) => (
              <li key={time} className={CHIP}>
                <Clock aria-hidden="true" size={14} className="shrink-0 text-text-muted" />
                {time}
                <Pressable
                  className={CHIP_X}
                  aria-label={t("shiftCheck.settings.auto.removeTime", { time })}
                  onClick={() => onChange(times.filter((item) => item !== time))}
                >
                  <X aria-hidden="true" size={14} />
                </Pressable>
              </li>
            ))}
          </ul>
        ) : null}
        {adding ? (
          <span className="inline-flex items-center gap-1.5">
            <Select
              className="w-36"
              size="sm"
              icon={Clock}
              options={slotOptions}
              value={null}
              searchable
              defaultOpen
              placeholder={t("shiftCheck.settings.auto.pickTime")}
              listLabel={t("shiftCheck.settings.auto.pickTime")}
              onChange={(slot) => addTime(slot)}
            />
            <IconButton
              icon={X}
              size="sm"
              variant="ghost"
              label={t("shiftCheck.settings.auto.cancelAdd")}
              onClick={() => setAdding(false)}
            />
          </span>
        ) : (
          <Button variant="secondary" size="sm" leftIcon={Plus} disabled={full} onClick={() => setAdding(true)}>
            {t("shiftCheck.settings.auto.addTime")}
          </Button>
        )}
      </div>
    </Field>
  );
};

/** Qaysi kassalarda: faqat asosiy kassa | asosiy + filial kassalari (backend `scope`). */
const ScopeField = ({
  legend,
  value,
  onChange,
}: {
  legend: string;
  value: ShiftAutoCloseScope;
  onChange: (scope: ShiftAutoCloseScope) => void;
}) => {
  const { t } = useTranslation("payments");
  const name = useId();
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend className="mb-2 p-0 text-[13px] font-semibold text-text">{legend}</legend>
      <div className="grid gap-x-4 gap-y-2 [grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))]">
        {(["main", "main+branches"] as const).map((scope) => (
          <label key={scope} className="flex min-h-6 cursor-pointer items-center gap-2.5 text-sm text-text max-md:min-h-11">
            <input
              type="radio"
              name={name}
              className="size-[18px] accent-action"
              checked={value === scope}
              onChange={() => onChange(scope)}
            />
            <span>{t(`shiftCheck.settings.auto.scopes.${scope === "main" ? "main" : "branches"}`)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
};

/** Vaqtlar xatosi: yoqilgan, lekin vaqt yo'q yoki vaqt ham ochish, ham yopishda. */
export type TimesError = "required" | "conflict";

export const AutoOpenCard = ({
  value,
  onChange,
  timesError,
  conflicts,
}: {
  value: ShiftAutoOpenSettings;
  onChange: (next: ShiftAutoOpenSettings) => void;
  timesError?: TimesError;
  /** Yopishda ham bor vaqtlar (`conflict` matni uchun). */
  conflicts: string[];
}) => {
  const { t, i18n } = useTranslation(["ops", "payments"]);
  const language = i18n.resolvedLanguage ?? i18n.language;
  return (
    <Card
      padding="none"
      className="min-w-0"
      title={<CardTitle icon={Timer} title={t("dailySchedule.open.title")} />}
      description={t("dailySchedule.open.subtitle")}
      divided
      footer={<CardNote>{t("dailySchedule.open.note")}</CardNote>}
    >
      <SwitchRow
        title={t("dailySchedule.open.enabled")}
        hint={t("dailySchedule.open.enabledHint")}
        checked={value.enabled}
        onToggle={(next) => onChange({ ...value, enabled: next })}
      />
      <div className="flex flex-col gap-5 border-t border-border px-5 py-4 max-md:px-4">
        <TimesField
          label={t("dailySchedule.open.times")}
          // «Kuniga N marta» — yopish kartasidagi bilan bir xil matn (ko'plik shakllari payments'da: en / ru).
          hint={t("payments:shiftCheck.settings.auto.timesHint", {
            count: value.times.length,
            value: formatNumberLocalized(value.times.length, { language }),
          })}
          error={
            timesError === "required"
              ? t("dailySchedule.open.timesRequired")
              : timesError === "conflict"
                ? t("dailySchedule.timesConflict", { times: conflicts.join(", ") })
                : undefined
          }
          times={value.times}
          onChange={(times) => onChange({ ...value, times })}
        />
        <ScopeField
          legend={t("dailySchedule.open.scope")}
          value={value.scope}
          onChange={(scope) => onChange({ ...value, scope })}
        />
      </div>
    </Card>
  );
};

/**
 * «Avtomatik yopish» — «Smena sozlamalari»dan ko'chgan karta (y8Tqm9Ap): matn va xatti-harakat o'zgarmagan. Izoh
 * «keyingi smenani kim ochadi» — backend `auto_open` bersa «kassir yoki tizim», bermasa avvalgidek «kassir o'zi».
 */
export const AutoCloseCard = ({
  value,
  onChange,
  timesError,
  conflicts,
  autoOpenSupported,
}: {
  value: ShiftAutoCloseSettings;
  onChange: (next: ShiftAutoCloseSettings) => void;
  timesError?: TimesError;
  conflicts: string[];
  /** Backend «Avtomatik ochish»ni qo'llaydi (`auto_open` javobda bor). */
  autoOpenSupported: boolean;
}) => {
  const { t, i18n } = useTranslation(["payments", "ops"]);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const warnOn = value.warn_before_min > 0;
  // Ogohlantirish o'chirilib qayta yoqilsa — oxirgi tanlangan daqiqa qaytadi.
  const [lastWarn, setLastWarn] = useState(warnOn ? value.warn_before_min : SHIFT_AUTO_CLOSE_DEFAULT_WARN_MIN);
  const warnOptions = useMemo(
    () =>
      [...new Set([...MINUTE_OPTIONS, lastWarn])]
        .sort((a, b) => a - b)
        .map((minutes) => ({
          value: String(minutes),
          label: t("payments:shiftCheck.settings.auto.warnMinutes", {
            count: minutes,
            value: formatNumberLocalized(minutes, { language }),
          }),
        })),
    [language, lastWarn, t],
  );
  const setWarn = (raw: string | null) => {
    const minutes = Number(raw);
    if (!Number.isInteger(minutes) || minutes <= 0) return;
    setLastWarn(minutes);
    onChange({ ...value, warn_before_min: minutes });
  };

  return (
    <Card
      padding="none"
      className="min-w-0"
      title={<CardTitle icon={Power} title={t("payments:shiftCheck.settings.auto.title")} />}
      description={t("payments:shiftCheck.settings.auto.subtitle")}
      divided
      footer={
        <CardNote>
          {autoOpenSupported
            ? t("payments:shiftCheck.settings.auto.noteAutoOpen")
            : t("payments:shiftCheck.settings.auto.note")}
        </CardNote>
      }
    >
      <SwitchRow
        title={t("payments:shiftCheck.settings.auto.enabled")}
        hint={t("payments:shiftCheck.settings.auto.enabledHint")}
        checked={value.enabled}
        onToggle={(next) => onChange({ ...value, enabled: next })}
      />
      <div className="flex flex-col gap-5 border-t border-border px-5 py-4 max-md:px-4">
        <TimesField
          label={t("payments:shiftCheck.settings.auto.times")}
          hint={t("payments:shiftCheck.settings.auto.timesHint", {
            count: value.times.length,
            value: formatNumberLocalized(value.times.length, { language }),
          })}
          error={
            timesError === "required"
              ? t("payments:shiftCheck.settings.auto.timesRequired")
              : timesError === "conflict"
                ? t("ops:dailySchedule.timesConflict", { times: conflicts.join(", ") })
                : undefined
          }
          times={value.times}
          onChange={(times) => onChange({ ...value, times })}
        />
        <ScopeField
          legend={t("payments:shiftCheck.settings.auto.scope")}
          value={value.scope}
          onChange={(scope) => onChange({ ...value, scope })}
        />
      </div>
      <div className="border-t border-border">
        <SwitchRow
          title={
            warnOn
              ? t("payments:shiftCheck.settings.auto.warn", {
                  count: value.warn_before_min,
                  value: formatNumberLocalized(value.warn_before_min, { language }),
                })
              : t("payments:shiftCheck.settings.auto.warnOff")
          }
          hint={t("payments:shiftCheck.settings.auto.warnHint")}
          checked={warnOn}
          onToggle={(next) => onChange({ ...value, warn_before_min: next ? lastWarn : 0 })}
        />
        {warnOn ? (
          <div className="px-5 pb-4 max-md:px-4">
            <Field label={t("payments:shiftCheck.settings.auto.warnBefore")} labelAs="span" className="max-w-60">
              <Select
                size="sm"
                options={warnOptions}
                value={String(value.warn_before_min)}
                onChange={(minutes) => setWarn(minutes)}
              />
            </Field>
          </div>
        ) : null}
      </div>
    </Card>
  );
};

export const LateAlertCard = ({
  value,
  onChange,
  channelsError,
}: {
  value: ShiftLateAlertSettings;
  onChange: (next: ShiftLateAlertSettings) => void;
  /** Yoqilgan, lekin birorta kanal tanlanmagan. */
  channelsError?: boolean;
}) => {
  const { t, i18n } = useTranslation(["ops", "payments"]);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const errorId = useId();
  const graceOptions = useMemo(
    () =>
      [...new Set([...MINUTE_OPTIONS, value.grace_min])]
        .sort((a, b) => a - b)
        .map((minutes) => ({
          value: String(minutes),
          label: t("dailySchedule.late.graceMinutes", {
            count: minutes,
            value: formatNumberLocalized(minutes, { language }),
          }),
        })),
    [language, t, value.grace_min],
  );
  const setGrace = (raw: string | null) => {
    const minutes = Number(raw);
    if (!Number.isInteger(minutes) || minutes < 0) return;
    onChange({ ...value, grace_min: minutes });
  };
  const setChannel = (channel: "telegram" | "in_app", next: boolean) =>
    onChange({ ...value, channels: { ...value.channels, [channel]: next } });

  return (
    <Card
      padding="none"
      className="min-w-0"
      title={<CardTitle icon={Bell} title={t("dailySchedule.late.title")} />}
      description={t("dailySchedule.late.subtitle")}
      divided
      footer={<CardNote>{t("dailySchedule.late.note")}</CardNote>}
    >
      <SwitchRow
        title={t("dailySchedule.late.enabled")}
        hint={t("dailySchedule.late.enabledHint")}
        checked={value.enabled}
        onToggle={(next) => onChange({ ...value, enabled: next })}
      />
      <div className="flex flex-col gap-5 border-t border-border px-5 py-4 max-md:px-4">
        <Field
          label={t("dailySchedule.late.grace")}
          labelAs="span"
          hint={t("dailySchedule.late.graceHint")}
          className="max-w-60"
        >
          <Select size="sm" options={graceOptions} value={String(value.grace_min)} onChange={setGrace} />
        </Field>
        <fieldset
          className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0"
          aria-describedby={channelsError ? errorId : undefined}
        >
          <legend className="mb-2 p-0 text-[13px] font-semibold text-text">
            {t("dailySchedule.late.channels")}
          </legend>
          <div className="grid gap-x-4 gap-y-2 [grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))]">
            {(["telegram", "in_app"] as const).map((channel) => (
              <label
                key={channel}
                className="flex min-h-6 cursor-pointer items-center gap-2.5 text-sm text-text max-md:min-h-11"
              >
                <input
                  type="checkbox"
                  className="size-[18px] accent-action"
                  checked={value.channels[channel]}
                  onChange={(event) => setChannel(channel, event.target.checked)}
                />
                {/* Kanal nomlari — smena hisobotidagi bilan bir xil («Telegram» / «Tizim»). */}
                <span>{t(`payments:shiftCheck.settings.report.channels.${channel}`)}</span>
              </label>
            ))}
          </div>
          {channelsError ? (
            <p id={errorId} className="m-0 text-[13px] text-danger-fg">
              {t("dailySchedule.late.channelsRequired")}
            </p>
          ) : null}
        </fieldset>
      </div>
    </Card>
  );
};
