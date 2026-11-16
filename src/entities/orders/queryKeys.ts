/**
 * Buyurtma so'rovlari kalit prefikslari (`entities/orders` hook'lari shulardan quradi) — bo'lim xato chegarasining
 * «Qayta urinish»i shu so'rovlarni qayta yuboradi (QKCeGZ3N). Alohida modul: sahifa testlari `entities/orders` ni
 * to'liq soxtalashtirsa ham kalitlar joyida.
 */
const orders = "orders";

/** Qo'shimcha xarajat tasdiqlari (market bosh sahifasi): kutilayotganlar va avtomatik tasdiqlanganlar. */
export const EXTRA_COST_APPROVALS_QUERY_KEY = [orders, "extra-cost-approvals"] as const;

/** Marketning yangi buyurtmalari (`GET orders/markets/:id/new`, buyurtma yaratish yon kartasi). */
export const todayOrdersByMarketKey = (marketId: string | number) => [orders, marketId] as const;
