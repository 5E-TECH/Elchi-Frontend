import type { Page } from "@playwright/test";
import { setupShellSession } from "./shellSession";

/**
 * guzrGySp e2e yordamchisi — Balans → Tahlil «Eng katta ta'sir ko'rsatgan tranzaksiyalar»: backend top-impacts
 * qatorida `created_by_user: {id, name, role} | null` beradi (history bilan bir xil, 0c27571). Uch xil qator: ismli
 * muallif, topilmagan foydalanuvchi (`null` → `#id`) va tizim yozuvi (`created_by` yo'q → «Avtomatik»).
 */
export const TOP_IMPACT_ACTORS = ["Dilnoza Karimova", "#9", "Avtomatik"] as const;

const item = (id: number, amount: number, extra: Record<string, unknown>) => ({
  id: String(id),
  amount: Math.abs(amount),
  operation_type: amount < 0 ? "expense" : "income",
  source_type: amount < 0 ? "manual_expense" : "manual_income",
  payment_date: "2026-10-17T05:00:00.000Z",
  ...extra,
});

export const openTopImpactsWithActors = async (page: Page) => {
  const session = await setupShellSession(page, "superadmin", "E2E Superadmin", {
    "finance/cashbox/financial-balanse": {
      main: { balance: 5_000_000, cashbox: { balance: 5_000_000 } },
      markets: { allMarketCashboxes: [], marketsTotalBalans: 0 },
      couriers: { allCourierCashboxes: [], couriersTotalBalanse: 0 },
      currentSituation: 5_000_000,
      difference: 0,
    },
    "finance/financial-balance/top-impacts": {
      items: [
        item(1, 900_000, {
          created_by: "7",
          created_by_user: { id: "7", name: "Dilnoza Karimova", role: "admin" },
        }),
        item(2, -400_000, { created_by: "9", created_by_user: null }),
        item(3, 100_000, { created_by: null, created_by_user: null }),
      ],
      pagination: { total: 3, page: 1, limit: 10, totalPages: 1 },
    },
  });
  await page.goto("/financial-balance?tab=analysis");
  return session;
};
