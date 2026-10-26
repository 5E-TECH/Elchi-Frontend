// dizayn-v2: superadmin-notifications-sms-campaign-segment, superadmin-notifications-send-schedule
import { useEffect, useId, useState } from "react";
import { CalendarClock, Clock, Globe, Moon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NoticeAlert } from "../../../../entities/notification";
import {
  isFutureSlot,
  scheduleDayRange,
  scheduleTimeSlots,
  shiftDay,
  tashkentToday,
  useCampaignTime,
} from "../../../../entities/notification-campaign";
import {
  SMS_MAX_SCHEDULE_DAYS,
  minutesToHhmm,
  quietHoursNotice,
  type QuietHours,
} from "../../../../entities/sms";
import { Badge, DateInput, Field, Select, type SelectOption } from "../../../../shared/ui/primitives";
import { quietShiftFor, toQuietWindow, type SmsSendTimeErrors, type SmsSendTimeValue } from "./sendTime";

/** Daqiqada bir marta yangilanadigan «hozir» (soat chegarasida izoh o'zi chiqadi / yo'qoladi). */
const useMinuteClock = () => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
};

/** Ma'qul sukut soat (bildirishnoma kampaniyasi bilan bir xil — «10:00»). */
const PREFERRED_TIME = "10:00";

export type CampaignSendTimeProps = {
  /** `GET sms/status` → `quiet_hours` (Toshkent, daqiqa). Noma'lum — izoh chizilmaydi. */
  quietHours: QuietHours | null | undefined;
  value: SmsSendTimeValue;
  onChange: (value: SmsSendTimeValue) => void;
  errors?: SmsSendTimeErrors;
  disabled?: boolean;
};

/**
 * «YUBORISH VAQTI» — maket `superadmin-notifications-sms-campaign-segment` (karta pastki bo'limi): «Toshkent vaqti»
 * belgisi, «Darhol» · «Belgilangan vaqtda» (KM-6, 2aS7PFX0 — backend tayyor; rejalashtirish ko'rinishi
 * bildirishnoma kampaniyasidagi `superadmin-notifications-send-schedule` dan: «Sana» (bugundan 90 kun) va «Soat»
 * (30 daqiqa qadam, bugun o'tgan soatlar yo'q)). Reklama tungi taqiqi: «Darhol» da — «Hozir 19:10 — SMS ertaga,
 * 09:00 da yuboriladi»; tanlangan soat taqiqqa tushsa — backend uni 09:00 ga suradi, shu oldindan aytiladi.
 */
export const CampaignSendTime = ({
  quietHours,
  value,
  onChange,
  errors = {},
  disabled = false,
}: CampaignSendTimeProps) => {
  const { t } = useTranslation("sms");
  const titleId = useId();
  const now = useMinuteClock();
  const time = useCampaignTime();
  const scheduled = value.when === "scheduled";
  const notice = scheduled ? null : quietHoursNotice(quietHours, now);
  const today = tashkentToday(now);
  const range = scheduleDayRange(SMS_MAX_SCHEDULE_DAYS, now);
  const quietWindow = toQuietWindow(quietHours);

  const pickSlot = (day: string, preferred: string) =>
    preferred && isFutureSlot(day, preferred, now)
      ? preferred
      : (scheduleTimeSlots().find((slot) => isFutureSlot(day, slot, now)) ?? "");

  const setWhen = (when: SmsSendTimeValue["when"]) => {
    if (when === "now") {
      onChange({ ...value, when });
      return;
    }
    // Birinchi tanlovda — ertaga 10:00 (bildirishnoma kampaniyasidagidek); avval tanlangan bo'lsa — o'sha.
    const day = value.day || shiftDay(today, 1);
    onChange({ when, day, time: value.time || pickSlot(day, PREFERRED_TIME) });
  };

  const slots: SelectOption[] = scheduleTimeSlots()
    .filter((slot) => value.day !== today || isFutureSlot(value.day, slot, now))
    .map((slot) => ({ value: slot, label: slot }));

  const valid =
    scheduled && value.day && value.time && !errors.day && !errors.time && isFutureSlot(value.day, value.time, now);
  const shift = valid ? quietShiftFor(value.day, value.time, quietHours) : null;
  const chosen = valid && !shift ? time.moment({ day: value.day, time: value.time }, now) : null;

  const options = [
    { when: "now" as const, label: t("campaign.whenNow"), hint: t("campaign.whenNowHint") },
    {
      when: "scheduled" as const,
      label: t("campaign.whenScheduled"),
      hint: t("campaign.whenScheduledHint", { days: SMS_MAX_SCHEDULE_DAYS }),
    },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4 border-t border-border p-5" data-testid="campaign-send-time">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h3 id={titleId} className="m-0 text-sm font-semibold text-text">
          {t("campaign.when")}
        </h3>
        <Badge icon={Globe}>{t("campaign.tashkentTime")}</Badge>
      </div>

      <div role="radiogroup" aria-labelledby={titleId} className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {options.map((option) => (
          <label
            key={option.when}
            className="flex min-w-0 cursor-pointer items-start gap-2.5 rounded-xl border border-border-strong bg-surface px-3.5 py-3 has-[:checked]:border-action has-[:checked]:bg-action-soft"
          >
            <input
              type="radio"
              name="sms-campaign-when"
              value={option.when}
              checked={value.when === option.when}
              disabled={disabled}
              onChange={() => setWhen(option.when)}
              className="mt-0.5 size-[18px] shrink-0 accent-action"
            />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-semibold text-text">{option.label}</span>
              <span className="text-xs text-text-muted">{option.hint}</span>
            </span>
          </label>
        ))}
      </div>

      {scheduled ? (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(180px,100%),1fr))] gap-4">
          <Field label={t("campaign.scheduleDay")} labelAs="span" required error={errors.day}>
            <DateInput
              value={value.day}
              onChange={(day) =>
                onChange({ ...value, day, time: day ? pickSlot(day, value.time || PREFERRED_TIME) : value.time })
              }
              min={range.min}
              max={range.max}
              today={today}
              clearable={false}
              disabled={disabled}
            />
          </Field>
          <Field
            label={t("campaign.scheduleTime")}
            labelAs="span"
            required
            hint={t("campaign.scheduleTimeHint")}
            error={errors.time}
          >
            <Select
              icon={Clock}
              options={slots}
              value={value.time || null}
              onChange={(slot) => onChange({ ...value, time: slot ?? "" })}
              placeholder={t("campaign.scheduleTimePlaceholder")}
              disabled={disabled || !value.day}
            />
          </Field>
        </div>
      ) : null}

      {notice && quietHours ? (
        <NoticeAlert
          tone="warning"
          icon={Moon}
          data-testid="campaign-quiet-notice"
          title={t(notice.day === "tomorrow" ? "campaign.quietTomorrow" : "campaign.quietToday", {
            now: minutesToHhmm(notice.now),
            at: minutesToHhmm(notice.sendAt),
          })}
        >
          {t("campaign.quietBody", { from: minutesToHhmm(quietHours.start), to: minutesToHhmm(quietHours.end) })}
        </NoticeAlert>
      ) : null}

      {shift && quietWindow ? (
        <NoticeAlert
          tone="warning"
          icon={Moon}
          data-testid="campaign-quiet-shift"
          title={t("campaign.scheduleShiftTitle", {
            requested: value.time,
            when: time.inlineMoment(shift, now),
          })}
        >
          {t("campaign.quietBody", { from: quietWindow.start, to: quietWindow.end })}
        </NoticeAlert>
      ) : null}

      {chosen ? (
        <NoticeAlert
          tone="info"
          icon={CalendarClock}
          data-testid="campaign-schedule-chosen"
          title={t("campaign.scheduleChosen", { when: chosen })}
        >
          {t("campaign.scheduleChosenText")}
        </NoticeAlert>
      ) : null}
    </div>
  );
};

export default CampaignSendTime;
