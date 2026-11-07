import { expect, test, type Page } from "@playwright/test";
import {
  expectSignedIn,
  loginAlert,
  mockAuthNetwork,
  setTheme,
  submitLogin,
} from "./support/loginNetwork";

/**
 * Qidiruvdan (Google) «/» ga kelgan yangi tashrifchi (2026-11-06), telefon 390px: bu qurilmada sessiya belgisi
 * (`elchi_had_session`) yo'q — `index.html` chizishdan OLDIN manzilni `/login` ga almashtiradi (tez yo'l: birinchi
 * kadr, kirish chunklari parallel). Cookie sessiyasi fonda tiklanadi — bor bo'lsa qayta kirish shart emas.
 * Avval: «/» da bo'sh ekran → «Yuklanmoqda…» → yana bo'sh → forma (sekin 3G'da 14 s bo'sh, forma 20 s da).
 */
const LOADER = "Yuklanmoqda";

/** Sahifa ichida: yuklanish ekrani hech bo'lmasa bir marta chiqdimi, `/login` qachon va `login-first-paint` bormi. */
const watchFirstScreen = (page: Page) =>
  page.addInitScript((loader) => {
    const seen = { loader: false, firstPaintClass: false };
    (window as unknown as { __seen: typeof seen }).__seen = seen;
    new MutationObserver(() => {
      if (document.body && document.body.innerText.includes(loader)) seen.loader = true;
      if (document.documentElement.classList.contains("login-first-paint"))
        seen.firstPaintClass = true;
    }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
  }, LOADER);

const seen = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __seen: { loader: boolean; firstPaintClass: boolean } }).__seen,
  );

test.describe("«/» dan birinchi tashrif — tez kirish (390px)", () => {
  test.describe.configure({ timeout: 120_000 });

  test("⭐ sessiyasiz qurilma: darhol `/login` (birinchi kadr), yuklanish ekranisiz forma; cookie yo'q — jim", async ({
    page,
  }) => {
    await setTheme(page, "light");
    await watchFirstScreen(page);
    const { calls } = await mockAuthNetwork(page, { refresh: ["401"] });
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("button", { name: "Kirish" })).toBeVisible({ timeout: 90_000 });
    await expect.poll(() => calls.refresh).toBe(1);
    await page.waitForTimeout(1000);
    expect(await seen(page)).toEqual({ loader: false, firstPaintClass: true });
    await expect(loginAlert(page)).toHaveCount(0);
    expect(await page.evaluate(() => window.localStorage.getItem("elchi_had_session"))).toBeNull();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });

  test("⭐ sessiya belgisi yo'q, lekin cookie sessiyasi bor (yangilanishdan oldingi kirish) — fonda tiklanib ilovaga", async ({
    page,
  }) => {
    await setTheme(page, "light");
    const { calls } = await mockAuthNetwork(page, {});
    await page.goto("/");
    await expectSignedIn(page);
    await expect(page).not.toHaveURL(/\/login/);
    expect(calls).toMatchObject({ login: 0, refresh: 1 });
    expect(await page.evaluate(() => window.localStorage.getItem("elchi_had_session"))).toBe("1");
  });

  test("sessiya belgisi bor — avvalgidek: «/» da qoladi (`/login` ga o'tmaydi), cookie bilan tiklanadi", async ({
    page,
  }) => {
    await setTheme(page, "light");
    await page.addInitScript(() => window.localStorage.setItem("elchi_had_session", "1"));
    await watchFirstScreen(page);
    const { calls } = await mockAuthNetwork(page, {});
    await page.goto("/");
    await expectSignedIn(page);
    expect(calls).toMatchObject({ login: 0, refresh: 1 });
    expect((await seen(page)).firstPaintClass).toBe(false);
    expect(
      await page.evaluate(() => window.sessionStorage.getItem("elchi_root_restore")),
    ).toBeNull();
  });

  test("kirgach belgi yoziladi — keyingi «/» tashrifi oddiy yo'ldan", async ({ page }) => {
    await setTheme(page, "light");
    await mockAuthNetwork(page, {});
    await submitLogin(page);
    await expectSignedIn(page);
    expect(await page.evaluate(() => window.localStorage.getItem("elchi_had_session"))).toBe("1");
  });
});
