/**
 * SOTISHDA MARKETGA TO'LANGAN SUMMA (uguUEhin / T0UGh8bL).
 *
 * Kuryer mijozdan olgan puldan marketga o'zi bergan qismini kiritadi —
 * `POST /orders/sell/:id { paidAmount }`. Javobdagi `data.status`:
 * `paid` — marketga to'liq to'landi, `partly_paid` — qisman, `sold` — to'lovsiz.
 */

/** `POST /orders/sell/:id` tanasi (isbot fayli yuklangach `proofFileKeys` ga aylanadi). */
export type SellOrderPayload = {
  comment: string;
  extraCost: number;
  /** Faqat 0 dan katta bo'lsa yuboriladi — 0 eski xatti-harakat bilan bir xil. */
  paidAmount?: number;
  proof?: File;
};

export type SellPaymentStatus = "paid" | "partly_paid";

/** Javobdan to'lov holati; to'lovsiz sotuv (`sold`) yoki boshqa shakl — `null`. */
export const getSellPaymentStatus = (response: unknown): SellPaymentStatus | null => {
  const body = response as { data?: { status?: unknown } | null } | null | undefined;
  const status = body?.data?.status;
  return status === "paid" || status === "partly_paid" ? status : null;
};

/** Bildirishnoma matni kaliti (`orders` nomlar maydoni). */
export const SELL_PAYMENT_NOTICE_KEYS: Record<SellPaymentStatus, string> = {
  paid: "soldPaidFull",
  partly_paid: "soldPaidPartly",
};

/**
 * Marketga to'lanishi mumkin bo'lgan eng ko'p summa: `to_be_paid − extraCost`.
 * Bu faqat KO'RSATMA — yakuniy chegarani backend tekshiradi (400 xabari).
 * `to_be_paid` noma'lum bo'lsa `null`.
 */
export const getMarketPaidMax = (toBePaid: unknown, extraCost: number): number | null => {
  if (toBePaid === null || toBePaid === undefined || toBePaid === "") return null;
  const value = Number(toBePaid);
  if (!Number.isFinite(value)) return null;
  return Math.max(0, value - (Number(extraCost) || 0));
};
