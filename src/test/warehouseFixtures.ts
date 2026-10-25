/**
 * Ombor API javoblari namunalari (backend OpenAPI misollari, Elchi-Backend#566) — `entities/warehouse` va ombor
 * sahifalari testlari uchun. Faqat testlar import qiladi.
 */
/** Backend namunasi (`WarehouseDto`, OpenAPI misollari). */
export const rawWarehouse = (extra: Record<string, unknown> = {}) => ({
  id: 3,
  name: "Samarqand filiali ombori",
  status: "ACTIVE",
  branch_id: "11",
  branch: { id: "11", name: "Samarqand filiali", type: "REGIONAL", status: "active", address: null },
  region: { id: "7", name: "Samarqand viloyati" },
  manager_user_id: "31",
  manager: { id: "31", name: "Dilshod Usmonov", phone_number: "+998915071244" },
  address: null,
  effective_address: "Samarqand sh.",
  low_stock_default: 5,
  note: null,
  paused_at: null,
  created_at: "2026-09-14T09:00:00.000Z",
  updated_at: "2026-10-20T09:00:00.000Z",
  summary: {
    positions: 12,
    markets: 5,
    on_hand: "486",
    reserved: 38,
    available: 448,
    reserved_orders: 14,
    low_count: 2,
    out_count: 1,
  },
  last_movement: { id: "901", type: "IN", qty: 40, ref_type: "stock_in", ref_id: "k-1", created_at: "2026-10-24T09:40:00Z" },
  ...extra,
});

export const rawProduct = (extra: Record<string, unknown> = {}) => ({
  id: "142",
  name: "Simsiz quloqchin",
  market_id: "121",
  sku_code: "ELC-P-000142",
  barcode: null,
  image_url: null,
  is_deleted: false,
  code: { value: "ELC-P-000142", kind: "sku", format: "ELC" },
  weight_kg: "0.2",
  length_cm: 15,
  width_cm: 10,
  height_cm: 6,
  volumetric_enabled: true,
  chargeable_weight_kg: 0.2,
  volumetric_weight_kg: 0.18,
  chargeable_basis: "actual",
  measure_missing: false,
  ...extra,
});
