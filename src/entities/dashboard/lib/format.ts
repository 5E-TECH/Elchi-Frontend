import type { TFunction } from "i18next";
import { MINUS_SIGN, formatNumberLocalized } from "../../../shared/lib/formatMoney";

/** Ishora: musbat «+», manfiy «−» (U+2212), nol — ishorasiz. */
const sign = (value: number) => (value > 0 ? "+" : value < 0 ? MINUS_SIGN : "");

/** Foiz punktlari farqi: «+2,4 p.p.», «−0,9 p.p.». */
export const formatPointDelta = (t: TFunction, delta: number, language?: string): string =>
  t("dashboard:v2Dashboard.pp", {
    value: `${sign(Math.round(delta * 10) / 10)}${formatNumberLocalized(Math.abs(delta), { language, fractionDigits: 1 })}`,
  });

/** Davomiylik soatda → «5 soat 40 daq», «40 daq»; 0 yoki yo'q — `null`. */
export const formatDuration = (t: TFunction, hours: number | null | undefined): string | null => {
  if (hours == null || !Number.isFinite(hours) || hours <= 0) return null;
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return t("dashboard:v2Dashboard.durationMinutes", { m });
  if (m === 0) return t("dashboard:v2Dashboard.durationHours", { h });
  return t("dashboard:v2Dashboard.duration", { h, m });
};

/** Daqiqalar farqi: «−25 daq». */
export const formatMinutesDelta = (t: TFunction, deltaHours: number): string => {
  const minutes = Math.round(deltaHours * 60);
  return t("dashboard:v2Dashboard.durationMinutes", { m: `${sign(minutes)}${Math.abs(minutes)}` });
};

/** «38 / 45 ta». */
export const formatPartOfTotal = (t: TFunction, part: number, total: number, language?: string): string =>
  t("dashboard:v2Dashboard.partOfTotal", {
    part: formatNumberLocalized(part, { language }),
    total: formatNumberLocalized(total, { language }),
  });
