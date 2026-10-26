/**
 * 6kHnNH9j: buyurtma manbasi — javobdagi `fulfillment_source` (`HQ` | `WAREHOUSE`) va `warehouse: { id, name,
 * branch_id, kind? } | null`. Maydon yo'q (eski javob) — HQ.
 */
export type FulfillmentInfo = {
  fromWarehouse: boolean;
  warehouseId: string | null;
  warehouseName: string | null;
  /**
   * hfkhYrGk №4: ombor turi — `warehouse.kind`: `HQ` — Markaziy ombor (buyurtma HQ'da qabul qilinadi), `REGIONAL` —
   * viloyat ombori (buyurtma to'g'ridan-to'g'ri viloyat filialida, HQ'dan o'tmaydi). Backend bermasa — `null`
   * (iste'molchi uni viloyat ombori deb oladi: Markaziy ombor faqat `kind: HQ` bilan aniqlanadi).
   */
  warehouseKind: "HQ" | "REGIONAL" | null;
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
  const kind = String(warehouse?.kind ?? "").toUpperCase();
  return {
    fromWarehouse,
    warehouseId: fromWarehouse ? textOf(warehouse?.id) : null,
    warehouseName: fromWarehouse ? textOf(warehouse?.name) : null,
    warehouseKind: fromWarehouse && (kind === "HQ" || kind === "REGIONAL") ? kind : null,
  };
};
