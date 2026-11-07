/**
 * SOTISH JAVOBIDAGI MARKETGA TO'LOV HOLATI (uguUEhin / T0UGh8bL).
 *
 * `POST /orders/sell/:id` javobidagi `data.status`:
 * `paid` — marketga to'liq to'landi, `partly_paid` — qisman, `sold` — to'lovsiz.
 * «Marketga to'langan summa» maydoni sotish oynasidan olib tashlangan (ega 2026-11-07) — `paidAmount` yuborilmaydi.
 */

/** `POST /orders/sell/:id` tanasi (isbot fayli yuklangach `proofFileKeys` ga aylanadi). */
export type SellOrderPayload = {
  comment: string;
  extraCost: number;
  proof?: File;
  /**
   * Almashtirish buyurtmasi (lQjt6sKP): kuryer eski mahsulotni mijozdan olganini tasdiqladi («Eski mahsulotni oldim»).
   * Faqat almashtirish buyurtmasida `true` yuboriladi — oddiy buyurtma tanasi o'zgarmaydi. Nomi aynan `oldItemCollected`
   * (gateway DTO; `old_item_collected` — 400 «should not exist»).
   */
  oldItemCollected?: boolean;
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
