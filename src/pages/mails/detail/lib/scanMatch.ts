import type { PostOrder } from "../../../../entities/mails";

/**
 * Pochta tafsilotidagi skaner va zaxira ro'yxat yordamchilari (sahifadan ko'chirildi, mantiq o'zgarmagan).
 *
 *  - `getOrderIdentifiers` / `unwrapScannedOrder` — QR'dan kelgan buyurtmani ro'yxatdagisi bilan moslash
 *    (id, QR token, bo'lingan/ota buyurtma identifikatorlari);
 *  - `isSameCustomerMarketOrder` — identifikator topilmasa bir xil mijoz + market (+ tuman) bo'yicha;
 *  - `extractOrderItems` — `GET orders` javobining turli shakllari (viloyat zaxirasi, fix3);
 *  - holat to'plamlari: bugungi pochta buyurtmalari va rad etilgan pochta buyurtmalari.
 */
export const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? value as Record<string, unknown> : {};

export const toText = (value: unknown) => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return "";
};

export const normalizeMatchText = (value: unknown) => toText(value).toLowerCase();

export const unwrapScannedOrder = (payload: unknown) => {
  const source = asRecord(payload);
  const data = asRecord(source.data ?? source);
  const nestedData = asRecord(data.data ?? data);
  return asRecord(nestedData.order ?? data.order ?? nestedData);
};

const addOrderIdentifiers = (target: Set<string>, value: unknown) => {
  const record = asRecord(value);
  [
    "id",
    "qr_code_token",
    "qrCodeToken",
    "token",
    "order_token",
    "orderToken",
    "parent_order_id",
    "parentOrderId",
    "original_order_id",
    "originalOrderId",
    "source_order_id",
    "sourceOrderId",
    "split_from_order_id",
    "splitFromOrderId",
    "cancelled_from_order_id",
    "cancelledFromOrderId",
    "partly_sold_order_id",
    "partlySoldOrderId",
    "root_order_id",
    "rootOrderId",
    "base_order_id",
    "baseOrderId",
  ].forEach((key) => {
    const text = normalizeMatchText(record[key]);
    if (text) target.add(text);
  });

  [
    "order",
    "parent_order",
    "parentOrder",
    "original_order",
    "originalOrder",
    "source_order",
    "sourceOrder",
    "split_from_order",
    "splitFromOrder",
    "cancelled_from_order",
    "cancelledFromOrder",
  ].forEach((key) => {
    const nested = asRecord(record[key]);
    ["id", "qr_code_token", "qrCodeToken", "token"].forEach((nestedKey) => {
      const text = normalizeMatchText(nested[nestedKey]);
      if (text) target.add(text);
    });
  });
};

export const getOrderIdentifiers = (value: unknown) => {
  const identifiers = new Set<string>();
  addOrderIdentifiers(identifiers, value);
  return identifiers;
};

const getComparableOrderInfo = (value: unknown) => {
  const order = asRecord(value);
  const customer = asRecord(order.customer);
  const market = asRecord(order.market);
  const district = asRecord(order.district);

  return {
    customerId: normalizeMatchText(order.customer_id ?? order.customerId ?? customer.id),
    name: normalizeMatchText(
      customer.name ??
        customer.full_name ??
        customer.fullName ??
        order.customer_name ??
        order.customerName ??
        order.name,
    ),
    phone: normalizeMatchText(
      customer.phone_number ??
        customer.phoneNumber ??
        customer.phone ??
        order.customer_phone ??
        order.customerPhone ??
        order.phone_number ??
        order.phone,
    ),
    marketId: normalizeMatchText(order.market_id ?? order.marketId ?? market.id),
    marketName: normalizeMatchText(market.name),
    districtId: normalizeMatchText(order.district_id ?? order.districtId ?? district.id),
    districtName: normalizeMatchText(district.name),
  };
};

export const isSameCustomerMarketOrder = (left: unknown, right: unknown) => {
  const a = getComparableOrderInfo(left);
  const b = getComparableOrderInfo(right);
  const sameCustomer =
    Boolean(a.customerId && a.customerId === b.customerId) ||
    Boolean(a.phone && a.phone === b.phone) ||
    Boolean(a.name && a.name === b.name);
  const sameMarket = Boolean(a.marketId && a.marketId === b.marketId) || Boolean(a.marketName && a.marketName === b.marketName);
  const sameDistrict =
    !a.districtId && !a.districtName && !b.districtId && !b.districtName
      ? true
      : Boolean(a.districtId && a.districtId === b.districtId) ||
        Boolean(a.districtName && a.districtName === b.districtName);

  return sameCustomer && sameMarket && sameDistrict;
};

export const extractOrderItems = (payload: unknown): PostOrder[] => {
  const response = payload as
    | PostOrder[]
    | {
      data?: PostOrder[] | { items?: PostOrder[]; data?: PostOrder[] };
      items?: PostOrder[];
    };

  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (!Array.isArray(response?.data) && Array.isArray(response?.data?.items)) return response.data.items;
  if (!Array.isArray(response?.data) && Array.isArray(response?.data?.data)) return response.data.data;
  if (Array.isArray(response?.items)) return response.items;

  return [];
};

export const TODAY_MAIL_ORDER_STATUSES = new Set(["on the road", "new", "received", "waiting"]);
export const REFUSED_MAIL_ORDER_STATUSES = new Set(["cancelled", "cancelled (sent)", "canceled", "canceled (sent)", "rejected"]);
