import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatDateLocalized } from "../../../shared/lib/formatDateTime";
import { relativeTashkentDay, toTashkentMoment, type TashkentMoment } from "./schedule";

/**
 * Kampaniya vaqti matni — TOSHKENT vaqtida (maket «Ertaga, 10:00», «Bugun, 14:02», «Kecha, 11:00»,
 * «06.10.2026, 09:00»). Rejalashtirish ham Toshkent vaqtida tanlanadi, shuning uchun tarix va tasdiq oynasi ham
 * brauzer mintaqasiga qaramaydi.
 */
export const useCampaignTime = () => {
  const { t, i18n } = useTranslation("notifications");
  const language = i18n.resolvedLanguage ?? i18n.language;

  /** Sana `DD.MM.YYYY` (kun — kalendar kuni; tush vaqti bilan o'qiladi, mintaqa siljitmaydi). */
  const date = (day: string) => formatDateLocalized(`${day}T12:00:00`, { language });

  const moment = (value: TashkentMoment, now?: number) => {
    const relative = relativeTashkentDay(value.day, now);
    return relative
      ? t(`campaign.when.${relative}`, { time: value.time })
      : t("campaign.when.date", { date: date(value.day), time: value.time });
  };

  return {
    /** ISO lahza → «Ertaga, 10:00» (o'qib bo'lmasa — `null`). */
    format: (iso: string | null | undefined, now?: number) => {
      const value = toTashkentMoment(iso);
      return value ? moment(value, now) : null;
    },
    /** Tanlangan kun va soat → «Ertaga, 10:00». */
    moment,
    /** Gap o'rtasi uchun (birinchi harf kichik): «… ertaga, 09:00 da davom etadi». */
    inline: (iso: string | null | undefined, now?: number) => {
      const value = toTashkentMoment(iso);
      return value ? lowerFirst(moment(value, now)) : null;
    },
    inlineMoment: (value: TashkentMoment, now?: number) => lowerFirst(moment(value, now)),
    /** Aniq sana va soat: «09.10.2026, 10:00». */
    exact: (value: TashkentMoment) => t("campaign.when.date", { date: date(value.day), time: value.time }),
  };
};

const lowerFirst = (text: string) => text.charAt(0).toLocaleLowerCase() + text.slice(1);

/**
 * Joriy lahza, `intervalMs` da bir yangilanadi (sukut 30 s): render toza qoladi (`Date.now()` render ichida
 * chaqirilmaydi), bugungi o'tgan soatlar va «Bugun/Ertaga» esa vaqt o'tishi bilan o'zi yangilanadi.
 */
export const useClock = (intervalMs = 30_000) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
};
