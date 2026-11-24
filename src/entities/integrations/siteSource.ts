import type { Integration } from "./index";

/**
 * QAYSI ULANISH «SAYT» — QR skanerlab buyurtma olinadigan tashqi sayt («Tashqi saytlar» tabi).
 *
 * Buyurtma yaratish uchun ulanishda market bo'lishi SHART — backend `market_id` siz 400 beradi. Rol bo'yicha
 * qat'iy (`source`) tanlanmadi: migratsiya eski yozuvlarga sukut `carrier` qo'ygan va Donoxon kabi saytlar
 * hali shunday turibdi (`pages/integrations/connections.ts` dagi izoh) — ular ro'yxatdan tushib qolardi.
 * To'lov tizimi buyurtma bermaydi — chiqariladi.
 */
export const isExternalSite = (integration: Integration): boolean =>
  Boolean(integration.is_active) && Boolean(integration.market_id) && integration.role !== "payment";

/** Sayt skani sahifasi (`pages/new_orders/sites/scan.tsx`). */
export const siteScanPath = (integrationId: string | number): string => `/new-orders/sites/${integrationId}`;

/** Saytdan olingan buyurtmalar (backend 2026-11-25). `null` — noma'lum, 0 EMAS. */
export type ImportedOrders = { total: number; today: number; last_at: string | null };

export const importedOrdersOf = (integration: Pick<Integration, "imported_orders">): ImportedOrders | null =>
  integration.imported_orders ?? null;
