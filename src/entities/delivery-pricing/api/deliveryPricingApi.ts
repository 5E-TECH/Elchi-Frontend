import { api } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";
import {
  DELIVERY_TARIFF_IDS,
  type DeliveryPricingSettings,
  type DeliveryQuote,
  type DeliveryQuoteByTariffRequest,
  type DeliveryQuotesByTariff,
  type DeliveryTariffId,
} from "../model/types";

type Raw = Record<string, unknown>;

const asRecord = (value: unknown): Raw | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Raw) : null;

/** Son (xom `numeric` satr ham) yoki `null`. */
const numberOf = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
};

/** `{ statusCode, data }` o'rami yoki o'ramsiz javob → ichki obyekt. */
const payloadOf = (value: unknown): Raw | null => {
  const root = asRecord(value);
  if (!root) return null;
  return asRecord(root.data) ?? root;
};

const isTariffId = (value: unknown): value is DeliveryTariffId =>
  typeof value === "string" && (DELIVERY_TARIFF_IDS as readonly string[]).includes(value);

/** Bitta tarif natijasi (`DeliveryQuoteResultDto`); `total` yoki tarif kodi yo'q bo'lsa — `null`. */
export const normalizeDeliveryQuote = (value: unknown, fallbackId?: DeliveryTariffId): DeliveryQuote | null => {
  const item = asRecord(value);
  if (!item) return null;
  const tariffId = isTariffId(item.tariffId) ? item.tariffId : fallbackId;
  const total = numberOf(item.total);
  if (!tariffId || total === null) return null;
  const tariff = asRecord(item.tariff);
  return {
    tariffId,
    base: numberOf(item.base) ?? numberOf(tariff?.base_price) ?? 0,
    perExtraKg: numberOf(item.perExtraKg) ?? numberOf(tariff?.extra_per_kg) ?? 0,
    actualKg: numberOf(item.actualKg) ?? 0,
    volumetricKg: numberOf(item.volumetricKg) ?? 0,
    billableKg: numberOf(item.billableKg) ?? 0,
    extraKg: numberOf(item.extraKg) ?? 0,
    extra: numberOf(item.extra) ?? 0,
    total,
    basis: item.basis === "volume" || item.basis === "weight" ? item.basis : null,
    daysMin: numberOf(item.daysMin) ?? numberOf(tariff?.days_min),
    daysMax: numberOf(item.daysMax) ?? numberOf(tariff?.days_max),
  };
};

/** `POST /delivery/quote/by-tariff` javobi → `{ city, center, address }` (yo'q yoki buzuq — `null`). */
export const normalizeQuotesByTariff = (value: unknown): DeliveryQuotesByTariff => {
  const quotes = asRecord(payloadOf(value)?.quotes);
  return Object.fromEntries(
    DELIVERY_TARIFF_IDS.map((id) => [id, normalizeDeliveryQuote(quotes?.[id], id)]),
  ) as DeliveryQuotesByTariff;
};

/** Javobda birorta ham tarif narxi yo'q (masalan bo'sh `{}`) — ko'rsatadigan narx yo'q. */
export const hasAnyQuote = (quotes: DeliveryQuotesByTariff | undefined): boolean =>
  Boolean(quotes && DELIVERY_TARIFF_IDS.some((id) => quotes[id] !== null));

export const getQuotesByTariff = async (body: DeliveryQuoteByTariffRequest): Promise<DeliveryQuotesByTariff> => {
  const response = await api.post(API_ENDPOINTS.DELIVERY_PRICING.QUOTE_BY_TARIFF, body);
  return normalizeQuotesByTariff(response.data);
};

/** `GET /delivery/pricing-settings` javobi; majburiy son maydoni yo'q bo'lsa — `null`. */
export const normalizePricingSettings = (value: unknown): DeliveryPricingSettings | null => {
  const row = payloadOf(value);
  if (!row) return null;
  const firstKgIncluded = numberOf(row.first_kg_included);
  const roundTo = numberOf(row.round_to);
  if (firstKgIncluded === null || roundTo === null) return null;
  return {
    id: row.id === undefined || row.id === null ? "" : String(row.id),
    volumetricDivisor: numberOf(row.volumetric_divisor) ?? 5000,
    firstKgIncluded,
    minBillableKg: numberOf(row.min_billable_kg) ?? 0.1,
    billableStepKg: numberOf(row.billable_step_kg) ?? 0.1,
    roundTo,
    pickupFee: numberOf(row.pickup_fee) ?? 0,
    pickupFreeFromCount: numberOf(row.pickup_free_from_count),
    expressMultiplier: numberOf(row.express_multiplier) ?? 1,
  };
};

export const getPricingSettings = async (): Promise<DeliveryPricingSettings | null> => {
  const response = await api.get(API_ENDPOINTS.DELIVERY_PRICING.SETTINGS);
  return normalizePricingSettings(response.data);
};
