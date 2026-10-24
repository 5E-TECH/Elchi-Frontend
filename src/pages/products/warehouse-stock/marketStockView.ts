import type { MarketStockWarehouse } from "../../../entities/warehouse";

/** Market «Ombordagi qoldiq» tabi — `/products?view=warehouse`. */
export const MARKET_WAREHOUSE_VIEW = "warehouse";

/**
 * Ustun sarlavhasi — qisqa nom (maket: «Samarqand», «Urgut»): filial nomidan «filiali» / «ombori» olib tashlanadi;
 * to'liq nom — `title` da.
 */
export const shortWarehouseName = (warehouse: Pick<MarketStockWarehouse, "name" | "branch">) => {
  const base = (warehouse.branch?.name || warehouse.name).trim();
  const short = base.replace(/\s+(filiali\s+ombori|ombori|filiali)$/i, "").trim();
  return short || base;
};
