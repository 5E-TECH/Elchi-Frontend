import { expect, test, type Route } from "@playwright/test";

/**
 * HcUjGTxT — `/scan` (kuryer skaneri, `widgets/layout/scanLayout.tsx`) ildizi ekran balandligini `100dvh` dan oladi:
 * iOS Safari'da `100vh` manzil paneli ostiga kirib, pastdagi tugmani yashirardi. Tekshiruv: ildizning hisoblangan
 * `min-height` i `window.innerHeight` ga teng va u `.min-h-dvh { min-height: 100dvh }` qoidasidan (vh emas).
 * `mobile-390` (Chromium) va `PLAYWRIGHT_WEBKIT=1` da `webkit-iphone` (Safari dvigateli, iPhone 12) loyihalarida.
 */
const ORIGIN = "http://127.0.0.1:4173";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown) =>
  route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(body) });

test.describe.configure({ timeout: 180_000 });

test("⭐ /scan ildizi: min-height = innerHeight va 100dvh qoidasidan", async ({ page }) => {
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") {
      return reply(route, { statusCode: 200, data: { id: "26", role: "courier", name: "E2E kuryer", status: "active" } });
    }
    return reply(route, { statusCode: 200, data: [] });
  });
  await page.addInitScript(() => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
  });

  await page.goto("/scan");
  const root = page.locator("#root div.min-h-dvh").first();
  await expect(root).toBeVisible({ timeout: 90_000 });
  await expect(root.locator("main")).toHaveCount(1);

  const measured = await root.evaluate((element) => {
    const rules: string[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
      let cssRules: CSSRuleList;
      try {
        cssRules = sheet.cssRules;
      } catch {
        continue;
      }
      const walk = (list: CSSRuleList) => {
        for (const rule of Array.from(list)) {
          if (rule instanceof CSSStyleRule && rule.selectorText === ".min-h-dvh") rules.push(rule.style.minHeight);
          else if ("cssRules" in rule) walk((rule as CSSGroupingRule).cssRules);
        }
      };
      walk(cssRules);
    }
    return {
      minHeight: parseFloat(getComputedStyle(element).minHeight),
      height: element.getBoundingClientRect().height,
      innerHeight: window.innerHeight,
      rules,
    };
  });

  expect(measured.rules).toContain("100dvh");
  expect(measured.rules.some((value) => /vh$/.test(value) && !/dvh$/.test(value))).toBe(false);
  expect(Math.abs(measured.minHeight - measured.innerHeight)).toBeLessThanOrEqual(1);
  expect(measured.height).toBeGreaterThanOrEqual(measured.innerHeight - 1);
});
