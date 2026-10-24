import { expect, test } from "@playwright/test";
import { expectSignedIn, loginAlert, mockAuthNetwork, setTheme, submitLogin } from "./support/loginNetwork";

/**
 * «Tarmoq xatoligi» (h0AM0kDL) — 390px, tungi rejim: xato matni sig'adi (gorizontal aylantirish yo'q), qisqa
 * uzilish kirishni yiqitmaydi, yangi tashrif refresh cookie bilan tiklanadi.
 */
test.describe("/login — tarmoq uzilishlari (390px, tungi rejim)", () => {
  test.describe.configure({ timeout: 120_000 });

  test("internet yo'q → «Internet aloqasi yo'q» tungi rejimda ko'rinadi va sig'adi", async ({ page }) => {
    await setTheme(page, "dark");
    const { calls } = await mockAuthNetwork(page, { login: ["abort"] });
    await submitLogin(page);
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    const alert = loginAlert(page);
    await expect(alert).toContainText("Internet aloqasi yo'q");
    await expect(alert).toBeInViewport();
    expect(calls.login).toBe(2);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("qisqa uzilish → qayta urinish bilan kirildi", async ({ page }) => {
    await setTheme(page, "dark");
    const { calls } = await mockAuthNetwork(page, { login: ["abort", "ok"] });
    await submitLogin(page);
    await expectSignedIn(page);
    expect(calls.login).toBe(2);
  });

  test("telefon tashrifi: token yo'q, refresh cookie bor → qayta kirish talab qilinmaydi", async ({ page }) => {
    await setTheme(page, "dark");
    const { calls } = await mockAuthNetwork(page, {});
    await page.goto("/");
    await expectSignedIn(page);
    expect(calls).toMatchObject({ login: 0, refresh: 1 });
  });
});
