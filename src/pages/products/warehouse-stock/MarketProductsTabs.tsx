// dizayn-v2: market-products-list, market-products-warehouse-stock
import { useTranslation } from "react-i18next";
import { useMarketWarehouseStock } from "../../../entities/warehouse";
import { Tabs } from "../../../shared/ui/primitives";
import { MARKET_WAREHOUSE_VIEW } from "./marketStockView";

/**
 * MARKET «MAHSULOTLAR» TABLARI (maket `market-products-warehouse-stock`): «Mahsulotlar N» · «Ombordagi qoldiq N»
 * (havola tablar, `?view=warehouse`). Sonlar — `GET /market/warehouse-stock` xulosasidan (`products_total`,
 * `products_in_warehouses`); so'rov yiqilsa (ombor moduli hali yo'q) — «Mahsulotlar» soni ro'yxatdan, ikkinchisi sonsiz.
 */
export const MarketProductsTabs = ({
  value,
  productsTotal,
}: {
  value: "list" | typeof MARKET_WAREHOUSE_VIEW;
  productsTotal?: number;
}) => {
  const { t } = useTranslation("warehouses");
  const counts = useMarketWarehouseStock({ page: 1, limit: 1 });
  const summary = counts.data?.summary;
  const listCount = summary?.productsTotal ?? productsTotal;
  return (
    <Tabs
      ariaLabel={t("market.tabsLabel")}
      background="bg"
      value={value}
      items={[
        { value: "list", label: t("market.tabs.list"), to: "/products", end: true, ...(listCount !== undefined ? { count: listCount } : {}) },
        {
          value: MARKET_WAREHOUSE_VIEW,
          label: t("market.tabs.warehouse"),
          to: `/products?view=${MARKET_WAREHOUSE_VIEW}`,
          ...(summary ? { count: summary.productsInWarehouses } : {}),
        },
      ]}
    />
  );
};
