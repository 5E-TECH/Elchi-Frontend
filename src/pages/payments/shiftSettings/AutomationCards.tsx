// dizayn-v2: superadmin-payments-shift-settings
import { useId, useMemo, useState } from "react";
import { Bell, Clock, Crown, Info, Plus, Power, Send, Store, Truck, X, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  SHIFT_AUTO_CLOSE_DEFAULT_WARN_MIN,
  SHIFT_AUTO_CLOSE_MAX_TIMES,
  SHIFT_REPORT_RECIPIENT_GROUPS,
  type ShiftAutoCloseScope,
  type ShiftAutoCloseSettings,
  type ShiftReportChannels,
  type ShiftReportFormat,
  type ShiftReportRecipientGroup,
  type ShiftReportSendSettings,
} from "../../../entities/payments";
import { cx } from "../../../shared/lib/cx";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import {
  Button,
  Card,
  DataTable,
  Field,
  IconButton,
  Pressable,
  SegmentedControl,
  Select,
  type DataTableColumn,
} from "../../../shared/ui/primitives";
import { SwitchRow } from "../../settings/ui/settingsUi";
import { CellSwitch } from "./CellSwitch";

/**
 * Maket `superadmin-payments-shift-settings` ning pastki ikki kartasi (y8Tqm9Ap, gWI4gYkw):
 *  - «Avtomatik yopish» — kalit, kuniga yopish vaqtlari (chiplar + «Vaqt qo'shish», Toshkent vaqti), qaysi kassalarda
 *    (backend `scope`: faqat asosiy kassa | asosiy + filiallar — maketdagi har kassa belgisi o'rniga ikki variant),
 *    yopishdan N daqiqa oldin ogohlantirish (0 — o'chiq);
 *  - «Smena hisobotini yuborish» — superadmin / kuryerlar / marketlar × Telegram / tizim kalitlari va ilova formati
 *    (PDF | Excel). Saqlash — sahifadagi yagona «Saqlash» (`PATCH finance/shift/settings`, faqat o'zgarganlar).
 */

/** Vaqt tanlovi qadami — 15 daqiqa (00:00, 00:15 … 23:45); backend istalgan `HH:MM` ni qabul qiladi. */
const TIME_STEP_MIN = 15;
const TIME_SLOTS = Array.from({ length: (24 * 60) / TIME_STEP_MIN }, (_, index) => {
  const minutes = index * TIME_STEP_MIN;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});
const WARN_OPTIONS = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180];

const CHIP =
  "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border border-border-strong bg-surface pl-3 pr-1.5 text-[13px] font-medium text-text max-md:h-11";
const CHIP_X =
  "inline-flex size-5 items-center justify-center rounded-full text-text-muted hover:text-text max-md:relative max-md:after:absolute max-md:after:-inset-3 max-md:after:content-['']";

const IconBox = ({ icon: Icon }: { icon: LucideIcon }) => (
  <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-sunken text-text-muted">
    <Icon aria-hidden="true" size={18} />
  </span>
);

const CardTitle = ({ icon, title }: { icon: LucideIcon; title: string }) => (
  <span className="inline-flex items-center gap-3">
    <IconBox icon={icon} />
    {title}
  </span>
);

export const AutoCloseCard = ({
  value,
  onChange,
  timesError,
}: {
  value: ShiftAutoCloseSettings;
  onChange: (next: ShiftAutoCloseSettings) => void;
  /** Yoqilgan, lekin vaqt yo'q — «Saqlash» o'chiq. */
  timesError?: boolean;
}) => {
  const { t, i18n } = useTranslation("payments");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const [adding, setAdding] = useState(false);
  const scopeName = useId();
  const full = value.times.length >= SHIFT_AUTO_CLOSE_MAX_TIMES;
  const warnOn = value.warn_before_min > 0;
  // Ogohlantirish o'chirilib qayta yoqilsa — oxirgi tanlangan daqiqa qaytadi.
  const [lastWarn, setLastWarn] = useState(warnOn ? value.warn_before_min : SHIFT_AUTO_CLOSE_DEFAULT_WARN_MIN);

  const slotOptions = useMemo(
    () => TIME_SLOTS.filter((slot) => !value.times.includes(slot)).map((slot) => ({ value: slot, label: slot })),
    [value.times],
  );
  const warnOptions = useMemo(
    () =>
      [...new Set([...WARN_OPTIONS, lastWarn])]
        .sort((a, b) => a - b)
        .map((minutes) => ({
          value: String(minutes),
          label: t("shiftCheck.settings.auto.warnMinutes", { count: minutes, value: formatNumberLocalized(minutes, { language }) }),
        })),
    [language, lastWarn, t],
  );

  const addTime = (time: string | null) => {
    setAdding(false);
    if (!time || value.times.includes(time) || full) return;
    onChange({ ...value, times: [...value.times, time].sort() });
  };
  const removeTime = (time: string) => onChange({ ...value, times: value.times.filter((item) => item !== time) });
  const setScope = (scope: ShiftAutoCloseScope) => onChange({ ...value, scope });
  const toggleWarn = (next: boolean) => onChange({ ...value, warn_before_min: next ? lastWarn : 0 });
  const setWarn = (raw: string | null) => {
    const minutes = Number(raw);
    if (!Number.isInteger(minutes) || minutes <= 0) return;
    setLastWarn(minutes);
    onChange({ ...value, warn_before_min: minutes });
  };

  return (
    <Card
      padding="none"
      className="min-w-0 flex-[1_1_400px]"
      title={<CardTitle icon={Power} title={t("shiftCheck.settings.auto.title")} />}
      description={t("shiftCheck.settings.auto.subtitle")}
      divided
      footer={
        <span className="flex items-start gap-2 text-[13px] text-text-muted">
          <Info aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
          {t("shiftCheck.settings.auto.note")}
        </span>
      }
    >
      <SwitchRow
        title={t("shiftCheck.settings.auto.enabled")}
        hint={t("shiftCheck.settings.auto.enabledHint")}
        checked={value.enabled}
        onToggle={(next) => onChange({ ...value, enabled: next })}
      />
      <div className="flex flex-col gap-5 border-t border-border px-5 py-4 max-md:px-4">
        <Field
          label={t("shiftCheck.settings.auto.times")}
          labelAs="span"
          hint={t("shiftCheck.settings.auto.timesHint", {
            count: value.times.length,
            value: formatNumberLocalized(value.times.length, { language }),
          })}
          error={timesError ? t("shiftCheck.settings.auto.timesRequired") : undefined}
        >
          <div className="flex flex-wrap items-center gap-2">
            {value.times.length ? (
              <ul aria-label={t("shiftCheck.settings.auto.times")} className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                {value.times.map((time) => (
                  <li key={time} className={CHIP}>
                    <Clock aria-hidden="true" size={14} className="shrink-0 text-text-muted" />
                    {time}
                    <Pressable
                      className={CHIP_X}
                      aria-label={t("shiftCheck.settings.auto.removeTime", { time })}
                      onClick={() => removeTime(time)}
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

        <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
          <legend className="mb-2 p-0 text-[13px] font-semibold text-text">{t("shiftCheck.settings.auto.scope")}</legend>
          <div className="grid gap-x-4 gap-y-2 [grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))]">
            {(["main", "main+branches"] as const).map((scope) => (
              <label key={scope} className="flex min-h-6 cursor-pointer items-center gap-2.5 text-sm text-text max-md:min-h-11">
                <input
                  type="radio"
                  name={scopeName}
                  className="size-[18px] accent-action"
                  checked={value.scope === scope}
                  onChange={() => setScope(scope)}
                />
                <span>{t(`shiftCheck.settings.auto.scopes.${scope === "main" ? "main" : "branches"}`)}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <div className="border-t border-border">
        <SwitchRow
          title={
            warnOn
              ? t("shiftCheck.settings.auto.warn", {
                  count: value.warn_before_min,
                  value: formatNumberLocalized(value.warn_before_min, { language }),
                })
              : t("shiftCheck.settings.auto.warnOff")
          }
          hint={t("shiftCheck.settings.auto.warnHint")}
          checked={warnOn}
          onToggle={toggleWarn}
        />
        {warnOn ? (
          <div className="px-5 pb-4 max-md:px-4">
            <Field label={t("shiftCheck.settings.auto.warnBefore")} labelAs="span" className="max-w-60">
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

const GROUP_ICON: Record<ShiftReportRecipientGroup, LucideIcon> = {
  superadmin: Crown,
  couriers: Truck,
  markets: Store,
};

export const ReportSendCard = ({
  value,
  onChange,
}: {
  value: ShiftReportSendSettings;
  onChange: (next: ShiftReportSendSettings) => void;
}) => {
  const { t } = useTranslation("payments");
  const setChannel = (group: ShiftReportRecipientGroup, channel: keyof ShiftReportChannels, next: boolean) =>
    onChange({
      ...value,
      recipients: { ...value.recipients, [group]: { ...value.recipients[group], [channel]: next } },
    });

  const groupName = (group: ShiftReportRecipientGroup) => (
    <span className="flex min-w-0 items-center gap-3">
      <IconBox icon={GROUP_ICON[group]} />
      <span className="flex min-w-0 flex-col">
        <span className="font-semibold text-text">{t(`shiftCheck.settings.report.groups.${group}`)}</span>
        <span className="text-[13px] text-text-muted">{t(`shiftCheck.settings.report.groupHints.${group}`)}</span>
      </span>
    </span>
  );
  const channelSwitch = (group: ShiftReportRecipientGroup, channel: keyof ShiftReportChannels) => (
    <CellSwitch
      checked={value.recipients[group][channel]}
      label={t(`shiftCheck.settings.report.switch.${channel}`, { group: t(`shiftCheck.settings.report.groups.${group}`) })}
      onToggle={(next) => setChannel(group, channel, next)}
    />
  );
  const channelHeader = (channel: keyof ShiftReportChannels) => {
    const Icon = channel === "telegram" ? Send : Bell;
    return (
      <span className="inline-flex items-center gap-1.5">
        <Icon aria-hidden="true" size={14} />
        {t(`shiftCheck.settings.report.channels.${channel}`)}
      </span>
    );
  };

  const columns: DataTableColumn<ShiftReportRecipientGroup>[] = [
    { id: "group", header: t("shiftCheck.settings.report.recipient"), cell: groupName },
    { id: "telegram", header: channelHeader("telegram"), cell: (group) => channelSwitch(group, "telegram") },
    { id: "in_app", header: channelHeader("in_app"), cell: (group) => channelSwitch(group, "in_app") },
  ];

  return (
    <Card
      padding="none"
      className="min-w-0 flex-[1_1_400px]"
      title={<CardTitle icon={Send} title={t("shiftCheck.settings.report.title")} />}
      description={t("shiftCheck.settings.report.subtitle")}
      divided
    >
      <DataTable
        rows={[...SHIFT_REPORT_RECIPIENT_GROUPS]}
        columns={columns}
        getRowKey={(group) => group}
        label={t("shiftCheck.settings.report.label")}
        cardsLabel={t("shiftCheck.settings.report.label")}
        renderCard={(group) => (
          <div className="flex flex-col gap-1 px-4 py-3">
            {groupName(group)}
            {(["telegram", "in_app"] as const).map((channel) => (
              <span key={channel} className="flex min-h-11 items-center justify-between gap-3 text-[13px] text-text">
                {channelHeader(channel)}
                {channelSwitch(group, channel)}
              </span>
            ))}
          </div>
        )}
      />
      <div className="flex flex-col gap-4 border-t border-border px-5 py-4 max-md:px-4">
        <Field label={t("shiftCheck.settings.report.format")} labelAs="span" hint={t("shiftCheck.settings.report.formatHint")}>
          <SegmentedControl<ShiftReportFormat>
            ariaLabel={t("shiftCheck.settings.report.format")}
            className="self-start"
            fullWidth={false}
            options={[
              { value: "pdf", label: "PDF" },
              { value: "xlsx", label: "Excel" },
            ]}
            value={value.format}
            onValueChange={(format) => onChange({ ...value, format })}
          />
        </Field>
        <p className={cx("m-0 flex items-start gap-2 rounded-xl bg-sunken px-3.5 py-3 text-[13px] text-text-muted")}>
          <Info aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
          <span>{t("shiftCheck.settings.report.note")}</span>
        </p>
      </div>
    </Card>
  );
};
