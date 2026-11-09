/**
 * Soat maydoni (`HH:mm`, 24 soatlik, Toshkent vaqti) — brauzerning `type="time"` maydoni EMAS: u brauzer tiliga
 * qarab «10:00 PM» ko'rsatardi. Raqam yoziladi, «:» o'zi qo'yiladi.
 */
export const CLOCK_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** «2215» / «22:15» → «22:15»; yozilayotgan qism («2», «22:1») o'zgarishsiz qoladi. */
export const toClockDraft = (raw: string) => {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
};

const TASHKENT_CLOCK = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Tashkent",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Hozir Toshkentda soat necha — `HH:MM` (qurilma vaqt mintaqasiga qaramay). */
export const tashkentClockNow = (now: Date = new Date()) => TASHKENT_CLOCK.format(now);
