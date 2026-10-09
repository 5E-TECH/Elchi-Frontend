import { readReturnRequest } from "../../../entities/order";
import { extractScannerToken } from "../../../shared/lib/scanToken";

/**
 * Marketga qaytarish — kim, qachon (backend bilan bir xil).
 *
 * - Boshlash (`POST orders/:id/initiate-return`): superadmin, admin, registrator;
 *   buyurtma `waiting` yoki `waiting_customer` da va hali so'ralmagan.
 * - Topshirish (`POST orders/:id/mark-returned-to-market`): filial xodimi
 *   (menejer, registrator); qaytarish so'ralgan va buyurtma sotilmagan /
 *   allaqachon qaytarilmagan. Backend market QR ruxsatini (`authorization_token`)
 *   MAJBURIY talab qiladi.
 */

const normalizeStatus = (status: unknown) =>
  String(status ?? "").trim().toLowerCase().replaceAll("_", " ").replace(/\s+/g, " ");

const INITIATE_ROLES = new Set(["superadmin", "admin", "registrator"]);
const INITIATE_STATUSES = new Set(["waiting", "waiting customer"]);

const HANDOVER_ROLES = new Set(["manager", "registrator"]);
// Backend rad etadi: sotilgan/to'langan (avval rollback) yoki allaqachon qaytarilgan.
const NOT_HANDOVERABLE_STATUSES = new Set(["sold", "paid", "partly paid", "returned to market"]);

type OrderLike = { status?: unknown; return_requested?: unknown; return_reason?: unknown } | null | undefined;

export const canInitiateReturn = (role: string | null | undefined, order: OrderLike) =>
  INITIATE_ROLES.has(String(role ?? "")) &&
  INITIATE_STATUSES.has(normalizeStatus(order?.status)) &&
  !readReturnRequest(order).requested;

export const canMarkReturnedToMarket = (role: string | null | undefined, order: OrderLike) =>
  HANDOVER_ROLES.has(String(role ?? "")) &&
  readReturnRequest(order).requested &&
  !NOT_HANDOVERABLE_STATUSES.has(normalizeStatus(order?.status));

/**
 * Market QR (`MCR-...`) — skaner yoki kamera matnidan. Topilmasa — "".
 * Token base64url (registrga sezgir) — kichik harfga O'TKAZILMAYDI, aks holda
 * backend uni topmaydi.
 */
export const extractMarketQrToken = (rawValue: string) => {
  const candidates = [rawValue.trim(), extractScannerToken(rawValue, window.location.origin) ?? ""];
  return candidates.find((candidate) => candidate.slice(0, 4).toUpperCase() === "MCR-") ?? "";
};

/** `POST scan/market-cancelled` javobidan 5 daqiqalik ruxsat (`MHA-...`). */
export const readHandoverAuthorization = (response: unknown) => {
  const body = (response && typeof response === "object" ? response : {}) as Record<string, unknown>;
  const data = (body.data && typeof body.data === "object" ? body.data : body) as Record<string, unknown>;
  const nested = (data.data && typeof data.data === "object" ? data.data : {}) as Record<string, unknown>;
  const token = [data.authorization_token, nested.authorization_token].find(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );
  return token?.trim() ?? "";
};
