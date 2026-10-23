import { defineScene, expect, fixture } from "../support/test";

/**
 * «Buyurtmalar» — pilot sahnalar (infra): superadmin ro'yxati (oltin sahifa) va kuryer «Sotish» oynasi.
 * Qolgan buyurtma sahnalari (`orders-courier`, `order-detail`, `order-create`) — `order-pages.visual.ts`.
 * Ma'lumot sintetik (`tests/visual/fixtures/<sahna>/`), vaqtlar muzlatilgan soatdan oldin.
 */

defineScene({
  id: "orders",
  // 1 faol filtr chipi: «Yetkazish: Uygacha».
  route: "/orders?where_deliver=address",
  role: "superadmin",
  maket: ["superadmin-orders-list"],
  api: {
    "GET orders": fixture("orders/orders.json"),
    // Filtr variantlari (panel ochiq, ro'yxatlar yopiq — faqat market nomi chipda kerak bo'lsa ishlatiladi).
    "GET markets": fixture("orders/markets.json"),
    "GET branches": { statusCode: 200, data: [] },
    "GET couriers": { statusCode: 200, data: [] },
    "GET region": { statusCode: 200, data: [] },
  },
});

defineScene({
  id: "order-sell-dialog",
  route: "/orders",
  role: "courier",
  branchType: "REGIONAL",
  maket: ["courier-orders-sell-dialog", "courier-orders-pending"],
  api: {
    "GET orders/courier/orders": fixture("order-sell-dialog/courier-orders.json"),
    // Tab sonlari (OR-1) — oyna ortidagi ro'yxat maketdagidek.
    "GET orders/courier/orders/counts": fixture("order-sell-dialog/courier-counts.json"),
  },
  // Oyna (telefonda pastki varaqa) — faqat ko'rinadigan oyna suratga olinadi.
  capture: "viewport",
  act: async (page) => {
    // Qator tugmasi: kompyuterda «№10234 ni sotish», telefonda «Feruza Mirzayeva: sotish».
    await page.getByRole("button", { name: /(ni|:) sotish$/ }).first().click();
    const dialog = page.getByRole("dialog", { name: "Sotish" });
    await expect(dialog).toBeVisible();
    const viewport = page.viewportSize()!;
    if (viewport.width < 768) {
      // Telefonda pastki varaqa: pastki cheti oyna pastida, butun enda.
      await expect
        .poll(async () => {
          const box = await dialog.boundingBox();
          return box ? Math.abs(box.y + box.height - viewport.height) <= 1 && box.width >= viewport.width - 1 : false;
        })
        .toBe(true);
    }
  },
});
