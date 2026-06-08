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

const RECEIVED_OR_LATER = new Set([
  "received",
  "on the road",
  "waiting",
  "sold",
  "paid",
  "partly_paid",
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
  "partly_paid",
  "cancelled (sent)",
  "closed",
  "completed",
]);

const normalizeStatus = (status: string) =>
  status.trim().toLowerCase().replaceAll("_", " ");

export const isOrderReceivedOrLater = (status: string) =>
  RECEIVED_OR_LATER.has(normalizeStatus(status));

export const isOrderSentToBranch = (order: EditableOrderSnapshot) => {
  if (SENT_TO_BRANCH_STATUSES.has(normalizeStatus(order.status))) return true;

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

export const buildOrderUpdatePayload = (
  order: EditableOrderSnapshot,
  form: OrderEditForm,
  locks: { products: boolean; destination: boolean },
) => {
  const payload: Record<string, unknown> = {};

  if (!locks.destination && form.where_deliver !== order.where_deliver) {
    payload.where_deliver = form.where_deliver;
  }
  if (!locks.products && Number(form.total_price) !== Number(order.total_price)) {
    payload.total_price = Number(form.total_price);
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
  const payload: Record<string, string> = {};
  const currentRegionId = order.district?.region_id ?? order.region?.id ?? "";
  const currentDistrictId = order.district_id ?? order.district?.id ?? "";

  if (form.region_id !== currentRegionId) payload.region_id = form.region_id;
  if (form.district_id !== currentDistrictId) payload.district_id = form.district_id;
  if (form.address !== (order.address ?? "")) payload.address = form.address;

  return payload;
};

export const buildCustomerUpdatePayload = (
  order: EditableOrderSnapshot,
  form: { name: string; phone: string },
) => {
  const payload: Record<string, string> = {};

  if (form.name !== order.customer.name) payload.name = form.name;
  if (form.phone !== order.customer.phone_number) payload.phone_number = form.phone;

  return payload;
};

export const getBackend400Message = (error: unknown) => {
  const response = (error as {
    response?: { status?: number; data?: { message?: unknown } };
  })?.response;

  if (response?.status !== 400 || typeof response.data?.message !== "string") {
    return null;
  }

  return response.data.message.trim() || null;
};
