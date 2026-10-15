import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * PUSH RUXSAT TUGMASI — 390×664 (iPhone 12, manzil paneli bilan).
 *
 * Tugma va bizning tushuntiruvchi oyna ekranga to'liq sig'adi, kesilmaydi.
 *
 * ⚠️ Dev serverda Service Worker ATAYLAB ro'yxatdan o'tmaydi (`main.tsx` — faqat
 * PROD). Shu bois bu yerda FAQAT ro'yxatdan o'tgan SW soxtalashtiriladi;
 * `PushManager` / `Notification` — Chrome'ning haqiqiysi. Brauzer ruxsat oynasi
 * bosilmaydi: test joylashuvni va "avval bizning oyna" qoidasini tekshiradi.
 */

const ORIGIN = "http://127.0.0.1:4173";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
const wrap = (data: unknown) => ({ statusCode: 200, message: "ok", data });

const setup = async (page: Page) => {
  const leaked: string[] = [];
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") {
      return reply(route, wrap({ id: "42", role: "courier", name: "E2E kuryer", status: "active" }));
    }
    if (path === "notifications/push/public-key") {
      return reply(route, wrap({ enabled: true, public_key: "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U" }));
    }
    if (path === "notifications/inbox/unread-count") return reply(route, wrap({ unread: 0 }));
    if (request.method() !== "GET") {
      leaked.push(`${request.method()} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    }
    return reply(route, wrap([]));
  });

  await page.addInitScript(() => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
    // PROD'dagi ro'yxatdan o'tgan SW o'rnini bosadi (obuna yo'q).
    const registration = {
      pushManager: { getSubscription: () => Promise.resolve(null) },
    };
    if (navigator.serviceWorker) {
      navigator.serviceWorker.getRegistration = () =>
        Promise.resolve(registration as unknown as ServiceWorkerRegistration);
    }
    // Ruxsat oynasi chaqirilganini sanaymiz — bizning oynadan OLDIN chiqmasligi kerak.
    const w = window as unknown as { __permissionAsked: number };
    w.__permissionAsked = 0;
    if ("Notification" in window) {
      Notification.requestPermission = () => {
        w.__permissionAsked += 1;
        return Promise.resolve("default");
      };
    }
  });
  return { leaked };
};

/** Element viewport ichida to'liq va matni kesilmagan. */
const fullyVisible = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      inside: r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight,
      notClipped: el.scrollWidth <= el.clientWidth + 1,
      width: Math.round(r.width),
      height: Math.round(r.height),
    };
  });

test.describe("Push ruxsat tugmasi — 390×664", () => {
  test.use({ viewport: { width: 390, height: 664 } });
  test.describe.configure({ timeout: 90_000 });

  test("/inbox: tugma to'liq ko'rinadi; bosilganda AVVAL bizning oyna, u ham ekranga sig'adi", async ({ page }) => {
    const { leaked } = await setup(page);
    await page.goto("/inbox");
    const button = page.getByRole("button", { name: "Bildirishnomalarni yoqish" });
    await expect(button).toBeVisible({ timeout: 60_000 });

    const box = await fullyVisible(page, 'button:has-text("Bildirishnomalarni yoqish")');
    expect(box.inside).toBe(true);
    expect(box.notClipped).toBe(true);
    expect(box.height).toBeGreaterThanOrEqual(44);

    await button.click();
    await expect(page.getByText("Bildirishnomalarni yoqasizmi?")).toBeVisible();
    // Brauzer oynasi hali so'ralmagan — faqat bizning tushuntirish.
    expect(await page.evaluate(() => (window as unknown as { __permissionAsked: number }).__permissionAsked)).toBe(0);

    for (const name of ["Yoqish", "Hozir emas"]) {
      const action = await fullyVisible(page, `button:has-text("${name}")`);
      expect(action.inside, name).toBe(true);
      expect(action.notClipped, name).toBe(true);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(leaked).toEqual([]);
  });

  test("Sozlamalar → Bildirishnomalar: push qatoridagi tugma to'liq ko'rinadi", async ({ page }) => {
    const { leaked } = await setup(page);
    await page.goto("/settings");
    await page.getByRole("main").getByRole("button", { name: /Bildirishnomalar/ }).click({ timeout: 60_000 });

    const button = page.getByRole("button", { name: "Bildirishnomalarni yoqish" });
    await button.scrollIntoViewIfNeeded();
    await expect(button).toBeVisible();
    const box = await fullyVisible(page, 'button:has-text("Bildirishnomalarni yoqish")');
    expect(box.inside).toBe(true);
    expect(box.notClipped).toBe(true);

    const mainOverflow = await page
      .locator("main.el-surface-page")
      .evaluate((main) => main.scrollWidth - main.clientWidth);
    expect(mainOverflow).toBeLessThanOrEqual(0);
    expect(leaked).toEqual([]);
  });
});
