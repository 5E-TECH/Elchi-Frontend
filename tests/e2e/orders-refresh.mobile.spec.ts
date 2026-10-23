import { expect, test, type Locator, type Page } from "@playwright/test";
import { mockCourierCancelApi } from "./support/courierCancel";
import { mockOrdersListApi } from "./support/floor";

/**
 * OR-1 — «Buyurtmalar» yangilanishi, telefon 390: «Yangilash» — sarlavha qatorining o'ng chetidagi chegarali ikonka
 * tugma (≥ 44px, ghost yashirin), gorizontal skroll yo'q, «Yangilanmoqda…» h1 yonida, kuryerda ogohlantirish
 * tablar va qidiruvdan keyin, kartadan oldin; ichidagi tugmalar ≥ 44px.
 * Maketlar: `superadmin-orders-list-refreshing` (telefon), `courier-orders-pending-refresh-error` (telefon).
 */

const heading = (page: Page) => page.getByRole("heading", { level: 1, name: "Buyurtmalar" });

const tooSmall = (root: Locator) =>
  root.evaluate((el) =>
    Array.from(el.querySelectorAll<HTMLElement>("button"))
      .filter((button) => button.offsetParent !== null)
      .map((button) => ({ name: button.getAttribute("aria-label") ?? button.textContent?.trim(), rect: button.getBoundingClientRect() }))
      .filter(({ rect }) => rect.height < 44 || rect.width < 44)
      .map(({ name, rect }) => `${name} ${Math.round(rect.width)}×${Math.round(rect.height)}`),
  );

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test.describe("Buyurtmalar — yangilanish (390px)", () => {
  test.describe.configure({ timeout: 90_000 });

  test("⭐ ikonka tugma sarlavha qatorida o'ng chetda, 44px; ghost yashirin; bosilganda ro'yxat qayta so'raladi", async ({ page }) => {
    const { state, leaked } = await mockOrdersListApi(page);
    await page.goto("/orders");
    await expect(heading(page)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Sevara Tursunova")).toBeVisible();

    const header = page.locator("header").filter({ has: heading(page) });
    // Desktop ghost «Yangilash» (`max-md:hidden`) yashirin — rol daraxtida faqat ikonka tugma.
    await expect(header.getByRole("button", { name: "Ro'yxatni yangilash", includeHidden: true })).toHaveCount(2);
    const buttons = header.getByRole("button", { name: "Ro'yxatni yangilash" });
    await expect(buttons).toHaveCount(1);
    await expect(header.getByText("Yangilash", { exact: true })).toBeHidden();
    const icon = buttons.first();
    await expect(icon).toBeVisible();
    const iconBox = (await icon.boundingBox())!;
    const titleBox = (await heading(page).boundingBox())!;
    expect(iconBox.width).toBeGreaterThanOrEqual(44);
    expect(iconBox.height).toBeGreaterThanOrEqual(44);
    // Sarlavha bilan bir qatorda, o'ng chetda (16px chekka).
    expect(Math.abs(iconBox.y + iconBox.height / 2 - (titleBox.y + titleBox.height / 2))).toBeLessThanOrEqual(12);
    expect(page.viewportSize()!.width - (iconBox.x + iconBox.width)).toBeLessThanOrEqual(17);

    await expect(header.getByText("Avtomatik yangilanadi")).toBeVisible();
    expect(await noHorizontalScroll(page)).toBe(true);

    const before = state.listCalls;
    await icon.click();
    await expect.poll(() => state.listCalls).toBe(before + 1);
    expect(leaked).toEqual([]);
  });

  test("«Yangilanmoqda…» sarlavha yonida, ikonka tugma band; gorizontal skroll yo'q", async ({ page }) => {
    const { state } = await mockOrdersListApi(page);
    await page.goto("/orders");
    await expect(page.getByText("Sevara Tursunova")).toBeVisible({ timeout: 60_000 });
    const header = page.locator("header").filter({ has: heading(page) });

    state.listDelayMs = 1_500;
    await header.getByRole("button", { name: "Ro'yxatni yangilash" }).first().click();
    // Jonli hudud doim joyida (matni almashadi); ko'rinadigan badge — bezak (aria-hidden).
    await expect(header.getByRole("status")).toHaveText("Yangilanmoqda…");
    const badge = header.locator('[aria-hidden="true"]').filter({ hasText: "Yangilanmoqda…" });
    await expect(badge).toBeVisible();
    const badgeBox = (await badge.boundingBox())!;
    const titleBox = (await heading(page).boundingBox())!;
    expect(Math.abs(badgeBox.y + badgeBox.height / 2 - (titleBox.y + titleBox.height / 2))).toBeLessThanOrEqual(12);
    await expect(header.getByRole("button", { name: "Ro'yxat yangilanmoqda" }).first()).toHaveAttribute("aria-busy", "true");
    expect(await noHorizontalScroll(page)).toBe(true);
    await expect(badge).toHaveCount(0, { timeout: 10_000 });
  });

  test("kuryer: tab sonlari, xato ogohlantirishi tablar va qidiruvdan keyin, kartadan oldin; tugmalar ≥ 44px", async ({ page }) => {
    const { state } = await mockCourierCancelApi(page);
    await page.goto("/orders");
    await expect(heading(page)).toBeVisible({ timeout: 60_000 });
    const tabs = page.getByRole("tablist", { name: "Buyurtmalar turi" });
    await expect(tabs.getByRole("tab")).toHaveText(["Kutilayotgan 2", "Barchasi 5", "Bekor qilingan 1"]);
    await expect(page.getByText("Feruza Mirzayeva")).toBeVisible();

    state.listFail = true;
    await page.getByRole("button", { name: "Ro'yxatni yangilash" }).first().click();
    const alert = page.getByRole("alert").filter({ hasText: "Ro'yxat yangilanmadi" });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("Ro'yxat va tab sonlari eskirgan bo'lishi mumkin.");
    await expect(page.getByText("Feruza Mirzayeva")).toBeVisible();

    const search = page.getByRole("searchbox").first();
    const alertBox = (await alert.boundingBox())!;
    const tabsBox = (await tabs.boundingBox())!;
    const searchBox = (await search.boundingBox())!;
    const cardBox = (await page.getByRole("region", { name: "Kutilayotgan buyurtmalar" }).boundingBox())!;
    expect(alertBox.y).toBeGreaterThanOrEqual(tabsBox.y + tabsBox.height - 1);
    expect(alertBox.y).toBeGreaterThanOrEqual(searchBox.y + searchBox.height - 1);
    expect(alertBox.y + alertBox.height).toBeLessThanOrEqual(cardBox.y + 1);

    expect(await tooSmall(alert)).toEqual([]);
    expect(await noHorizontalScroll(page)).toBe(true);

    await alert.getByRole("button", { name: "Ogohlantirishni yopish" }).click();
    await expect(alert).toHaveCount(0);
    // Telefonda ko'rinadigan «Yangilash» — sarlavhadagi ikonka tugma.
    await expect(page.getByRole("button", { name: "Ro'yxatni yangilash" }).first()).toBeFocused();
  });
});
