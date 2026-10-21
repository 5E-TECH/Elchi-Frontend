import { expect, test, type Page } from "@playwright/test";
import { mockCourierCancelApi } from "./support/courierCancel";
import { mockOrdersListApi } from "./support/floor";

/**
 * OR-1 — «Buyurtmalar» yangilanishi (desktop 1280): sarlavha («Jami N» · «Oxirgi yangilanish: HH:mm» ·
 * «Avtomatik yangilanadi»), ghost «Yangilash», avtomatik 60 s va ilovaga qaytganda, «Yangilanmoqda…»,
 * «Ro'yxat yangilanmadi» (eski qatorlar qoladi, × yopadi, global xato xabari yo'q), kuryer tab sonlari.
 * Maketlar: `superadmin-orders-list{,-refreshing,-refresh-error}`, `courier-orders-pending{,-refreshing,-refresh-error}`.
 */

const openOrders = async (page: Page) => {
  await page.goto("/orders");
  await expect(page.getByRole("heading", { level: 1, name: "Buyurtmalar" })).toBeVisible({ timeout: 60_000 });
};

test.describe("Buyurtmalar — yangilanish (desktop)", () => {
  test.describe.configure({ timeout: 90_000 });

  test("⭐ sarlavha: Jami · Oxirgi yangilanish · Avtomatik; «Yangilash» ro'yxatni qayta so'raydi", async ({ page }) => {
    const { state, leaked } = await mockOrdersListApi(page);
    await openOrders(page);
    await expect(page.getByText("Sevara Tursunova")).toBeVisible();

    const header = page.locator("header").filter({ has: page.getByRole("heading", { level: 1 }) });
    await expect(header.getByText("Jami 3 ta buyurtma")).toBeVisible();
    await expect(header.locator("time")).toHaveText(/^\d{2}:\d{2}$/);
    await expect(header.getByText(/^Oxirgi yangilanish: \d{2}:\d{2}$/)).toBeVisible();
    await expect(header.getByText("Avtomatik yangilanadi")).toBeVisible();

    // Desktopda ghost «Yangilash», telefon ikonka tugmasi yashirin.
    const ghost = header.getByRole("button", { name: "Ro'yxatni yangilash" }).filter({ hasText: "Yangilash" });
    await expect(ghost).toBeVisible();
    // Telefon ikonka tugmasi (`md:hidden`) yashirin — rol daraxtida faqat ghost.
    await expect(header.getByRole("button", { name: "Ro'yxatni yangilash" })).toHaveCount(1);
    await expect(header.getByRole("button", { name: "Ro'yxatni yangilash", includeHidden: true })).toHaveCount(2);

    const before = state.listCalls;
    state.orders.unshift({ ...state.orders[0], id: "10250", customer: { name: "Aziz Rahimov", phone_number: "+998934561208" } });
    await ghost.click();
    await expect(page.getByText("Aziz Rahimov")).toBeVisible();
    expect(state.listCalls).toBe(before + 1);
    await expect(header.getByText("Jami 4 ta buyurtma")).toBeVisible();
    expect(leaked).toEqual([]);
  });

  test("avtomatik: 60 s dan keyin va ilovaga qaytganda (eskirgan bo'lsa) qayta so'raladi", async ({ page }) => {
    await page.clock.install();
    const { state } = await mockOrdersListApi(page);
    await openOrders(page);
    await expect(page.getByText("Sevara Tursunova")).toBeVisible();

    const afterLoad = state.listCalls;
    await page.clock.runFor(61_000);
    await expect.poll(() => state.listCalls).toBe(afterLoad + 1);

    // 30 s dan keyin ma'lumot eskiradi — brauzer tabiga qaytish (`visibilitychange`) yangilaydi.
    await page.clock.runFor(31_000);
    const beforeFocus = state.listCalls;
    // TanStack `focusManager` `window` dagi `visibilitychange` ni tinglaydi (tab ko'rinadigan bo'ldi).
    await page.evaluate(() => window.dispatchEvent(new Event("visibilitychange")));
    await expect.poll(() => state.listCalls).toBeGreaterThan(beforeFocus);
  });

  test("«Yangilanmoqda…» faqat sekin javobda; xato — «Ro'yxat yangilanmadi», qatorlar qoladi, × yopadi", async ({ page }) => {
    const { state } = await mockOrdersListApi(page);
    await openOrders(page);
    await expect(page.getByText("Sevara Tursunova")).toBeVisible();
    const header = page.locator("header").filter({ has: page.getByRole("heading", { level: 1 }) });

    state.listDelayMs = 1_500;
    await header.getByRole("button", { name: "Ro'yxatni yangilash" }).last().click();
    // Jonli hudud doim joyida (matni almashadi); ko'rinadigan badge — bezak.
    await expect(header.getByRole("status")).toHaveText("Yangilanmoqda…");
    await expect(header.locator('[aria-hidden="true"]').filter({ hasText: "Yangilanmoqda…" })).toBeVisible();
    // Ghost tugma nomi yuklanishda ham «Ro'yxatni yangilash» (WCAG 2.5.3), bandlik — aria-busy.
    await expect(header.getByRole("button", { name: "Ro'yxatni yangilash" }).last()).toHaveAttribute("aria-busy", "true");
    await expect(header.getByText("Yangilanmoqda…")).toHaveCount(0, { timeout: 10_000 });

    state.listDelayMs = 0;
    state.listFail = true;
    await header.getByRole("button", { name: "Ro'yxatni yangilash" }).last().click();
    const alert = page.getByRole("alert").filter({ hasText: "Ro'yxat yangilanmadi" });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("Ro'yxat eskirgan bo'lishi mumkin.");
    await expect(alert).not.toContainText("tab sonlari");
    await expect(page.getByText("Sevara Tursunova")).toBeVisible();
    await expect(header.getByText("Jami 3 ta buyurtma")).toBeVisible();
    // Ma'lumot bor — global «Ma'lumotni yuklab bo'lmadi» xabari chiqmaydi; xom backend matni ko'rinmaydi.
    await expect(page.getByText("Ma'lumotni yuklab bo'lmadi")).toHaveCount(0);
    await expect(page.getByText("e2e: internal")).toHaveCount(0);

    // Ogohlantirish ro'yxat kartasidan oldin.
    const listCard = page.getByRole("region", { name: "Buyurtmalar ro'yxati" });
    const alertBox = (await alert.boundingBox())!;
    const cardBox = (await listCard.boundingBox())!;
    expect(alertBox.y + alertBox.height).toBeLessThanOrEqual(cardBox.y + 1);

    await alert.getByRole("button", { name: "Ogohlantirishni yopish" }).click();
    await expect(alert).toHaveCount(0);
    // Fokus <body> ga tushmaydi — ko'rinadigan «Yangilash» ga qaytadi.
    await expect(header.getByRole("button", { name: "Ro'yxatni yangilash" }).last()).toBeFocused();

    // «Qayta urinish» — qaytadan xato, so'ng tiklanadi.
    state.listFail = true;
    await header.getByRole("button", { name: "Ro'yxatni yangilash" }).last().click();
    await expect(alert).toBeVisible();
    state.listFail = false;
    await alert.getByRole("button", { name: "Qayta urinish" }).click();
    await expect(alert).toHaveCount(0);
  });

  test("kuryer: tab sonlari (counts), «Yangilash» ro'yxat + sonlarni so'raydi, xatoda «tab sonlari» bilan matn", async ({ page }) => {
    const { state } = await mockCourierCancelApi(page);
    await openOrders(page);
    const tabs = page.getByRole("tablist", { name: "Holat bo'yicha" });
    await expect(tabs.getByRole("tab")).toHaveText(["Kutilayotgan 2", "Barchasi 5", "Bekor qilingan 1"]);

    const header = page.locator("header").filter({ has: page.getByRole("heading", { level: 1 }) });
    await expect(header.getByText("Jami 2 ta buyurtma")).toBeVisible();
    await expect(header.getByText("Avtomatik yangilanadi")).toBeVisible();

    const list = state.listCalls;
    const counts = state.countCalls;
    state.orders.pop();
    await header.getByRole("button", { name: "Ro'yxatni yangilash" }).last().click();
    await expect(tabs.getByRole("tab").first()).toHaveText("Kutilayotgan 1");
    expect(state.listCalls).toBeGreaterThan(list);
    expect(state.countCalls).toBeGreaterThan(counts);

    state.listDelayMs = 1_500;
    await header.getByRole("button", { name: "Ro'yxatni yangilash" }).last().click();
    await expect(tabs.locator('[aria-busy="true"]')).toHaveCount(3);
    await expect(tabs.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 10_000 });

    state.listDelayMs = 0;
    state.listFail = true;
    await header.getByRole("button", { name: "Ro'yxatni yangilash" }).last().click();
    const alert = page.getByRole("alert").filter({ hasText: "Ro'yxat yangilanmadi" });
    await expect(alert).toContainText("Ro'yxat va tab sonlari eskirgan bo'lishi mumkin.");
    await expect(page.getByText("Feruza Mirzayeva")).toBeVisible();
  });
});
