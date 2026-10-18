import { useSyncExternalStore } from "react";

/** Telefon chegarasi — `max-md:` (< 768) bilan bir xil. */
const PHONE = "(max-width: 767px)";
/** Planshet va telefon — `max-lg:` (< 1024) bilan bir xil. */
const BELOW_LG = "(max-width: 1023px)";

const media = (query: string) =>
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(query)
    : null;

const useMediaQuery = (query: string) =>
  useSyncExternalStore(
    (onChange) => {
      const list = media(query);
      if (!list) return () => undefined;
      list.addEventListener?.("change", onChange);
      return () => list.removeEventListener?.("change", onChange);
    },
    () => media(query)?.matches ?? false,
    () => false,
  );

/**
 * Telefon ekranimi (< 768). Grafiklar uchun: telefonda boshqa ko'rinish (oxirgi 7 kun) DOM'da faqat bittasi turadi —
 * CSS bilan yashirilgan `ResponsiveContainer` nol o'lcham ogohlantirishini bermasin.
 */
export const useIsPhoneViewport = () => useMediaQuery(PHONE);

/**
 * Planshet yoki telefon (< 1024). Maketda (`*-sms-campaign`, `*-sms-templates`) jadval planshetda ham ro'yxatga
 * aylanadi (`.el-hide-tablet` / `.el-show-tablet`), `DataTable` esa kartalarni faqat telefonda beradi.
 */
export const useIsBelowLg = () => useMediaQuery(BELOW_LG);
