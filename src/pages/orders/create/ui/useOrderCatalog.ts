import { useCallback, useMemo } from "react";
import { useWatch, type Control } from "react-hook-form";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../app/config/store";
import { PRODUCT_LIST_MAX_LIMIT, useProducts } from "../../../../entities/product";
import { toApiList, type OrderCreateFormValues } from "../model/orderCreateForm";
import type { CatalogProduct } from "../model/orderPricing";

/**
 * Katalog to'liq olinadi (gateway chegarasi 500): `limit` siz server 10 tasini berardi va qidiruv faqat shu
 * 10 ta ichida ishlardi (D-20). Qidiruv — mijozda, olingan ro'yxat bo'yicha.
 */
const CATALOG_PARAMS = { limit: PRODUCT_LIST_MAX_LIMIT };

/**
 * Tanlangan market katalogi (market rolida — o'zining). `Step2Combined` (ro'yxat, narx matni) va `Step2Summary`
 * («Umumiy summa» taklifi) bir xil so'rovni ishlatadi — react-query keshidan, ikkinchi so'rov ketmaydi.
 */
export const useOrderCatalog = (control: Control<OrderCreateFormValues>) => {
  const role = useSelector((state: RootState) => state.role.role);
  const isMarketRole = role === "market";
  const market = useWatch({ control, name: "market" });
  const marketId = market ? String(market.id) : "";

  const { useGetByMarketId, useGetMyProducts } = useProducts();
  const marketProductsQuery = useGetByMarketId(marketId, !isMarketRole, CATALOG_PARAMS);
  const myProductsQuery = useGetMyProducts(isMarketRole, CATALOG_PARAMS);
  const query = isMarketRole ? myProductsQuery : marketProductsQuery;

  const products = useMemo(() => toApiList<CatalogProduct>(query.data), [query.data]);
  const byId = useMemo(() => new Map(products.map((product) => [String(product.id), product])), [products]);
  const findProduct = useCallback((id: string | null | undefined) => (id == null ? undefined : byId.get(id)), [byId]);

  return { products, findProduct, isLoading: query.isLoading };
};
