import { getErrorStatus } from "../../../shared/lib/errorKind";

/**
 * Ombor kontrakti xato kodlari (XtcEyQjb): `409 { code: "WAREHOUSE_PAUSED" }` — to'xtatilgan omborga kirim;
 * `403 { code: "WAREHOUSE_STOCK_FORBIDDEN" }` — market operatoriga «Ombordagi qoldiq» yopiq.
 */
export const WAREHOUSE_ERROR_CODES = {
  paused: "WAREHOUSE_PAUSED",
  stockForbidden: "WAREHOUSE_STOCK_FORBIDDEN",
  /** 2026-11-13: ombordan o'chirib bo'lmaydi — dona faol buyurtmalarda band (409). */
  stockReserved: "WAREHOUSE_STOCK_RESERVED",
} as const;

type Raw = Record<string, unknown>;

const asRecord = (value: unknown): Raw | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Raw) : null;

const CODE_PATTERN = /^[A-Z][A-Z0-9_]{2,63}$/;

const codeOf = (value: unknown): string | null =>
  typeof value === "string" && CODE_PATTERN.test(value.trim()) ? value.trim() : null;

/**
 * Javobdagi mashina kodi: `{ code }`, `{ error_code }`, `{ error: { code } }`, gateway o'rami `{ data: { code } }`; kod
 * alohida maydonda kelmasa, `message` / `error` ning o'zi kod bo'lsa (`"WAREHOUSE_PAUSED"`) — shu. Yo'q — `null`.
 * Matnli xabar (`"Ombor to'xtatilgan"`) kod hisoblanmaydi — UI faqat i18n matnini ko'rsatadi.
 */
export const getApiErrorCode = (error: unknown): string | null => {
  const data = asRecord(asRecord(asRecord(error)?.response)?.data);
  if (!data) return null;
  const nested = asRecord(data.data);
  const errorObject = asRecord(data.error);
  return (
    codeOf(data.code) ??
    codeOf(data.error_code) ??
    codeOf(errorObject?.code) ??
    codeOf(nested?.code) ??
    codeOf(data.message) ??
    codeOf(data.error) ??
    null
  );
};

/** `POST /warehouses/:id/stock-in` → 409 `WAREHOUSE_PAUSED` (to'xtatilgan omborga kirim qilinmaydi). */
export const isWarehousePausedError = (error: unknown): boolean =>
  getErrorStatus(error) === 409 && getApiErrorCode(error) === WAREHOUSE_ERROR_CODES.paused;

/** `DELETE /warehouses/:id/stock/:productId` → 409 `WAREHOUSE_STOCK_RESERVED` (band dona bor — o'chirilmaydi). */
export const isWarehouseStockReservedError = (error: unknown): boolean =>
  getErrorStatus(error) === 409 && getApiErrorCode(error) === WAREHOUSE_ERROR_CODES.stockReserved;

/**
 * `GET /market/warehouse-stock` → 403: market operatoriga kalit yoqilmagan (`WAREHOUSE_STOCK_FORBIDDEN`). Kodsiz 403
 * ham shu holat — sahifa uchun ma'nosi bir xil (ko'rish yopiq).
 */
export const isWarehouseStockForbidden = (error: unknown): boolean => getErrorStatus(error) === 403;
