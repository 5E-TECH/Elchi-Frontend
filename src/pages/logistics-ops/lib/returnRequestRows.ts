export type ReturnRequestRow = {
  key: string;
  id: string;
  order_id: string;
  status: string;
  courier: string;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const toText = (value: unknown) => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
};

/**
 * GET /post/return-requests/list javobini jadval qatorlariga aylantiradi
 * (fix3 CODE-09 / C13).
 *
 * Backend javobi: `{ statusCode, data: { total, scope, groups: [{ courier,
 * courier_id, orders: [...] }] } }` — kuryer bo'yicha guruhlangan. Sahifa esa
 * butun tanani massiv deb o'qirdi (`Array.isArray(res.data)`), shuning uchun
 * ro'yxat DOIM bo'sh edi. Eski (massiv) shakl ham qo'llab-quvvatlanadi.
 */
export const extractReturnRequestRows = (payload: unknown): ReturnRequestRow[] => {
  const root = asRecord(payload);
  const data = asRecord(root.data);
  const groups = Array.isArray(data.groups)
    ? data.groups
    : Array.isArray(root.groups)
      ? root.groups
      : null;

  const toRow = (order: unknown, courierName: string, index: number): ReturnRequestRow => {
    const record = asRecord(order);
    const id = toText(record.id ?? record.order_id);
    return {
      key: id || `row-${index}`,
      id,
      order_id: toText(record.order_id ?? record.id),
      status: toText(record.status),
      courier: courierName,
    };
  };

  if (groups) {
    let index = 0;
    return groups.flatMap((group) => {
      const groupRecord = asRecord(group);
      const courier = asRecord(groupRecord.courier);
      const courierName = toText(courier.name) || toText(groupRecord.courier_id);
      const orders = Array.isArray(groupRecord.orders) ? groupRecord.orders : [];
      return orders.map((order) => toRow(order, courierName, index++));
    });
  }

  const legacyRows = Array.isArray(payload)
    ? payload
    : Array.isArray(root.data)
      ? root.data
      : [];
  return legacyRows.map((order, index) => toRow(order, "", index));
};
