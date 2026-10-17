import type { BatchDetail, BatchStatus } from "../../../entities/batch";
import { getBackendErrorMessage, type ScanResourceType } from "../lib/scanResource";

/**
 * SKANER NATIJASI — paket (`BTB-` / `BTR-`) va pochta (`PST-`) ko'rinish modeli (sof funksiyalar).
 *
 * Backend (`origin/main`) faktlari:
 *  - `GET scan/:token` (paket) — paket qatorining o'zi: `id`, `status` (PENDING · SENT · RECEIVED · CANCELLED),
 *    `order_count`, `total_price`, `driver_name`, `vehicle_plate`, `createdAt` va `items[] { order_id,
 *    snapshot_price }`. Filial / viloyat NOMLARI va buyurtmaning mijozi bu javobda YO'Q (faqat id).
 *    Xodim rollari uchun sahifa ularni `GET transfer-batches/:id` (`useBatchDetail`, `/batches/:id` bilan bir
 *    xil) dan oladi; kuryerga bu endpoint yopiq (403) — kuryer faqat skan javobini ko'radi.
 *  - `GET post/scan/:id` — pochta qatorining o'zi (`order_quantity`, `post_total_price`, `region_id`,
 *    `courier_id`): buyurtmalar ro'yxati, viloyat va kuryer NOMI yo'q. Bor bo'lsa ko'rsatiladi, yo'q bo'lsa
 *    chizilmaydi («Pochtani ochish» — to'liq ma'lumot pochta sahifasida).
 */

type AnyRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is AnyRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim() && value.trim() !== "—") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
};

const amount = (value: unknown): number | null => {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

const first = <T>(...values: T[]): T | undefined => values.find((value) => value !== undefined && value !== null);

const nameOf = (value: unknown): string | null =>
  isRecord(value) ? text(value.name ?? value.title ?? value.branch_name) : text(value);

/** `{ type, data: {...} }` / `{ statusCode, data: {...} }` o'ramlari → ichki yozuv. */
const unwrap = (response: unknown): AnyRecord | null => {
  let current: unknown = response;
  for (let depth = 0; depth < 3 && isRecord(current) && isRecord(current.data); depth += 1) {
    current = current.data;
  }
  return isRecord(current) ? current : null;
};

/** Paket / pochta ichidagi bitta buyurtma qatori (jadval va telefon kartasi). */
export interface ScanListOrderRow {
  id: string;
  customer: string | null;
  phone: string | null;
  amount: number | null;
  /** Buyurtma holati (`OrderStatusBadge`); javobda bo'lmasa `null` — badge chizilmaydi. */
  status: string | null;
}

const toOrderRow = (raw: unknown, index: number): ScanListOrderRow => {
  const row = isRecord(raw) ? raw : {};
  const order = isRecord(row.order) ? row.order : {};
  const customer = first(order.customer, row.customer);
  const customerRecord = isRecord(customer) ? customer : {};
  return {
    id:
      text(first(order.id, row.order_id, row.orderId, row.id, row._id)) ?? `#${index + 1}`,
    customer: text(first(customerRecord.name, order.receiver, row.receiver, row.customer_name, row.name)),
    phone: text(first(customerRecord.phone_number, customerRecord.phone, row.phone, row.phone_number)),
    amount: amount(first(order.total_price, row.total_price, row.snapshot_price, row.price, row.amount)),
    status: text(first(order.status, row.status)),
  };
};

/* ─── Paket ─────────────────────────────────────────────────────────────── */

/** Backend paket holati → `entities/batch` holati (`BATCH_STATUS_TONE`, `newOrders:batchStatus.*`). */
export const toScanBatchStatus = (value: unknown): BatchStatus | null => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (["pending", "new", "created"].includes(normalized)) return "new";
  if (["sent", "on_the_way", "in_transit"].includes(normalized)) return "on_the_way";
  if (["received", "accepted"].includes(normalized)) return "received";
  if (["cancelled", "canceled"].includes(normalized)) return "cancelled";
  return null;
};

/** Paket raqami maketdagidek «B-137» (`/batches` bilan bir xil ko'rinish). */
export const formatScanBatchCode = (id: string) => (id.startsWith("B-") ? id : `B-${id}`);

export interface ScanPackageView {
  id: string;
  code: string;
  returned: boolean;
  status: BatchStatus | null;
  createdAt: string | null;
  total: number;
  ordersCount: number;
  fromBranch: string | null;
  destinationRegion: string | null;
  driver: string | null;
  vehicle: string | null;
  orders: ScanListOrderRow[];
}

const fromBatchDetail = (detail: BatchDetail): Partial<ScanPackageView> => ({
  fromBranch: text(detail.from_branch?.name),
  destinationRegion: text(detail.to_branch?.region),
  driver: text(detail.driver),
  vehicle: text(detail.vehicle_plate),
  orders: detail.orders.map((order) => ({
    id: order.id,
    customer: text(order.receiver),
    phone: text(order.phone),
    amount: Number.isFinite(order.price) ? order.price : null,
    status: text(order.status),
  })),
});

/**
 * Skan javobi (+ xodimda `GET transfer-batches/:id`) → paket ko'rinishi. `id` yo'q javob — `null`
 * (sahifa «Paket topilmadi»). Tafsilot kelgan bo'lsa nomlar va buyurtmalar o'sha yerdan.
 */
export const buildScanPackageView = (
  response: unknown,
  type: ScanResourceType,
  detail?: BatchDetail | null,
): ScanPackageView | null => {
  const payload = unwrap(response);
  if (!payload) return null;
  const id = text(first(payload.id, payload.package_id, payload.batch_id));
  if (!id) return null;

  const items = first(payload.orders, payload.items, payload.order_list);
  const scanOrders = Array.isArray(items) ? items.map(toOrderRow) : [];
  const enriched = detail && text(detail.id) === id ? fromBatchDetail(detail) : {};

  const view: ScanPackageView = {
    id,
    code: formatScanBatchCode(id),
    returned: type === "returned-package",
    status: toScanBatchStatus(payload.status),
    createdAt: text(first(payload.createdAt, payload.created_at, payload.sent_at, payload.updatedAt)),
    total: amount(first(payload.total_price, payload.totalPrice, payload.total_amount, payload.amount)) ?? 0,
    ordersCount: 0,
    fromBranch: nameOf(first(payload.source_branch, payload.from_branch, payload.fromBranch)) ??
      text(first(payload.source_branch_name, payload.from_branch_name)),
    destinationRegion:
      nameOf(first(payload.region, payload.destination_region, payload.to_region)) ??
      text(first(payload.target_region_name, payload.region_name)),
    driver: text(first(payload.driver_name, isRecord(payload.driver) ? payload.driver.name : payload.driver)),
    vehicle: text(first(payload.vehicle_plate, payload.vehicle_number, payload.car_number, payload.plate_number)),
    orders: scanOrders,
  };

  const merged: ScanPackageView = {
    ...view,
    fromBranch: enriched.fromBranch ?? view.fromBranch,
    destinationRegion: enriched.destinationRegion ?? view.destinationRegion,
    driver: enriched.driver ?? view.driver,
    vehicle: enriched.vehicle ?? view.vehicle,
    orders: enriched.orders && enriched.orders.length > 0 ? enriched.orders : view.orders,
  };
  const declaredCount = amount(first(payload.order_count, payload.orders_count, payload.ordersCount));
  merged.ordersCount = declaredCount ?? merged.orders.length;
  return merged;
};

/**
 * «Qabul qilish» xatosi → tushunarli matn kaliti (`scan:package.*`). Backend matni ma'lum holatga
 * tushmasa — o'zi (yoki umumiy xato).
 */
export const getPackageReceiveError = (
  error: unknown,
): { key: "alreadyReceived" | "cancelled" | "wrongBranch" | "receiveError"; message: string | null } => {
  const message = getBackendErrorMessage(error) ?? null;
  const normalized = message?.toLowerCase() ?? "";
  if (["already", "qabul qilingan", "accepted", "received"].some((part) => normalized.includes(part))) {
    return { key: "alreadyReceived", message: null };
  }
  if (["cancel", "bekor"].some((part) => normalized.includes(part))) return { key: "cancelled", message: null };
  if (["branch", "filial", "permission", "ruxsat"].some((part) => normalized.includes(part))) {
    return { key: "wrongBranch", message: null };
  }
  return { key: "receiveError", message };
};

/* ─── Pochta ────────────────────────────────────────────────────────────── */

export interface ScanPostView {
  id: string;
  createdAt: string | null;
  total: number;
  ordersCount: number;
  region: string | null;
  courier: string | null;
  /** Javobda buyurtmalar ro'yxati bo'lmasa `null` — karta chizilmaydi (bo'sh ro'yxat emas). */
  orders: ScanListOrderRow[] | null;
}

export const buildScanPostView = (response: unknown): ScanPostView | null => {
  const payload = unwrap(response);
  if (!payload) return null;
  const id = text(first(payload.id, payload.post_id));
  if (!id) return null;

  const list = first(payload.allOrdersByPostId, payload.orders, payload.items);
  const orders = Array.isArray(list) ? list.map(toOrderRow) : null;
  const firstOrder = orders && Array.isArray(list) && isRecord(list[0]) ? list[0] : null;
  const sum = orders?.reduce((total, order) => total + (order.amount ?? 0), 0) ?? 0;

  return {
    id,
    createdAt: text(first(payload.createdAt, payload.created_at, payload.updatedAt)),
    total: amount(first(payload.post_total_price, payload.total_price)) ?? sum,
    ordersCount: amount(first(payload.order_quantity, payload.orders_count)) ?? orders?.length ?? 0,
    region:
      nameOf(payload.region) ??
      (isRecord(payload.district) ? nameOf(payload.district.region) : null) ??
      (firstOrder ? nameOf(firstOrder.region) : null),
    courier: nameOf(first(payload.courier, payload.driver)),
    orders,
  };
};
