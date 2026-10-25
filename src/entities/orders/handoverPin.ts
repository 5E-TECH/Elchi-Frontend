/**
 * Marketga topshirish — QR o'rniga market ekranidagi 6 xonali kod (zkRab9M2, BG6).
 * `POST scan/market-cancelled { market_id, pin }` — bekorlar sahifasi (`/new-orders/cancelled/:marketId`) va
 * qaytarilgan buyurtmani topshirish oynasi (`MarkReturnedModal`) bir xil o'qiydi.
 */

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

/**
 * Xodim yozgan yoki USB skaner bergan matndan 6 xonali kod («042 917», «042917» → «042917»); kod emas — `""`.
 * Boshidagi nol raqam — saqlanadi.
 */
export const extractHandoverPin = (rawValue: string) => {
  const compact = rawValue.replace(/[\s-]/g, "");
  return /^\d{6}$/.test(compact) ? compact : "";
};

/**
 * Kod xatosi (backend `data.reason`):
 *  - `invalid`  — kod noto'g'ri, `remainingAttempts` — yana nechta urinish;
 *  - `blocked`  — 5 marta xato: sessiya bloklangan (QR ham ishlamaydi), market yangi QR chiqarsin;
 *  - `expired`  — kod (QR) muddati tugagan;
 *  - `notFound` — marketda faol QR yo'q;
 *  - `unknown`  — boshqa xato (tarmoq, ruxsat, eski backend) — server matni ko'rsatiladi.
 */
export type HandoverPinErrorKind = "invalid" | "blocked" | "expired" | "notFound" | "unknown";

const PIN_ERROR_REASONS: Readonly<Record<string, HandoverPinErrorKind>> = {
  market_cancelled_pin_invalid: "invalid",
  market_cancelled_pin_blocked: "blocked",
  market_cancelled_pin_expired: "expired",
  market_cancelled_pin_not_found: "notFound",
};

export const readHandoverPinError = (
  error: unknown,
): { kind: HandoverPinErrorKind; remainingAttempts: number | null } => {
  const body = asRecord(asRecord(asRecord(error).response).data);
  const data = asRecord(body.data);
  const details = asRecord(data.details);
  const kind = (typeof data.reason === "string" && PIN_ERROR_REASONS[data.reason]) || "unknown";
  const remaining = Number(details.remaining_attempts);
  return {
    kind: kind === "invalid" && remaining === 0 ? "blocked" : kind,
    remainingAttempts: Number.isInteger(remaining) && remaining >= 0 ? remaining : null,
  };
};
