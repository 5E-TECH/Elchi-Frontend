/**
 * KAMPANIYANI REJALASHTIRISH (KM-3, backend WIsb9Ytq): vaqt doim TOSHKENT vaqtida tanlanadi va ko'rsatiladi —
 * brauzer mintaqasidan qat'i nazar (backend `scheduled_at` ni faqat aniq zona bilan qabul qiladi, zonasiz — 400).
 * Hisob UTC+5 siljishi bilan qilinadi (O'zbekistonda yozgi vaqt yo'q), `Intl` mintaqa ma'lumotiga tayanmaydi.
 *
 * Reklama tungi taqiqi (`promo_quiet_hours`, sukut 18:00–09:00) soatlari kodda QOTIRILMAYDI — faqat
 * `GET /notifications/campaigns/schedule-policy` javobidan (`CampaignSchedulePolicy.quietHours`).
 */

export const TASHKENT_UTC_OFFSET = "+05:00";
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Soat tanlovi qadami (maket `superadmin-notifications-send-schedule`: 09:00, 09:30, 10:00 …). */
export const SCHEDULE_STEP_MINUTES = 30;

/** Backend `max_schedule_days` kelmaguncha (yoki kelmasa) — sukut. */
export const DEFAULT_MAX_SCHEDULE_DAYS = 90;

/** Toshkentdagi devor soati: kun `YYYY-MM-DD` va vaqt `HH:MM`. */
export type TashkentMoment = { day: string; time: string };

/** Lahza (ISO, `Z` yoki zona bilan) → Toshkent kuni va soati; o'qib bo'lmasa — `null`. */
export const toTashkentMoment = (iso: string | null | undefined): TashkentMoment | null => {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  const local = new Date(ms + TASHKENT_OFFSET_MS).toISOString();
  return { day: local.slice(0, 10), time: local.slice(11, 16) };
};

/** Bugungi Toshkent kuni (`YYYY-MM-DD`). */
export const tashkentToday = (now: number = Date.now()) =>
  new Date(now + TASHKENT_OFFSET_MS).toISOString().slice(0, 10);

/** `YYYY-MM-DD` + n kun. */
export const shiftDay = (day: string, days: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

/** Toshkent kuni + soati → backend kutgan ISO (`2026-10-09T10:00:00+05:00`). */
export const toScheduledAt = (day: string, time: string) => `${day}T${time}:00${TASHKENT_UTC_OFFSET}`;

/** Hozirgi lahza Toshkent vaqtida, aniq zona bilan («Darhol» tekshiruvi uchun). */
export const tashkentNowIso = (now: number = Date.now()) =>
  `${new Date(now + TASHKENT_OFFSET_MS).toISOString().slice(0, 19)}${TASHKENT_UTC_OFFSET}`;

const toMinutes = (time: string) => {
  const match = /^(\d{1,2}):(\d{2})/.exec(time);
  return match ? Number(match[1]) * 60 + Number(match[2]) : Number.NaN;
};

/** Kun bo'yi soat variantlari: `00:00`, `00:30` … `23:30`. */
export const scheduleTimeSlots = (step: number = SCHEDULE_STEP_MINUTES): string[] => {
  const slots: string[] = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += step) {
    slots.push(`${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`);
  }
  return slots;
};

export type QuietHours = { start: string; end: string; enabled: boolean };

/**
 * Soat taqiq oynasiga tushadimi: `[start, end)`; oyna yarim tundan o'tsa (18:00–09:00) — `t ≥ start` yoki
 * `t < end`. Oyna o'chiq yoki noma'lum bo'lsa — `false`.
 */
export const isQuietTime = (time: string, quiet: QuietHours | null | undefined) => {
  if (!quiet?.enabled) return false;
  const t = toMinutes(time);
  const start = toMinutes(quiet.start);
  const end = toMinutes(quiet.end);
  if (![t, start, end].every(Number.isFinite) || start === end) return false;
  return start < end ? t >= start && t < end : t >= start || t < end;
};

/** Tanlangan kun va soat hozirdan keyinmi (o'tgan vaqtni backend «darhol» deb oladi — biz ruxsat bermaymiz). */
export const isFutureSlot = (day: string, time: string, now: number = Date.now()) => {
  const ms = Date.parse(toScheduledAt(day, time));
  return Number.isFinite(ms) && ms > now;
};

/** Tanlash mumkin bo'lgan kunlar oralig'i: bugundan `maxDays` gacha (oxirgi kun — xavfsiz, `maxDays − 1`). */
export const scheduleDayRange = (maxDays: number = DEFAULT_MAX_SCHEDULE_DAYS, now: number = Date.now()) => {
  const min = tashkentToday(now);
  return { min, max: shiftDay(min, Math.max(1, maxDays) - 1) };
};

/** Shu kundagi birinchi bo'sh (kelajakdagi va taqiqsiz) soat — sana tanlanganda soatni to'ldirish uchun. */
export const firstAvailableSlot = (
  day: string,
  { quiet, promo, now = Date.now() }: { quiet: QuietHours | null | undefined; promo: boolean; now?: number },
) =>
  scheduleTimeSlots().find((time) => isFutureSlot(day, time, now) && !(promo && isQuietTime(time, quiet))) ?? null;

/**
 * «Darhol» reklama hozir taqiq oynasida bo'lsa — qachon ketadi (oyna tugashi: ertalab bo'lsa bugun, kechqurun bo'lsa
 * ertaga). Taqiqda emas — `null`. Yakuniy vaqtni backend o'zi belgilaydi (`schedule-policy` → `check`), bu — oldindan
 * ogohlantirish uchun (maket `-send-states` «Reklama, «Darhol», kechqurun»).
 */
export const quietReleaseMoment = (
  quiet: QuietHours | null | undefined,
  now: number = Date.now(),
): TashkentMoment | null => {
  const current = toTashkentMoment(new Date(now).toISOString());
  if (!current || !quiet || !isQuietTime(current.time, quiet)) return null;
  const morning = toMinutes(current.time) < toMinutes(quiet.end);
  return { day: morning ? current.day : shiftDay(current.day, 1), time: quiet.end };
};

export type RelativeDay = "today" | "tomorrow" | "yesterday" | null;

/** Toshkent kuni bugun / ertaga / kechami (`null` — boshqa kun). */
export const relativeTashkentDay = (day: string, now: number = Date.now()): RelativeDay => {
  const today = tashkentToday(now);
  if (day === today) return "today";
  if (day === shiftDay(today, 1)) return "tomorrow";
  if (day === shiftDay(today, -1)) return "yesterday";
  return null;
};
