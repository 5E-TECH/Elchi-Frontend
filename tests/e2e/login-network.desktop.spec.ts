import { expect, test } from "@playwright/test";
import { expectSignedIn, loginAlert, mockAuthNetwork, setTheme, submitLogin } from "./support/loginNetwork";

/**
 * «Tarmoq xatoligi» (h0AM0kDL) — 1440px, kunduzgi rejim: qisqa uzilishda login yiqilmaydi (bitta qayta urinish),
 * profil kelmasa ham kirish saqlanadi, vaqt tugashi va internet yo'qligi alohida matn bilan; yangi tab refresh
 * cookie bilan tiklanadi (qayta kirish talab qilinmaydi), `/login` esa tiklamaydi.
 */
test.describe("/login — tarmoq uzilishlari (1440px)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 120_000 });

  test("POST auth/login darhol uzildi → bitta qayta urinish → kirildi", async ({ page }) => {
    await setTheme(page, "light");
    const { calls } = await mockAuthNetwork(page, { login: ["abort", "ok"] });
    await submitLogin(page);
    await expectSignedIn(page);
    expect(calls.login).toBe(2);
  });

  test("ikkala urinish ham uzildi → «Internet aloqasi yo'q» (qayta urinish faqat bitta)", async ({ page }) => {
    await setTheme(page, "light");
    const { calls } = await mockAuthNetwork(page, { login: ["abort"] });
    await submitLogin(page);
    await expect(loginAlert(page)).toContainText("Internet aloqasi yo'q");
    await expect(loginAlert(page)).not.toContainText("Tarmoq xatoligi");
    expect(calls.login).toBe(2);
  });

  test("server javob bermadi (15 s) → «Server javob bermadi», qayta urinilmaydi", async ({ page }) => {
    await setTheme(page, "light");
    const { calls } = await mockAuthNetwork(page, { login: ["hang"] });
    await submitLogin(page);
    await expect(loginAlert(page)).toContainText("Server javob bermadi", { timeout: 30_000 });
    expect(calls.login).toBe(1);
  });

  test("login qabul qilindi, profil kelmadi → kirish bekor qilinmaydi (rol token'dan), profil fonda keladi", async ({ page }) => {
    await setTheme(page, "light");
    const { calls } = await mockAuthNetwork(page, { profile: ["abort", "abort", "abort", "ok"] });
    await submitLogin(page);
    await expectSignedIn(page);
    expect(calls.login).toBe(1);
    expect(await page.evaluate(() => window.sessionStorage.getItem("authUserRole"))).toBe("manager");
    await expect.poll(() => calls.profile, { timeout: 20_000 }).toBeGreaterThanOrEqual(4);
  });

  test("yangi tab: refresh cookie bilan tiklanadi; /login ni ataylab ochsa — tiklanmaydi", async ({ page, browser }) => {
    await setTheme(page, "light");
    const { calls } = await mockAuthNetwork(page, {});
    await page.goto("/");
    await expectSignedIn(page);
    expect(calls).toMatchObject({ login: 0, refresh: 1 });
    expect(await page.evaluate(() => window.sessionStorage.getItem("accessToken"))).toBeTruthy();

    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const loginPage = await context.newPage();
    const second = await mockAuthNetwork(loginPage, {});
    await loginPage.goto("/login");
    await expect(loginPage.getByRole("button", { name: "Kirish" })).toBeVisible({ timeout: 90_000 });
    await loginPage.waitForTimeout(1_000);
    expect(second.calls.refresh).toBe(0);
    await context.close();
  });

  test("cookie yo'q (refresh 401) → jim kirish sahifasi, xato xabarisiz", async ({ page }) => {
    await setTheme(page, "light");
    const { calls } = await mockAuthNetwork(page, { refresh: ["401"] });
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Kirish" })).toBeVisible({ timeout: 90_000 });
    expect(calls.refresh).toBe(1);
    await expect(loginAlert(page)).toHaveCount(0);
  });
});
