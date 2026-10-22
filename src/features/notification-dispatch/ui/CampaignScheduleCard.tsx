// dizayn-v2: superadmin-notifications-send-schedule, superadmin-notifications-send-states
import { CalendarClock, Clock, Globe, Moon } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DEFAULT_MAX_SCHEDULE_DAYS,
  firstAvailableSlot,
  isFutureSlot,
  isQuietTime,
  quietReleaseMoment,
  scheduleDayRange,
  scheduleTimeSlots,
  shiftDay,
  tashkentToday,
  toTashkentMoment,
  useCampaignTime,
  useClock,
  type CampaignSchedulePolicy,
} from "../../../entities/notification-campaign";
import { NoticeAlert } from "../../../entities/notification";
import { cx } from "../../../shared/lib/cx";
import { Badge, Card, DateInput, Field, Select, type SelectOption } from "../../../shared/ui/primitives";
import type { CampaignScheduleValue, CampaignSendWhen } from "../model/schema";
import { CHOICE_CARD, CHOICE_INPUT } from "./choiceCard";

export type CampaignScheduleErrors = { day?: string; time?: string };

export type CampaignScheduleCardProps = {
  value: CampaignScheduleValue;
  onChange: (value: CampaignScheduleValue) => void;
  /** Kategoriya reklama (`marketing`) — tungi taqiq soatlari tanlanmaydi. */
  promo: boolean;
  /** `GET schedule-policy` (taqiq oynasi va 90 kun chegarasi); kelguncha soatlar «yuklanmoqda». */
  policy: CampaignSchedulePolicy | undefined;
  policyLoading: boolean;
  errors?: CampaignScheduleErrors;
  disabled?: boolean;
  /** Joriy lahza (forma bilan bir soat) — sukut o'z soati (`useClock`). */
  now?: number;
};

/** Ma'qul sukut soat (maket: «10:00»); band bo'lsa — kunning birinchi bo'sh soati. */
const PREFERRED_TIME = "10:00";


/**
 * «YUBORISH VAQTI» (KM-3, maketlar `superadmin-notifications-send-schedule`, `-send-states`): Darhol · Belgilangan
 * vaqtda (radio kartalar). Belgilangan vaqtda — «Sana» (bugundan `max_schedule_days` gacha) va «Soat» (30 daqiqa
 * qadam; bugun o'tgan soatlar yo'q; reklamada taqiq soatlari o'chiq — «Reklama taqiqi»). Vaqt doim Toshkent vaqti
 * («Toshkent vaqti» belgisi, «UTC+5» izohi). Reklamada — taqiq izohi; «Darhol» kechqurun bosilsa — qachon ketishi
 * (sariq). Tanlangan vaqt — «Ertaga, 10:00 da yuboriladi» (ko'k).
 */
export const CampaignScheduleCard = ({
  value,
  onChange,
  promo,
  policy,
  policyLoading,
  errors = {},
  disabled = false,
  now: nowProp,
}: CampaignScheduleCardProps) => {
  const { t } = useTranslation("notifications");
  const clock = useClock();
  const now = nowProp ?? clock;
  const time = useCampaignTime();
  const quiet = policy?.quietHours ?? null;
  const quietActive = promo && Boolean(quiet?.enabled);
  const maxDays = policy?.maxScheduleDays ?? DEFAULT_MAX_SCHEDULE_DAYS;
  const range = scheduleDayRange(maxDays, now);
  const scheduled = value.when === "scheduled";

  const pickSlot = (day: string, preferred: string) => {
    const allowed = (slot: string) => isFutureSlot(day, slot, now) && !(promo && isQuietTime(slot, quiet));
    return preferred && allowed(preferred) ? preferred : (firstAvailableSlot(day, { quiet, promo, now }) ?? "");
  };

  const setWhen = (when: CampaignSendWhen) => {
    if (when === "now") {
      onChange({ ...value, when });
      return;
    }
    // Birinchi tanlovda — ertaga 10:00 (maketdagidek); avval tanlangan bo'lsa — o'sha.
    const day = value.day || shiftDay(tashkentToday(now), 1);
    onChange({ when, day, time: value.time || pickSlot(day, PREFERRED_TIME) });
  };

  const setDay = (day: string) =>
    onChange({ ...value, day, time: day ? pickSlot(day, value.time || PREFERRED_TIME) : value.time });

  const today = tashkentToday(now);
  const slots: SelectOption[] = scheduleTimeSlots()
    // Bugun — o'tgan soatlar ro'yxatda yo'q.
    .filter((slot) => value.day !== today || isFutureSlot(value.day, slot, now))
    .map((slot) => ({ value: slot, label: slot, disabled: quietActive && isQuietTime(slot, quiet) }));

  const release = !scheduled && quietActive ? quietReleaseMoment(quiet, now) : null;
  const chosen =
    scheduled && value.day && value.time && !errors.day && !errors.time && isFutureSlot(value.day, value.time, now)
      ? time.moment({ day: value.day, time: value.time }, now)
      : null;

  return (
    <Card
      title={t("campaign.schedule.title")}
      actions={
        <Badge icon={Globe} tone="neutral">
          {t("campaign.schedule.tashkent")}
        </Badge>
      }
      bodyClassName="flex flex-col gap-4"
      data-testid="campaign-schedule"
    >
      <div
        role="radiogroup"
        aria-label={t("campaign.schedule.title")}
        className="grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-2"
      >
        {(["now", "scheduled"] as const).map((when) => (
          <label key={when} className={cx(CHOICE_CARD, "items-start")}>
            <input
              type="radio"
              name="campaign-send-when"
              value={when}
              checked={value.when === when}
              disabled={disabled}
              aria-describedby={`campaign-when-${when}-hint`}
              onChange={() => setWhen(when)}
              className={cx(CHOICE_INPUT, "mt-0.5")}
            />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="font-semibold text-text">{t(`campaign.schedule.${when}`)}</span>
              <span id={`campaign-when-${when}-hint`} className="text-xs text-text-muted">
                {when === "now"
                  ? t("campaign.schedule.nowHint")
                  : t("campaign.schedule.scheduledHint", { days: maxDays })}
              </span>
            </span>
          </label>
        ))}
      </div>

      {scheduled ? (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(180px,100%),1fr))] gap-4">
          <Field label={t("campaign.schedule.day")} labelAs="span" required error={errors.day}>
            <DateInput
              value={value.day}
              onChange={setDay}
              min={range.min}
              max={range.max}
              today={today}
              clearable={false}
              disabled={disabled}
            />
          </Field>
          <Field
            label={t("campaign.schedule.time")}
            labelAs="span"
            required
            hint={t("campaign.schedule.timeHint")}
            error={errors.time}
          >
            <Select
              icon={Clock}
              options={slots}
              value={value.time || null}
              onChange={(slot) => onChange({ ...value, time: slot ?? "" })}
              placeholder={t("campaign.schedule.timePlaceholder")}
              loading={promo && policyLoading}
              loadingText={t("campaign.schedule.policyLoading")}
              disabled={disabled || !value.day}
              renderOption={(option) => (
                <span className="flex w-full min-w-0 items-center justify-between gap-2">
                  <span>{option.label}</span>
                  {option.disabled ? <span className="text-xs">{t("campaign.schedule.quietSlot")}</span> : null}
                </span>
              )}
            />
          </Field>
        </div>
      ) : null}

      {quietActive && quiet ? (
        <NoticeAlert tone="neutral" icon={Moon}>
          {t("campaign.schedule.quietNote", { start: quiet.start, end: quiet.end })}
        </NoticeAlert>
      ) : null}

      {release ? (
        <NoticeAlert
          tone="warning"
          icon={Clock}
          title={t("campaign.schedule.nowShiftedTitle", {
            now: toTashkentMoment(new Date(now).toISOString())?.time ?? "",
            // Gap o'rtasida: «… reklama ertaga, 09:00 da yuboriladi».
            when: time.inlineMoment(release, now),
          })}
        >
          {t("campaign.schedule.nowShiftedText")}
        </NoticeAlert>
      ) : null}

      {chosen ? (
        <NoticeAlert tone="info" icon={CalendarClock} title={t("campaign.schedule.chosenTitle", { when: chosen })}>
          {t("campaign.schedule.chosenText")}
        </NoticeAlert>
      ) : null}
    </Card>
  );
};
