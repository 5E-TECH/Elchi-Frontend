/**
 * Posilka kimning qo'lida (custody) — backend qoidalarining FE nusxasi
 * (fix3b LC-04, LC-05).
 *
 * Ro'yxat qatorlari to'liq buyurtma yozuvi bo'lib keladi (`holder_type`,
 * `holder_courier_id`, `courier_id`); kuryer ro'yxatining eski (legacy)
 * shakli ham snake_case. camelCase variantlar himoya uchun o'qiladi.
 */

type CustodyFields = {
  holder_type?: unknown;
  holderType?: unknown;
  holder_courier_id?: unknown;
  holderCourierId?: unknown;
  courier_id?: unknown;
  courierId?: unknown;
  status?: unknown;
  transport_status?: unknown;
  transportStatus?: unknown;
};

const asCustody = (order: unknown): CustodyFields =>
  order && typeof order === "object" ? (order as CustodyFields) : {};

const toText = (value: unknown) =>
  typeof value === "string" || typeof value === "number" ? String(value).trim() : "";

/**
 * Backend `normalizeCourierId` bilan bir xil: `'0'` — tayinlanmagan pochta
 * sentineli, kuryer EMAS.
 */
const normalizeCourierId = (value: unknown) => {
  const id = toText(value);
  return id === "0" ? "" : id;
};

const normalizeStatus = (value: unknown) =>
  toText(value).toLowerCase().replaceAll("_", " ").replace("canceled", "cancelled");

const getHolderType = (order: CustodyFields) =>
  toText(order.holder_type ?? order.holderType).toUpperCase();

/**
 * Posilka kuryer qo'lidami. Backend `isHeldByCourier` (order-lifecycle) bilan
 * AYNAN bir xil: holder COURIER, yoki `holder_courier_id` / `courier_id`
 * to'ldirilgan (`'0'` hisoblanmaydi).
 *
 * LC-04: bunday buyurtmani menejer SOTMAYDI — backend 400 "Bu buyurtma kuryer
 * qo'lida — uni kuryerning o'zi sotadi" qaytaradi (sotish ham, qisman sotish
 * ham). Bekor qilish menejerga ochiq qoladi.
 */
export const isCourierHeldOrder = (order: unknown): boolean => {
  const record = asCustody(order);
  return (
    getHolderType(record) === "COURIER" ||
    Boolean(normalizeCourierId(record.holder_courier_id ?? record.holderCourierId)) ||
    Boolean(normalizeCourierId(record.courier_id ?? record.courierId))
  );
};

/**
 * Kuryer bekor qilingan buyurtmani "Qayta tiklash" qila oladimi (LC-05).
 *
 * Backend `rollbackOrderToWaiting` kuryer uchun: holat aynan CANCELLED va
 * posilka hali SHU kuryerda — `holder_courier_id` = kuryer, `holder_type`
 * COURIER (yoki eski yozuvlarda bo'sh). Filial/HQ qabul qilib bo'lgan bekor
 * buyurtma uchun 400 "Topshirilgan bekor buyurtmani qaytarib bo'lmaydi".
 *
 * Gateway kuryer ro'yxatida `cancelled (sent)` ni `cancelled` +
 * `transport_status: 'cancelled (sent)'` qilib ko'rsatadi — bunday qatorning
 * haqiqiy holati CANCELLED_SENT, uni kuryer qaytara olmaydi.
 */
export const canCourierRestoreCancelledOrder = (
  order: unknown,
  currentUserId: string | number | null | undefined,
): boolean => {
  const record = asCustody(order);
  if (normalizeStatus(record.status) !== "cancelled") return false;
  if (normalizeStatus(record.transport_status ?? record.transportStatus) === "cancelled (sent)") {
    return false;
  }

  const userId = toText(currentUserId);
  if (!userId) return false;

  const holderType = getHolderType(record);
  const holderCourierId = normalizeCourierId(record.holder_courier_id ?? record.holderCourierId);
  return (holderType === "" || holderType === "COURIER") && holderCourierId === userId;
};
