import { useQuery } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";
import { markets } from "./index";

/** Tanlov ro'yxati uchun market: `id`, nom va (bo'lsa) telefon — qidiruv uchun. */
export interface MarketLookupItem {
  id: string;
  name: string;
  phone?: string;
}

/** Faol marketlar, bitta sahifada (`GET /markets?status=active&limit=…`). */
const LOOKUP_PARAMS = { status: "active", limit: 1000 } as const;

/** `GET /markets` javobi: massiv, `{ data: [] }`, `{ items: [] }` yoki `{ data: { items: [] } }`. */
export const toMarketLookup = (payload: unknown): MarketLookupItem[] => {
  const record = (payload ?? {}) as Record<string, unknown>;
  const data = record.data as Record<string, unknown> | unknown[] | undefined;
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(data)
      ? data
      : Array.isArray(record.items)
        ? record.items
        : data && Array.isArray((data as Record<string, unknown>).items)
          ? ((data as Record<string, unknown>).items as unknown[])
          : [];

  const items: MarketLookupItem[] = [];
  for (const row of rows) {
    const market = (row ?? {}) as Record<string, unknown>;
    const id = market.id;
    if (id === undefined || id === null || String(id) === "") continue;
    const name = String(market.name ?? "").trim() || String(market.username ?? "").trim() || `#${id}`;
    const phone = typeof market.phone_number === "string" ? market.phone_number : undefined;
    items.push({ id: String(id), name, ...(phone ? { phone } : {}) });
  }
  return items;
};

/**
 * Faol marketlar ro'yxati — forma va filtrlardagi `Select` uchun (KM-1 «Mijoz filtrlari»). Xatoni iste'molchi
 * o'zi ko'rsatadi (global xabar yo'q).
 */
export const useMarketLookup = (enabled = true) =>
  useQuery({
    queryKey: [markets, "lookup", LOOKUP_PARAMS],
    queryFn: async () => toMarketLookup((await api.get(API_ENDPOINTS.MARKETS.BASE, { params: LOOKUP_PARAMS })).data),
    enabled,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    meta: { silentError: true },
  });
