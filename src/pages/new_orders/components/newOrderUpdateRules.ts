import { toUzbekistanPhoneValue } from "../../../shared/lib/phone";

export interface EditableOrderItem {
  id: string;
  quantity: number;
  product: { id: string } | null;
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
  "completed",
]);

const SENT_TO_BRANCH_STATUSES = new Set([
  "on the road",
  "waiting",
  "sold",
  "paid",
  "partly paid",
  "cancelled (sent)",
  "closed",
  "completed",
]);

const ACTIONABLE_ORDER_STATUSES = new Set(["waiting", "on the road", "new", "received"]);

export const normalizeOrderStatus = (status: string) => {
  const normalized = status.trim().toLowerCase().replaceAll("_", " ").replace(/\s+/g, " ");
  return normalized === "cancelled sent" ? "cancelled (sent)" : normalized;
};

export const isActionableOrderStatus = (status: string) =>
  ACTIONABLE_ORDER_STATUSES.has(normalizeOrderStatus(status));

export const isOrderReceivedOrLater = (status: string) =>
  RECEIVED_OR_LATER.has(normalizeOrderStatus(status));

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

const normalizeItems = (items: EditableOrderItem[]) =>
  items
    .map((item) => ({ product_id: item.product?.id ?? "", quantity: item.quantity }))
    .filter((item) => item.product_id)
    .sort((a, b) => a.product_id.localeCompare(b.product_id));

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
  if (!locks.products && JSON.stringify(nextItems) !== JSON.stringify(normalizeItems(order.items))) {
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
  const name = form.name.trim();
  const phone = toUzbekistanPhoneValue(form.phone);
  const currentPhone = toUzbekistanPhoneValue(order.customer.phone_number);

  if (name !== order.customer.name.trim()) payload.name = name;
  if (phone !== currentPhone) payload.phone_number = phone;

  return payload;
};
