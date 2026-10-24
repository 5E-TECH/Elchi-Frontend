/**
 * 6kHnNH9j: buyurtma manbasi — javobdagi `fulfillment_source` (`HQ` | `WAREHOUSE`) va `warehouse: { id, name,
 * branch_id } | null`. Maydon yo'q (eski javob) — HQ.
 */
export type FulfillmentInfo = {
  fromWarehouse: boolean;
  warehouseId: string | null;
  warehouseName: string | null;
};

type Raw = Record<string, unknown>;

const asRecord = (value: unknown): Raw | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Raw) : null;

const textOf = (value: unknown): string | null => {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
};

export const readFulfillmentSource = (order: unknown): FulfillmentInfo => {
  const record = asRecord(order);
  const fromWarehouse = String(record?.fulfillment_source ?? "").toUpperCase() === "WAREHOUSE";
  const warehouse = asRecord(record?.warehouse);
  return {
    fromWarehouse,
    warehouseId: fromWarehouse ? textOf(warehouse?.id) : null,
    warehouseName: fromWarehouse ? textOf(warehouse?.name) : null,
  };
};
