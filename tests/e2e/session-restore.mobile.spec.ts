import { expect, test } from "@playwright/test";
import { expectSignedIn, mockAuthNetwork, setTheme } from "./support/loginNetwork";

/**
 * Sekin internet (2026-11-07): yangi tab / PWA ochilishi (token yo'q, «/» sessiya belgisi bor) — cookie bilan tiklash
 * tarmoq sababli yiqilsa foydalanuvchi jim kirish sahifasiga TUSHMAYDI: «Internet sekin — qayta urinilmoqda» ekrani,
 * o'zi qayta urinadi; «Kirish sahifasiga o'tish» — forma. 390px, ekran sig'adi.
 */
const hadSession = (page: import("@playwright/test").Page) =>
  page.addInitScript(() => window.localStorage.setItem("elchi_had_session", "1"));

const restoreTitle = (page: import("@playwright/test").Page) =>
  page.getByRole("heading", { level: 1, name: "Internet sekin — qayta urinilmoqda" });

test.describe("Sessiyani tiklash — sekin internet (390px)", () => {
  test.describe.configure({ timeout: 120_000 });

  test("uzilish, uzilish, javob → ekran ko'rinadi, so'ng o'zi kiradi (kirish formasisiz)", async ({ page }) => {
    await setTheme(page, "light");
    await hadSession(page);
    const { calls } = await mockAuthNetwork(page, { refresh: ["abort", "abort", "ok"] });

    await page.goto("/");
    await expect(restoreTitle(page)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("button", { name: "Kirish sahifasiga o'tish" })).toBeInViewport();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    await expectSignedIn(page);
    expect(calls).toMatchObject({ login: 0, refresh: 3 });
    await expect(restoreTitle(page)).toHaveCount(0);
  });

  test("«Kirish sahifasiga o'tish» → kirish formasi, boshqa urinish yo'q", async ({ page }) => {
    await setTheme(page, "light");
    await hadSession(page);
    const { calls } = await mockAuthNetwork(page, { refresh: ["abort"] });

    await page.goto("/");
    await expect(restoreTitle(page)).toBeVisible({ timeout: 60_000 });

    // Past ekran (kichik telefon, yotiq telefon): tarkib tepadan kesilmaydi — logotip ko'rinadi, tugma aylantirib yetiladi.
    for (const size of [
      { width: 320, height: 460 },
      { width: 844, height: 340 },
    ]) {
      await page.setViewportSize(size);
      const logoTop = await page
        .getByRole("img", { name: "Elchi Pochta" })
        .evaluate((logo) => logo.getBoundingClientRect().top);
      expect(logoTop, `${size.width}×${size.height}`).toBeGreaterThanOrEqual(0);
      await page.getByRole("button", { name: "Kirish sahifasiga o'tish" }).scrollIntoViewIfNeeded();
      await expect(page.getByRole("button", { name: "Kirish sahifasiga o'tish" })).toBeInViewport();
    }
    await page.setViewportSize({ width: 390, height: 844 });

    await page.getByRole("button", { name: "Kirish sahifasiga o'tish" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("form", { name: "Tizimga kirish" })).toBeVisible();
    const after = calls.refresh;
    await page.waitForTimeout(12_000);
    expect(calls.refresh).toBe(after);
    expect(await page.evaluate(() => window.localStorage.getItem("elchi_had_session"))).toBe("1");
  });

  test("javob kelmayapti (qotgan liniya) → 15 s da ekran, manzil «/» da qoladi", async ({ page }) => {
    await setTheme(page, "light");
    await hadSession(page);
    const { calls } = await mockAuthNetwork(page, { refresh: ["hang"] });

    await page.goto("/");
    await expect.poll(() => calls.refresh, { timeout: 60_000 }).toBe(1);
    await expect(restoreTitle(page)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Ulanmoqda…")).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/");
    expect(calls.refresh).toBe(1);
  });
});
