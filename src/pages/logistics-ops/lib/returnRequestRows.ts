export type ReturnRequestRow = {
  key: string;
  id: string;
  order_id: string;
  status: string;
  courier: string;
  /** Kuryer id (`groups[].courier_id`); kuryersiz guruhda — bo'sh. */
  courierId: string;
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

  const toRow = (order: unknown, courierName: string, courierId: string, index: number): ReturnRequestRow => {
    const record = asRecord(order);
    const id = toText(record.id ?? record.order_id);
    return {
      key: id || `row-${index}`,
      id,
      order_id: toText(record.order_id ?? record.id),
      status: toText(record.status),
      courier: courierName,
      courierId,
    };
  };

  if (groups) {
    let index = 0;
    return groups.flatMap((group) => {
      const groupRecord = asRecord(group);
      const courier = asRecord(groupRecord.courier);
      const courierId = toText(groupRecord.courier_id) || toText(courier.id);
      const courierName = toText(courier.name) || courierId;
      const orders = Array.isArray(groupRecord.orders) ? groupRecord.orders : [];
      return orders.map((order) => toRow(order, courierName, courierId, index++));
    });
  }

  const legacyRows = Array.isArray(payload)
    ? payload
    : Array.isArray(root.data)
      ? root.data
      : [];
  return legacyRows.map((order, index) => toRow(order, "", "", index));
};

/** Kimning ombori: `HQ` — superadmin/admin va HQ xodimlari, `BRANCH` — filial menejeri/registratori. */
export type ReturnRequestScope = "HQ" | "BRANCH";

/** Ro'yxat javobidagi doira (`data.scope.type`); noma'lum bo'lsa — `null`. */
export const extractReturnRequestScope = (payload: unknown): ReturnRequestScope | null => {
  const root = asRecord(payload);
  const scope = asRecord(asRecord(root.data).scope ?? root.scope);
  const type = toText(scope.type).toUpperCase();
  return type === "HQ" || type === "BRANCH" ? type : null;
};

export type ReturnRequestCourierGroup = {
  key: string;
  /** Kuryer ismi; kuryersiz guruhda — bo'sh. */
  courier: string;
  courierId: string;
  rows: ReturnRequestRow[];
};

/**
 * Tanlangan qatorlarni kuryer bo'yicha guruhlaydi (tasdiq oynasi, maket
 * `superadmin-ops-logistics-approve-dialog`): ro'yxat tartibida, kuryersiz
 * guruh — oxirida.
 */
export const groupReturnRequestRowsByCourier = (rows: ReturnRequestRow[]): ReturnRequestCourierGroup[] => {
  const groups = new Map<string, ReturnRequestCourierGroup>();
  for (const row of rows) {
    const key = row.courierId || row.courier;
    const group = groups.get(key) ?? { key, courier: row.courier, courierId: row.courierId, rows: [] };
    group.rows.push(row);
    groups.set(key, group);
  }
  const list = [...groups.values()];
  return [...list.filter((group) => group.key), ...list.filter((group) => !group.key)];
};

export type ApproveReturnResult = {
  /** Omborga qaytarilganlar soni. */
  approved: number;
  /** Shu orada ko'rib chiqilgan yoki holati o'zgargani uchun o'tkazib yuborilgan buyurtma id lari. */
  skippedOrderIds: string[];
};

/**
 * `POST post/return-requests/approve` javobi: `{ data: { approved, order_ids, skipped_order_ids } }`.
 * Maydon kelmasa — yuborilganlar hammasi tasdiqlangan deb olinadi (eski javob shakli).
 */
export const parseApproveReturnResult = (payload: unknown, requestedOrderIds: string[]): ApproveReturnResult => {
  const root = asRecord(payload);
  const data = asRecord(root.data ?? root);
  const skippedOrderIds = Array.isArray(data.skipped_order_ids)
    ? data.skipped_order_ids.map(toText).filter(Boolean)
    : [];
  const approved =
    typeof data.approved === "number" && Number.isFinite(data.approved)
      ? data.approved
      : Array.isArray(data.order_ids)
        ? data.order_ids.length
        : Math.max(requestedOrderIds.length - skippedOrderIds.length, 0);
  return { approved, skippedOrderIds };
};
