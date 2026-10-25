import { useCallback, useMemo } from "react";
import { useWatch, type Control } from "react-hook-form";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../app/config/store";
import { PRODUCT_LIST_MAX_LIMIT, useProducts } from "../../../../entities/product";
import { isMarketSideRole } from "../../../../entities/user/lib/role";
import { toApiList, type OrderCreateFormValues } from "../model/orderCreateForm";
import type { CatalogProduct } from "../model/orderPricing";

/**
 * Katalog to'liq olinadi (gateway chegarasi 500): `limit` siz server 10 tasini berardi va qidiruv faqat shu
 * 10 ta ichida ishlardi (D-20). Qidiruv — serverda (`useCatalogSearch`, qNwXfqLL).
 */
const CATALOG_PARAMS = { limit: PRODUCT_LIST_MAX_LIMIT };

/**
 * Tanlangan market katalogi (market va market operatori rolida — o'z marketiniki, `my-products`; MO-7). `Step2Combined` (ro'yxat, narx matni) va `Step2Summary`
 * («Umumiy summa» taklifi) bir xil so'rovni ishlatadi — react-query keshidan, ikkinchi so'rov ketmaydi.
 */
export const useOrderCatalog = (control: Control<OrderCreateFormValues>) => {
  const role = useSelector((state: RootState) => state.role.role);
  // Market operatori ham market tomoni: market `id` si formada yo'q, katalog — `my-products` (MH-1, OfRSoRUX).
  const isMarketRole = isMarketSideRole(role);
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
