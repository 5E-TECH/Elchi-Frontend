import { useEffect, useMemo, useState } from "react";
import { PRODUCT_LIST_MAX_LIMIT, useProducts } from "../../../../entities/product";
import { toApiList } from "../model/orderCreateForm";

/** Qidiruv maydonidan serverga so'rov ketguncha kutish (har harfda so'rov ketmasin). */
export const CATALOG_SEARCH_DEBOUNCE_MS = 300;

type SearchableProduct = { name?: string | null };

type CatalogSearchArgs<T> = {
  /** Katalog egasi (admin/menejer/registrator — tanlangan market). Market rolida e'tiborga olinmaydi. */
  marketId: string;
  isMarketRole: boolean;
  /** Qidiruv maydonidagi matn (kechiktirilmagan). */
  search: string;
  /** To'liq katalog (`limit=500`) — qidiruv bo'sh bo'lsa ro'yxat shu. */
  catalog: T[];
};

/**
 * qNwXfqLL: katalog qidiruvi serverda — `GET /product/market/:id` yoki `/product/my-products` `?search=…&limit=500`,
 * 300 ms kechikish bilan. Mijozdagi filtr faqat yuklangan qism ichida qidirardi (11-mahsulot topilmasdi).
 * Qidiruv bo'sh — to'liq katalog (ikkinchi so'rov yo'q); tozalansa — darhol. Server qidiruvi yiqilsa (xato
 * xabari global) — yuklangan katalog ichida qidiriladi, ro'yxat bo'sh qolmaydi.
 */
export const useCatalogSearch = <T extends SearchableProduct>({ marketId, isMarketRole, search, catalog }: CatalogSearchArgs<T>) => {
  const typed = search.trim();
  const [debounced, setDebounced] = useState(typed);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(typed), CATALOG_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [typed]);
  const term = typed ? debounced : "";

  const params = useMemo(() => ({ search: term, limit: PRODUCT_LIST_MAX_LIMIT }), [term]);
  const { useGetByMarketId, useGetMyProducts } = useProducts();
  const marketQuery = useGetByMarketId(marketId, !isMarketRole && term !== "", params);
  const myQuery = useGetMyProducts(isMarketRole && term !== "", params);
  const query = isMarketRole ? myQuery : marketQuery;

  const products = useMemo(() => {
    if (!term) return catalog;
    if (query.isError) {
      const needle = term.toLowerCase();
      return catalog.filter((product) => product.name?.toLowerCase().includes(needle));
    }
    return toApiList<T>(query.data);
  }, [catalog, query.data, query.isError, term]);

  return { products, isLoading: term !== "" && query.isLoading };
};
