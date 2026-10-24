import type {
  CreateDeliveryTariffRequest,
  DeliveryTariff,
  DeliveryTariffId,
} from "../../../entities/delivery-pricing";

/**
 * «TARIFNI O'ZGARTIRISH» OYNASI (maket `*-regions-delivery-tariff-edit-dialog`) — yangi versiya: asosiy narx, har
 * qo'shimcha kg, muddat (eng kam / eng ko'p), kuchga kirish sanasi (Toshkent vaqti, 00:00). Bugun tanlansa —
 * `valid_from` yuborilmaydi (darhol; backend o'tgan vaqtni 400 bilan rad etadi), keyingi kun — rejalashtirilgan.
 * Xato matni — `deliveryPricing` fazosidagi kalit (chizishda tarjima qilinadi).
 */
export type TariffFormValues = {
  /** Raqamlar satri (`TextInput mode="money"`). */
  base: string;
  perKg: string;
  daysMin: string;
  daysMax: string;
  /** `YYYY-MM-DD` (`DateInput`). */
  validFrom: string;
};

/** Namunaviy posilkalar «hozir → yangi» (maket: 1,0 · 3,4 · 7,0 kg). */
export const SAMPLE_WEIGHTS_KG = [1, 3.4, 7] as const;

/** Narx maydoni — ko'pi bilan 12 xona (backend `numeric(14,2)`). */
const MONEY_MAX_DIGITS = 12;
export const DAYS_MAX = 365;

const pad = (value: number) => String(value).padStart(2, "0");

/** Mahalliy (Toshkent) sana `YYYY-MM-DD`. */
export const toIsoDay = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const addDays = (isoDay: string, days: number): string => {
  const [year, month, day] = isoDay.split("-").map(Number);
  return toIsoDay(new Date(year, month - 1, day + days));
};

/** Joriy tarif → forma (sana sukut — ertaga). Tarif yo'q — bo'sh narx va muddat. */
export const toTariffForm = (tariff: DeliveryTariff | null, today: string): TariffFormValues => ({
  base: tariff ? String(Math.round(tariff.basePrice)) : "",
  perKg: tariff ? String(Math.round(tariff.extraPerKg)) : "",
  daysMin: tariff ? String(tariff.daysMin) : "",
  daysMax: tariff ? String(tariff.daysMax) : "",
  validFrom: addDays(today, 1),
});

const digits = (value: string) => value.replace(/^0+(?=\d)/, "");

export const validateMoney = (value: string): true | string => {
  if (!value.trim()) return "page.edit.errors.required";
  return digits(value).length <= MONEY_MAX_DIGITS || "page.edit.errors.tooLarge";
};

export const validateDays = (value: string): true | string => {
  if (!value.trim()) return "page.edit.errors.required";
  return Number(value) <= DAYS_MAX || "page.edit.errors.daysMax";
};

/** «Muddat (eng ko'p)» — eng kamidan kichik bo'lmasin. */
export const validateDaysMax = (value: string, values: TariffFormValues): true | string => {
  const base = validateDays(value);
  if (base !== true) return base;
  return !values.daysMin.trim() || Number(value) >= Number(values.daysMin) || "page.edit.errors.daysOrder";
};

export const validateValidFrom = (value: string, today: string): true | string => {
  if (!value) return "page.edit.errors.dateRequired";
  return value >= today || "page.edit.errors.datePast";
};

/** Kelajakdagi sana — rejalashtirilgan versiya; bugun — darhol. */
export const isScheduledDay = (validFrom: string, today: string) => validFrom > today;

/** `POST /delivery/tariffs` tanasi: Toshkent vaqti 00:00 (`+05:00`); bugun — `valid_from` siz (hozir). */
export const toTariffPayload = (
  tariffId: DeliveryTariffId,
  values: TariffFormValues,
  today: string,
): CreateDeliveryTariffRequest => ({
  tariff_id: tariffId,
  base_price: Number(values.base),
  extra_per_kg: Number(values.perKg),
  days_min: Number(values.daysMin),
  days_max: Number(values.daysMax),
  ...(isScheduledDay(values.validFrom, today) ? { valid_from: `${values.validFrom}T00:00:00+05:00` } : {}),
});
