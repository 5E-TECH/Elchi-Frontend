import { readFulfillmentSource } from "../../../entities/order";
import { normalizePersonName } from "../../../shared/lib/personName";
import { toUzbekistanPhoneValue } from "../../../shared/lib/phone";

export interface EditableOrderItem {
  id: string;
  quantity: number;
  product: { id: string } | null;
  /** Katalog id'si — `product` relatsiyasi kelmaganda ham (hamkor posilkasi, o'chirilgan mahsulot). */
  product_id?: string | null;
  /** Katalogsiz (erkin-matnli / hamkor) qator nomi. */
  product_name?: string | null;
}

/** `PATCH /orders/:id/full` dagi bitta qator (backend `OrderItemDto`). */
export interface OrderUpdateItem {
  product_id: string | null;
  product_name?: string;
  quantity: number;
}

export interface EditableOrderSnapshot {
  status: string;
  where_deliver: string;
  total_price: number;
  comment: string | null;
  address: string | null;
  district_id?: string;
  district?: { id?: string; region_id?: string };
  region?: { id?: string };
  items: EditableOrderItem[];
  customer: { name: string; phone_number: string };
  [key: string]: unknown;
}

export interface OrderEditForm {
  where_deliver: string;
  total_price: string;
  comment: string;
  items: EditableOrderItem[];
}

export type AddressUpdateValidationError = "region" | "district" | null;
export type CustomerUpdateValidationError = "name" | "phoneRequired" | "phoneFormat" | null;

const RECEIVED_OR_LATER = new Set([
  "received",
  "on the road",
  "waiting",
  "sold",
  "paid",
  "partly paid",
  "cancelled",
  "cancelled (sent)",
  "closed",
  "returned to market",
  "completed",
]);

/**
 * Filialga jo'natilgandan keyingi holatlar — mijoz va manzil ham qulflanadi. Bekor qilingan va marketga
 * topshirilgan buyurtma ham (maketlar `*-orders-detail-cancelled`: «Tahrirlash yopiq. Buyurtma bekor
 * qilingan / marketga topshirilgan — …»): kuryer yoki menejer bekor qilgan posilka allaqachon filialda bo'lgan.
 */
const SENT_TO_BRANCH_STATUSES = new Set([
  "on the road",
  "waiting",
  "sold",
  "paid",
  "partly paid",
  "cancelled",
  "cancelled (sent)",
  "closed",
  "returned to market",
  "completed",
]);

// Backend sell / cancel / partly-sell faqat WAITING va post_id bor buyurtmani qabul qiladi.
const ACTIONABLE_ORDER_STATUSES = new Set(["waiting"]);

export const normalizeOrderStatus = (status: string) => {
  const normalized = status.trim().toLowerCase().replaceAll("_", " ").replace(/\s+/g, " ");
  return normalized === "cancelled sent" ? "cancelled (sent)" : normalized;
};

export const canRunCourierAction = (
  order: { status?: string | null; post_id?: string | number | null } | null | undefined,
) =>
  Boolean(order?.post_id) &&
  ACTIONABLE_ORDER_STATUSES.has(normalizeOrderStatus(order?.status ?? ""));

export const isOrderReceivedOrLater = (status: string) =>
  RECEIVED_OR_LATER.has(normalizeOrderStatus(status));

/** Qulf qoidalari o'qiydigan maydonlar (`warehouse.kind` — Markaziy ombor). */
type LockableOrder = { status?: string | null; fulfillment_source?: unknown; warehouse?: unknown };

/**
 * Summa va mahsulotlar qulfmi: HQ qabul qilgan (yoki keyingi) buyurtma, yoki ombor buyurtmasi. Ombor buyurtmasi
 * yaratilishidanoq omborda band qilingan — ega 2026-11-13 dan HQ xodimi yaratgani `new` bo'lsa ham band tarkibi
 * o'zgarmaydi (backend 400 «Mahsulotlar omborda band qilingan …»).
 */
export const areOrderProductsLocked = (order: LockableOrder | null | undefined) =>
  Boolean(order) && (isOrderReceivedOrLater(order?.status ?? "") || readFulfillmentSource(order).fromWarehouse);

/**
 * Qulf sababi (matn uchun): `warehouse` — «omborda band qilingan» (viloyat ombori, yoki hali qabul qilinmagan har
 * qanday ombor buyurtmasi); `hq` — «HQ qabul qilgandan keyin …» (Markaziy ombor buyurtmasi qabuldan keyin ham shu).
 */
export const productsLockReasonOf = (order: LockableOrder | null | undefined): "hq" | "warehouse" => {
  const { fromWarehouse, warehouseKind } = readFulfillmentSource(order);
  if (!fromWarehouse) return "hq";
  return warehouseKind !== "HQ" || !isOrderReceivedOrLater(order?.status ?? "") ? "warehouse" : "hq";
};

export const isOrderSentToBranch = (order: EditableOrderSnapshot) => {
  if (SENT_TO_BRANCH_STATUSES.has(normalizeOrderStatus(order.status))) return true;

  const explicitFlags = [
    order.is_sent_to_branch,
    order.sent_to_branch,
    order.is_transferred,
    order.transferred,
  ];
  if (explicitFlags.some((value) => value === true)) return true;

  return Boolean(
    order.transfer_batch_id ??
      order.batch_id ??
      order.destination_branch_id ??
      order.target_branch_id,
  );
};

/**
 * Backend `items` ni TO'LIQ almashtiradi (`replaceOrderItems`: eski qatorlar o'chiriladi, faqat
 * yuborilgani yoziladi) — shuning uchun HAR qator yuboriladi: katalog qatori `product_id` bilan
 * (`product` kelmagan bo'lsa ham), katalogsiz qator `product_id: null` + `product_name` bilan; nom bo'lsa
 * u ham (almashtirishda yo'qolmasin). Ilgari faqat `product.id` li qatorlar qolardi va boshqa
 * mahsulot sonini o'zgartirish erkin-matnli qatorlarni o'chirib yuborardi. Na id, na nom bo'lmagan
 * qatorni backend 400 bilan rad etadi — u yuborilmaydi.
 */
const normalizeItems = (items: EditableOrderItem[]): OrderUpdateItem[] =>
  items.flatMap((item) => {
    const rawProductId = item.product?.id ?? item.product_id;
    const productId = rawProductId == null ? "" : String(rawProductId).trim();
    const productName = typeof item.product_name === "string" ? item.product_name.trim() : "";
    if (!productId && !productName) return [];
    return [
      {
        product_id: productId || null,
        ...(productName ? { product_name: productName } : {}),
        quantity: item.quantity,
      },
    ];
  });

/** Qatorlar tartibidan qat'i nazar taqqoslash kaliti. */
const itemsKey = (items: OrderUpdateItem[]) =>
  JSON.stringify(items.map((item) => JSON.stringify(item)).sort());

export const parseOrderTotalPrice = (value: string): number | null => {
  const normalized = value.trim();
  if (!normalized) return null;

  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
};

export const getAddressUpdateValidationError = (form: {
  region_id: string;
  district_id: string;
}): AddressUpdateValidationError => {
  if (!form.region_id.trim()) return "region";
  if (!form.district_id.trim()) return "district";
  return null;
};

export const getCustomerUpdateValidationError = (form: {
  name: string;
  phone: string;
}): CustomerUpdateValidationError => {
  if (!form.name.trim()) return "name";
  if (!form.phone.trim()) return "phoneRequired";

  const digits = form.phone.replace(/\D/g, "");
  const localDigits = digits.startsWith("998") ? digits.slice(3) : digits;
  return localDigits.length === 9 ? null : "phoneFormat";
};

export const buildOrderUpdatePayload = (
  order: EditableOrderSnapshot,
  form: OrderEditForm,
  locks: { products: boolean; destination: boolean },
) => {
  const payload: Record<string, unknown> = {};
  const nextTotalPrice = parseOrderTotalPrice(form.total_price);

  if (!locks.destination && form.where_deliver !== order.where_deliver) {
    payload.where_deliver = form.where_deliver;
  }
  if (
    !locks.products &&
    nextTotalPrice !== null &&
    nextTotalPrice !== Number(order.total_price)
  ) {
    payload.total_price = nextTotalPrice;
  }
  if ((form.comment ?? "") !== (order.comment ?? "")) {
    payload.comment = form.comment;
  }

  const nextItems = normalizeItems(form.items);
  if (!locks.products && itemsKey(nextItems) !== itemsKey(normalizeItems(order.items))) {
    payload.items = nextItems;
  }

  return payload;
};

export const buildAddressUpdatePayload = (
  order: EditableOrderSnapshot,
  form: { region_id: string; district_id: string; address: string },
) => {
  if (getAddressUpdateValidationError(form)) return {};

  const payload: Record<string, string> = {};
  const currentRegionId = order.district?.region_id ?? order.region?.id ?? "";
  const currentDistrictId = order.district_id ?? order.district?.id ?? "";

  const regionId = form.region_id.trim();
  const districtId = form.district_id.trim();
  const address = form.address.trim();

  if (regionId !== currentRegionId) payload.region_id = regionId;
  if (districtId !== currentDistrictId) payload.district_id = districtId;
  if (address !== (order.address ?? "")) payload.address = address;

  return payload;
};

export const buildCustomerUpdatePayload = (
  order: EditableOrderSnapshot,
  form: { name: string; phone: string },
) => {
  if (getCustomerUpdateValidationError(form)) return {};

  const payload: Record<string, string> = {};
  // Mijoz ismi — shaxs ismi: har so'z bosh harfi katta. Ism tegilmagan bo'lsa (saqlangani kichik harf bilan
  // bo'lsa ham) yuborilmaydi — eski yozuvlar ko'chirilmaydi, faqat tahrirlangan ism tekislanadi.
  const storedName = order.customer.name.trim();
  const name = normalizePersonName(form.name);
  const phone = toUzbekistanPhoneValue(form.phone);
  const currentPhone = toUzbekistanPhoneValue(order.customer.phone_number);

  if (form.name.trim() !== storedName && name !== storedName) payload.name = name;
  if (phone !== currentPhone) payload.phone_number = phone;

  return payload;
};
