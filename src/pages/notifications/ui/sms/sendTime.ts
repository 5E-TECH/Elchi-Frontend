import {
  isQuietTime,
  shiftDay,
  type TashkentMoment,
} from "../../../../entities/notification-campaign";
import { minutesToHhmm, type QuietHours } from "../../../../entities/sms";

/** «Yuborish vaqti» qiymati: darhol yoki tanlangan Toshkent kuni + soati (KM-6). */
export type SmsSendTimeValue = { when: "now" | "scheduled"; day: string; time: string };

export type SmsSendTimeErrors = { day?: string; time?: string };

export const createSmsSendTime = (): SmsSendTimeValue => ({ when: "now", day: "", time: "" });

/** SMS taqiq oynasi (daqiqa) → bildirishnoma kampaniyasi yordamchilari kutgan «HH:MM» shakli. */
export const toQuietWindow = (quiet: QuietHours | null | undefined) =>
  quiet && Number.isFinite(quiet.start) && Number.isFinite(quiet.end) && quiet.start !== quiet.end
    ? { start: minutesToHhmm(quiet.start), end: minutesToHhmm(quiet.end), enabled: true }
    : null;

/**
 * Tanlangan soat reklama taqiqiga tushsa — backend uni oyna tugashiga suradi (2aS7PFX0): kechqurun — ertasi kuni,
 * tunda/ertalab — o'sha kuni. Taqiqda emas — `null`.
 */
export const quietShiftFor = (
  day: string,
  time: string,
  quiet: QuietHours | null | undefined,
): TashkentMoment | null => {
  const window = toQuietWindow(quiet);
  if (!window || !day || !time || !isQuietTime(time, window)) return null;
  const evening = window.start > window.end && time >= window.start;
  return { day: evening ? shiftDay(day, 1) : day, time: window.end };
};
