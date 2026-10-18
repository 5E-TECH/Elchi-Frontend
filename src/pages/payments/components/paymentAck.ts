/**
 * Kuryerning bot kvitansiyasiga javobi (2crjWf7v).
 *
 * Backend kuryer kassasi tarixida (`GET finance/cashbox/user/:id?cashbox_type=couriers`,
 * kuryerning `GET finance/cashbox/my-cashbox`) `source_type: "courier_payment"` qatorlariga
 * `payment_ack` qo'shadi:
 *  - `"confirmed"` — kuryer botda «👍 Tasdiqlayman» bosgan;
 *  - `"disputed"`  — «❗️ Noto'g'ri» bosgan;
 *  - `null`        — javob yo'q.
 * Boshqa qatorlarda maydon umuman yo'q (`undefined`).
 */
export type PaymentAck = "confirmed" | "disputed";

/**
 * Xom qiymat → `PaymentAck` / `null` / `undefined`.
 * Noma'lum qiymat (kelajakdagi yangi holat) belgisiz qoladi — `null` (javob yo'q) deb ko'rsatiladi.
 */
export const toPaymentAck = (value: unknown): PaymentAck | null | undefined => {
  if (value === undefined) return undefined;
  if (value === "confirmed" || value === "disputed") return value;
  return null;
};
