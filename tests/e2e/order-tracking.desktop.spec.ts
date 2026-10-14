import { expect, test } from "@playwright/test";
import { ORDER_95, mockOrderDetailApi, openOrderDetail } from "./support/orderDetail";

/**
 * BUYURTMA TARIXI (Ho5qcDn4) — 1440px.
 * TC7 bo'sh tarix matni; TC9 market o'z buyurtmasini ko'radi, boshqa marketnikini — yo'q (backend 403).
 */
const MARKET_37 = { id: "37", role: "market", name: "E2E market", status: "active" };
const created = {
  id: "t1",
  order_id: "95",
  action: "created",
  created_at: "2026-10-09T09:00:00.000Z",
  changed_by_role: "market",
  actor: { id: "37", name: "E2E market", role: "market" },
  old_value: null,
  new_value: { status: "new" },
  description: "Buyurtma yaratildi",
};
const sold = {
  ...created,
  id: "t2",
  action: "sold",
  created_at: "2026-10-09T14:48:00.000Z",
  changed_by_role: "courier",
  actor: { id: "93", name: "Xorazm Courier", role: "courier" },
  old_value: { status: "waiting" },
  new_value: { status: "sold" },
  description: null,
};

test.describe("Buyurtma tarixi — 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 90_000 });

  test("⭐ TC9: market roli O'Z buyurtmasi tarixini ko'radi (so'rov ketadi, yozuvlar chiqadi)", async ({ page }) => {
    const { requests, leaked } = await mockOrderDetailApi(page, ORDER_95, {
      profile: MARKET_37,
      tracking: () => [created, sold],
    });
    await openOrderDetail(page, "95");

    await expect(page.getByRole("heading", { name: "Buyurtma tarixi" })).toBeVisible();
    const items = page.getByTestId("tracking-event");
    await expect(items).toHaveCount(2);
    await expect(items.first()).toContainText("#2/2");
    await expect(items.first()).toContainText("Xorazm Courier");
    expect(requests).toContain("GET orders/95/tracking");
    expect(leaked).toEqual([]);
  });

  test("⭐ TC9: BOSHQA market buyurtmasi — backend 403, faqat blok o'rnida izoh, sahifa ishlaydi", async ({ page }) => {
    const { leaked } = await mockOrderDetailApi(page, { ...ORDER_95, id: "32" }, {
      profile: MARKET_37,
      trackingError: { status: 403, message: "Bu buyurtma tarixini ko'rishga ruxsatingiz yo'q" },
    });
    await openOrderDetail(page, "32");

    const block = page.locator("section").filter({ has: page.getByRole("heading", { name: "Buyurtma tarixi" }) });
    await expect(block.getByText("Bu buyurtma tarixini ko'rishga ruxsatingiz yo'q")).toBeVisible();
    await expect(block.getByTestId("tracking-event")).toHaveCount(0);
    // Qolgan sahifa buzilmagan.
    await expect(page.getByTestId("order-meta")).toBeVisible();
    await expect(page.getByText("Mijoz ma'lumotlari").first()).toBeVisible();
    expect(leaked).toEqual([]);
  });

  test("⭐ TC7: tarix bo'sh — tushunarli matn, bo'sh oq joy emas", async ({ page }) => {
    const { leaked } = await mockOrderDetailApi(page, ORDER_95, { tracking: () => [] });
    await openOrderDetail(page, "95");

    const block = page.locator("section").filter({ has: page.getByRole("heading", { name: "Buyurtma tarixi" }) });
    await expect(block.getByText("Bu buyurtma bo'yicha hali tarix yozuvlari yo'q")).toBeVisible();
    await expect(block.getByText(/Tracking/)).toHaveCount(0);
    expect(leaked).toEqual([]);
  });

  test("tarmoq xatosi — blokda xom \"Network Error\" emas, tarjima qilingan matn", async ({ page }) => {
    const { leaked } = await mockOrderDetailApi(page, ORDER_95, { tracking: () => [] });
    await page.context().route(/\/orders\/95\/tracking/, (route) => route.abort("internetdisconnected"));
    await openOrderDetail(page, "95");

    const block = page.locator("section").filter({ has: page.getByRole("heading", { name: "Buyurtma tarixi" }) });
    await expect(block.getByText("Ma'lumotlarni yuklashda xatolik yuz berdi")).toBeVisible();
    await expect(block.getByText("Network Error")).toHaveCount(0);
    expect(leaked).toEqual([]);
  });
});
