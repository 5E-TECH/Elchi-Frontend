import { useQueries, useQuery } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";
import type { CustomerDistrict, CustomerSuggestMatch, CustomerSuggestion, CustomerSuggestParams } from "./types";

export const CUSTOMER_SUGGEST_KEY = "customer-suggest";
export const CUSTOMER_DISTRICT_KEY = "customer-district";

/** Backend qidiruvi kamida 7 raqamdan boshlanadi (`parseUzPhoneSearch`). */
export const CUSTOMER_SUGGEST_MIN_DIGITS = 7;

const text = (value: unknown): string | null =>
  typeof value === "string" ? value : typeof value === "number" ? String(value) : null;

const count = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/** Gateway qobig'i `{ statusCode, message, data }` yoki to'g'ridan-to'g'ri qiymat. */
const unwrap = (payload: unknown): unknown =>
  payload && typeof payload === "object" && "data" in payload ? (payload as { data: unknown }).data : payload;

/** `matched_by` ning ma'lum qiymatlari (9444UAa8). */
const MATCHES: ReadonlySet<CustomerSuggestMatch> = new Set<CustomerSuggestMatch>(["phone", "extra_number", "name"]);

/** Javobdan takliflar (noto'g'ri qatorlar tashlanadi, maydonlar oq ro'yxatda). */
export const toCustomerSuggestions = (payload: unknown): CustomerSuggestion[] => {
  const list = unwrap(payload);
  if (!Array.isArray(list)) return [];
  return list
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    .map((row) => {
      const newCount = count(row.new_orders_count);
      return {
        id: text(row.id) ?? "",
        name: text(row.name),
        phone_number: text(row.phone_number),
        extra_number: text(row.extra_number),
        address: text(row.address),
        region_id: text(row.region_id),
        district_id: text(row.district_id),
        orders_count: count(row.orders_count),
        new_orders_count: newCount,
        has_new_orders: Boolean(row.has_new_orders) || (newCount ?? 0) > 0,
        new_order_ids: Array.isArray(row.new_order_ids)
          ? row.new_order_ids.map(text).filter((id): id is string => Boolean(id))
          : [],
        last_order_at: text(row.last_order_at),
        matched_by: MATCHES.has(row.matched_by as CustomerSuggestMatch) ? (row.matched_by as CustomerSuggestMatch) : null,
      };
    })
    .filter((row) => row.id !== "");
};

export const toCustomerDistrict = (payload: unknown): CustomerDistrict | null => {
  const row = unwrap(payload);
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  const id = text(record.id);
  if (!id) return null;
  const region = record.region as Record<string, unknown> | null | undefined;
  return { id, name: text(record.name), region_id: text(record.region_id) ?? text(region?.id) };
};

export const fetchCustomerSuggestions = ({ phone, marketId }: CustomerSuggestParams) =>
  api
    .get(API_ENDPOINTS.CUSTOMERS.SUGGEST, { params: { phone, ...(marketId ? { market_id: marketId } : {}) } })
    .then((res) => toCustomerSuggestions(res.data));

/**
 * Tuman (nom va viloyat) — `GET district/:id`. Taklif qatorida tuman nomi, tanlashda esa viloyat shu yerdan
 * olinadi (mijoz kartasidagi `region_id` bo'sh bo'lishi mumkin). Kesh uzoq: tumanlar kam o'zgaradi.
 */
export const customerDistrictQuery = (districtId: string) => ({
  queryKey: [CUSTOMER_DISTRICT_KEY, districtId] as const,
  queryFn: () => api.get(API_ENDPOINTS.DISTRICTS.BY_ID(districtId)).then((res) => toCustomerDistrict(res.data)),
  staleTime: 10 * 60 * 1000,
  retry: false,
  // Taklif ixtiyoriy yordam: xato global xabar chiqarmaydi (qator tumansiz ko'rinadi).
  meta: { silentError: true },
});

/**
 * Telefon bo'yicha mijoz takliflari. `enabled` — kamida 7 raqam va (market rolidan tashqari) market tanlangan.
 * Xato jim: forma yangi mijoz sifatida ishlayveradi.
 */
export const useCustomerSuggest = (params: CustomerSuggestParams, enabled: boolean) =>
  useQuery({
    queryKey: [CUSTOMER_SUGGEST_KEY, params.phone, params.marketId ?? null],
    queryFn: () => fetchCustomerSuggestions(params),
    enabled: enabled && params.phone.length >= CUSTOMER_SUGGEST_MIN_DIGITS,
    staleTime: 30_000,
    retry: false,
    meta: { silentError: true },
  });

/** Bir nechta tumanning nomi (takrorlar bir marta so'raladi): `district_id → nom`. */
export const useCustomerDistrictNames = (districtIds: string[]): Record<string, string> => {
  const unique = Array.from(new Set(districtIds.filter(Boolean)));
  const results = useQueries({ queries: unique.map((id) => customerDistrictQuery(id)) });
  const names: Record<string, string> = {};
  results.forEach((result) => {
    if (result.data?.name) names[result.data.id] = result.data.name;
  });
  return names;
};
