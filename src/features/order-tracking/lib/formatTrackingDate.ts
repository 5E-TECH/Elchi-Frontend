/**
 * Sana — DOIM Asia/Tashkent zonasida.
 *
 * ⚠️ Ilgari zona berilmagan edi va brauzerning mahalliy zonasi ishlatilardi:
 * UTC'da sozlangan qurilmada `2026-07-19T20:30Z` "19.07.2026, 20:30" bo'lib
 * chiqardi, holbuki Toshkentda bu allaqachon 20-iyul 01:30. Operatorlar va
 * hisobotlar Toshkent vaqtida ishlaydi.
 */
export const TASHKENT_TIME_ZONE = "Asia/Tashkent";

export const formatTrackingDate = (value: string | number | Date) => {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  const parts = new Intl.DateTimeFormat("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZone: TASHKENT_TIME_ZONE,
  }).formatToParts(date);

  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${getPart("day")}.${getPart("month")}.${getPart("year")}, ${getPart("hour")}:${getPart("minute")}:${getPart("second")}`;
};
