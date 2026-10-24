import { formatNumberLocalized } from "../../../shared/lib/formatMoney";

/** Og'irlik ko'rinishi (birliksiz): kamida bitta kasr («7,0»), ko'pi bilan `max` xona («1,98»); uz/ru vergul, en nuqta. */
export const formatKgValue = (value: number, language?: string | null, max = 3): string =>
  formatNumberLocalized(value, { language, fractionDigits: max, minFractionDigits: 1 });
