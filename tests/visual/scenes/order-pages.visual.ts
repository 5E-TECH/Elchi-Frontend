import { defineScene, expect, fixture } from "../support/test";

/**
 * «Buyurtmalar» sahifalari (pilotlardan tashqari — `orders.visual.ts` infra'niki): kuryer ro'yxati «Kutilmoqda»,
 * buyurtma tafsiloti (admin) va buyurtma yaratish 1-qadami (registrator, HQ).
 * Ma'lumot sintetik (`tests/visual/fixtures/<sahna>/`), vaqtlar muzlatilgan soatdan (15.10.2026 10:00) oldin.
 */

defineScene({
  id: "orders-courier",
  route: "/orders",
  role: "courier",
  branchType: "REGIONAL",
  maket: ["courier-orders-pending"],
  api: {
    // Sukut tab — «Kutilmoqda» (`status=waiting`), 4 qator.
    "GET orders/courier/orders": fixture("orders-courier/courier-orders.json"),
  },
});

defineScene({
  id: "order-detail",
  route: "/orders/edit/96",
  role: "admin",
  maket: ["admin-orders-detail"],
  api: {
    "GET orders/96": fixture("order-detail/order-96.json"),
    // Tarix: yaratildi → HQ'da qabul → filialga jo'natildi → filialda (kutilmoqda), eng yangisi tepada.
    "GET orders/96/tracking": fixture("order-detail/tracking.json"),
    "GET users/93": { statusCode: 200, data: { id: "93", name: "Rustam Qosimov", phone_number: "+998970000090", role: "courier" } },
  },
});

defineScene({
  id: "order-create",
  route: "/new-orders/create",
  role: "registrator",
  branchType: "HQ",
  maket: ["registrator-new-orders-create-step1"],
  api: {
    "GET orders/ai-availability": { statusCode: 200, data: { enabled: true, state: "enabled" } },
    "GET region": { statusCode: 200, data: [] },
    "GET markets": fixture("order-create/markets.json"),
    // «Yangi buyurtmalar · Baraka Shop · bugun» kartasi (`GET orders/markets/:id/new`).
    "GET orders/markets/31/new": fixture("order-create/market-orders.json"),
  },
  // 1-qadam: market tanlash oynasi orqali «Baraka Shop» tanlanadi (maketdagi holat).
  act: async (page) => {
    await page.getByRole("button", { name: /Market tanlash/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("option", { name: /Baraka Shop/ }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Baraka Shop/ })).toBeVisible();
  },
});
