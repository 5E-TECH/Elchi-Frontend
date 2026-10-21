import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";
import { markets } from "./index";

/** Tanlov ro'yxati uchun market: `id`, nom va (bo'lsa) telefon — qidiruv uchun. */
export interface MarketLookupItem {
  id: string;
  name: string;
  phone?: string;
}

/** Tanlov ro'yxatidagi marketlar soni bir so'rovda. Backend `limit` ni 100 bilan cheklaydi (`normalizeQuery`), superadmin
 * va admin uchun har qator — kassa RPC; shuning uchun ro'yxat kichik, qolgani — server qidiruvi (`search`). */
export const MARKET_LOOKUP_LIMIT = 50;

/** Bir so'rov natijasi: ko'rsatilganlar va (backend `meta.total`) mos marketlar jami. */
export interface MarketLookupPage {
  items: MarketLookupItem[];
  total: number;
}

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

/** `{ data: { items, meta: { total } } }` (yoki `{ meta }` yuqorida) → sahifa; `total` bo'lmasa — ko'rsatilganlar soni. */
export const toMarketLookupPage = (payload: unknown): MarketLookupPage => {
  const items = toMarketLookup(payload);
  const record = (payload ?? {}) as Record<string, unknown>;
  const data = (record.data ?? {}) as Record<string, unknown>;
  const meta = (data.meta ?? record.meta ?? {}) as Record<string, unknown>;
  const total = Number(meta.total);
  return { items, total: Number.isFinite(total) && total >= items.length ? total : items.length };
};

/**
 * Faol marketlar — forma va filtrlardagi `Select` uchun (KM-1 «Mijoz filtrlari»). `search` — server qidiruvi
 * (nom, telefon, username; iste'molchi debounce qiladi); qidiruv almashganda oldingi ro'yxat ko'rinib turadi.
 * Xatoni iste'molchi o'zi ko'rsatadi (global xabar yo'q).
 */
export const useMarketLookup = (search = "", enabled = true) => {
  const query = search.trim();
  const params = { status: "active", limit: MARKET_LOOKUP_LIMIT, ...(query ? { search: query } : {}) };
  return useQuery({
    queryKey: [markets, "lookup", params],
    queryFn: async () => toMarketLookupPage((await api.get(API_ENDPOINTS.MARKETS.BASE, { params })).data),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    meta: { silentError: true },
  });
};
