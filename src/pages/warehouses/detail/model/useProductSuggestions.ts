import { useMemo } from "react";
import { useProducts } from "../../../../entities/product";
import { useDebouncedValue } from "./useDebouncedValue";

/** Nom bo'yicha topilgan mahsulot (`GET /product?search&market_id&limit`). */
export type ProductSuggestion = {
  id: string;
  name: string;
  marketId: string | null;
  marketName: string | null;
  skuCode: string | null;
  barcode: string | null;
};

const SUGGESTION_LIMIT = 8;
const SEARCH_DEBOUNCE_MS = 300;

type Raw = Record<string, unknown>;
const asRecord = (value: unknown): Raw | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Raw) : null;
const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
const id = (value: unknown) => (value === null || value === undefined || value === "" ? null : String(value));

/** Mahsulotlar ro'yxati javobi: `{ data: { items } }`, `{ data: [] }`, `{ items }` yoki massiv. */
export const toProductSuggestions = (payload: unknown): ProductSuggestion[] => {
  const root = asRecord(payload);
  const data = root?.data;
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(data)
      ? data
      : Array.isArray(asRecord(data)?.items)
        ? (asRecord(data)?.items as unknown[])
        : Array.isArray(asRecord(asRecord(data)?.data)?.items)
          ? (asRecord(asRecord(data)?.data)?.items as unknown[])
          : Array.isArray(root?.items)
            ? (root?.items as unknown[])
            : [];
  return rows.flatMap((row) => {
    const record = asRecord(row);
    const productId = id(record?.id);
    const name = text(record?.name);
    if (!record || !productId || !name) return [];
    const market = asRecord(record.market) ?? asRecord(record.user);
    return [
      {
        id: productId,
        name,
        marketId: id(record.market_id ?? record.user_id ?? market?.id),
        marketName: text(market?.name),
        skuCode: text(record.sku_code),
        barcode: text(record.barcode),
      },
    ];
  });
};

/**
 * «Mahsulot» maydonidagi nom qidiruvi (kod emas — 2+ belgi): xodim `GET /product` (market tanlangan bo'lsa — shu
 * market). Xatosi global xabarsiz (ro'yxat chiqmaydi, skaner baribir ishlaydi).
 */
export const useProductSuggestions = (query: string, marketId: string | null, enabled: boolean) => {
  const debounced = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);
  const active = enabled && debounced.length >= 2;
  const { useGetProducts } = useProducts();
  const result = useGetProducts(
    { search: debounced, limit: SUGGESTION_LIMIT, page: 1, ...(marketId ? { market_id: marketId } : {}) },
    active,
    { silentError: true },
  );
  const items = useMemo(() => (active ? toProductSuggestions(result.data) : []), [active, result.data]);
  return { items, isFetching: active && result.isFetching, settled: active && debounced === query.trim() };
};
