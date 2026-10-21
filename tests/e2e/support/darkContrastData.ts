/** `/payments` ni matn bilan to'ldiradigan soxta javoblar (KPI, tarix qatorlari) — kontrast smoke uchun. */
const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();

const row = (id: string, amount: number, sourceType: string, operation: "income" | "expense", minutesAgo: number, comment?: string) => ({
  id,
  amount,
  operation_type: operation,
  source_type: sourceType,
  payment_method: "cash",
  cashbox_type: "main",
  comment: comment ?? null,
  balance_after: 4_250_000,
  createdByUser: { id: 7, name: "Mohira Qodirova", role: "manager" },
  createdAt: at(minutesAgo),
});

export const PAYMENTS_HANDLERS: Record<string, unknown> = {
  "finance/cashbox/all-info": {
    main: { balance: 4_250_000 },
    couriers: { totalBalans: 1_850_000 },
    markets: { totalBalans: -2_400_000 },
    olinishi_kerak: 3_100_000,
  },
  "finance/history": {
    items: [
      row("901", 2_400_000, "market_payment", "expense", 5, "Oktabr hisob-kitobi"),
      row("902", 1_850_000, "courier_payment", "income", 30),
      row("903", 420_000, "sell", "income", 90),
    ],
    pagination: { total: 3, page: 1, limit: 10, totalPages: 1 },
  },
};
