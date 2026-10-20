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

/**
 * Kim ko'ryapti (KI-S1, ega javobi 2026-10-19):
 *  - `staff` — kassa xodimi (menejer, admin, superadmin, market): javobni kuryer bergan → «Kuryer tasdiqladi» /
 *    «Kuryer: noto'g'ri» (maket `manager-payments-cash-detail-courier-ack`, `manager-payments-history-detail-dialog-ack`);
 *  - `self` — kuryerning o'zi: javobni o'zi bergan → «Siz tasdiqlagansiz» / «Siz: noto'g'ri»
 *    (maket `courier-cashbox-my-transfers-ack`).
 */
export type PaymentAckAudience = "staff" | "self";

export type PaymentAckKeys = { label: string; hint: string };

/** `payments` nomlar fazosidagi yorliq va izoh (title) kalitlari; javob yo'q bo'lsa — `null`. */
export const paymentAckKeys = (
  ack: PaymentAck | null | undefined,
  audience: PaymentAckAudience = "staff",
): PaymentAckKeys | null => {
  if (ack !== "confirmed" && ack !== "disputed") return null;
  const base = `paymentAck${audience === "self" ? "Self" : "Staff"}${ack === "confirmed" ? "Confirmed" : "Disputed"}`;
  return { label: base, hint: `${base}Hint` };
};

/** Rol → auditoriya: kuryer o'z javobini ko'radi (`self`), qolgan hamma — xodim (`staff`). */
export const paymentAckAudienceOf = (role?: string | null): PaymentAckAudience =>
  role === "courier" ? "self" : "staff";
