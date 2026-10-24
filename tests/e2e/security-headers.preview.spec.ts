import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type BrowserContext, type Page, type Route } from "@playwright/test";

/**
 * XAVFSIZLIK SARLAVHALARI (KwodkKWY) — PROD BUILD ustida.
 *
 * `vite preview` Cloudflare `_headers` ni qo'llamaydi, shuning uchun sahifa javobiga `dist/_headers` dagi `/*` (va
 * mos yo'l) sarlavhalari shu yerda qo'yiladi. Report-Only siyosat MAJBURIY qilib beriladi: kuzatuv haftasidan keyin
 * majburiy rejimga o'tilganda ham ilova buzilmasligini (login, kamera skaneri, realtime, Google Fonts) hozirdan
 * tekshiradi. Har qanday CSP buzilishi (`securitypolicyviolation`) testni yiqitadi.
 */

const ORIGIN = "http://127.0.0.1:4175";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
const wrap = (data: unknown) => ({ statusCode: 200, message: "ok", data });

type Rule = { path: string; set: [string, string][]; unset: string[] };

/** `dist/_headers` (build'da xeshlar to'ldirilgan) — Cloudflare tartibi: qoidalar ketma-ket, `!` — olib tashlash. */
const parseHeaders = (): Rule[] => {
  const rules: Rule[] = [];
  for (const raw of readFileSync(resolve(process.cwd(), "dist/_headers"), "utf8").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (!/^\s/.test(line)) {
      rules.push({ path: line.trim(), set: [], unset: [] });
      continue;
    }
    const text = line.trim();
    const rule = rules[rules.length - 1];
    if (text.startsWith("!")) rule.unset.push(text.slice(1).trim().toLowerCase());
    else rule.set.push([text.slice(0, text.indexOf(":")).trim().toLowerCase(), text.slice(text.indexOf(":") + 1).trim()]);
  }
  return rules;
};

const matches = (pattern: string, pathname: string) =>
  new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`).test(pathname);

/** Shu yo'l uchun yakuniy sarlavhalar; Report-Only → majburiy (ikkala siyosat birga, vergul bilan). */
const headersFor = (rules: Rule[], pathname: string) => {
  const headers = new Map<string, string>();
  for (const rule of rules.filter((item) => matches(item.path, pathname))) {
    rule.unset.forEach((name) => headers.delete(name));
    rule.set.forEach(([name, value]) => headers.set(name, headers.has(name) ? `${headers.get(name)}, ${value}` : value));
  }
  const reportOnly = headers.get("content-security-policy-report-only");
  headers.delete("content-security-policy-report-only");
  if (reportOnly) headers.set("content-security-policy", `${headers.get("content-security-policy")}, ${reportOnly}`);
  return Object.fromEntries(headers);
};

const PROFILE = { id: "1", role: "superadmin", name: "Bosh admin", status: "active" };
const MARKET = { id: "121", name: "Ipak Yo'li Savdo" };

const prepare = async (context: BrowserContext, { loggedIn }: { loggedIn: boolean }) => {
  const rules = parseHeaders();
  const blockedExternal: string[] = [];
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) {
      if (request.resourceType() !== "document") return route.continue();
      const response = await route.fetch();
      return route.fulfill({ response, headers: { ...response.headers(), ...headersFor(rules, url.pathname) } });
    }
    if (!/api\.elchipochta\.uz/.test(url.host)) {
      // Google Fonts va boshqa tashqi manbalar — CSP ruxsat bergan (so'rov yuborilgan), lekin internetga chiqmaydi.
      blockedExternal.push(url.host);
      return route.abort();
    }
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") return reply(route, wrap(PROFILE));
    if (path === "auth/refresh") return reply(route, { message: "Unauthorized" }, 401);
    if (path === "orders/markets/121/new") return reply(route, wrap([]));
    if (path === "orders/markets/new") {
      return reply(route, wrap([{ market_id: "121", orders_count: 0, total_price_sum: 0, market: { ...MARKET, phone_number: "+998900000000" } }]));
    }
    if (request.method() !== "GET") return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    return reply(route, wrap([]));
  });
  await context.addInitScript((loggedIn) => {
    const w = window as unknown as { __csp: string[] };
    w.__csp = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      w.__csp.push(`${event.effectiveDirective} ← ${event.blockedURI || "inline"} (${event.sourceFile}:${event.lineNumber})`);
    });
    if (!loggedIn) return;
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
  }, loggedIn);
  return { blockedExternal };
};

// Soxta kamera (ruxsat berilgan) + prod API hosti DNS'da topilmaydi (`playwright.preview.config.ts` dagidek).
test.use({
  launchOptions: {
    args: [
      "--host-resolver-rules=MAP api.elchipochta.uz ~NOTFOUND",
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
    ],
  },
});

const violations = (page: Page) => page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);

test.describe("Xavfsizlik sarlavhalari — CSP majburiy rejimda ham ilova ishlaydi (KwodkKWY)", () => {
  test("/login: mavzu + preload ichki skriptlari xesh bilan o'tadi, Google Fonts ruxsat, buzilish yo'q", async ({ page }) => {
    const { blockedExternal } = await prepare(page.context(), { loggedIn: false });
    const consoleLines: string[] = [];
    page.on("console", (message) => consoleLines.push(message.text()));
    const response = await page.goto("/login");
    expect(response?.headers()["x-frame-options"]).toBe("DENY");
    expect(response?.headers()["permissions-policy"]).toContain("camera=(self)");
    await expect(page.getByRole("button", { name: "Kirish" })).toBeVisible({ timeout: 60_000 });
    // Mavzu skripti (ichki, xesh orqali) ishladi — <html> da mavzu klassi bor.
    await expect(page.locator("html")).toHaveClass(/\b(light|dark)\b/);
    expect(blockedExternal).toContain("fonts.googleapis.com");
    expect(await violations(page)).toEqual([]);
    // Brauzer tanimaydigan Permissions-Policy funksiyasi / CSP xatosi konsolda ogohlantirish bermasin.
    expect(consoleLines.filter((text) => /Permissions-Policy|Content Security Policy|Refused to/.test(text))).toEqual([]);
  });

  test("390px: kamera skaneri (qr-scanner worker, getUserMedia) va realtime (wss) — buzilish yo'q", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      permissions: ["camera"],
    });
    const page = await context.newPage();
    await prepare(context, { loggedIn: true });
    // Haqiqiy WebSocket (soxtalanmaydi — Playwright soxtasi CSP'ni chetlab o'tardi): CSP to'ssa — «Refused to
    // connect»; ruxsat bo'lsa ulanish boshlanadi va DNS'da yiqiladi (prod API hosti NOTFOUND).
    const consoleLines: string[] = [];
    page.on("console", (message) => consoleLines.push(message.text()));
    await page.goto("/new-orders/121");
    await expect(page.getByRole("heading", { level: 1, name: MARKET.name })).toBeVisible({ timeout: 60_000 });
    await expect
      .poll(() => consoleLines.some((text) => /WebSocket connection to 'wss:\/\/api\.elchipochta\.uz\/socket\.io\/.*ERR_NAME_NOT_RESOLVED/.test(text)))
      .toBe(true);
    expect(consoleLines.filter((text) => /Refused to|Permissions-Policy/.test(text))).toEqual([]);

    await page.getByRole("link", { name: "Skaner — Qabul qilish" }).click();
    await expect(page.getByRole("dialog", { name: "Qabul qilish" })).toBeVisible();
    // Kamera haqiqatan ochildi (soxta qurilma) — Permissions-Policy camera=(self) to'smadi.
    await expect.poll(() => page.evaluate(() => (document.querySelector("video") as HTMLVideoElement | null)?.readyState ?? 0)).toBeGreaterThan(0);
    await page.waitForTimeout(1_500);
    expect(await violations(page)).toEqual([]);
    await context.close();
  });

  test("/tg/scan: Telegram SDK (telegram.org) CSP'da ruxsat; iframe faqat web.telegram.org ga", async ({ page }) => {
    const { blockedExternal } = await prepare(page.context(), { loggedIn: false });
    const response = await page.goto("/tg/scan");
    expect(response?.headers()["x-frame-options"]).toBeUndefined();
    expect(response?.headers()["content-security-policy"]).toContain("frame-ancestors 'self' https://web.telegram.org");
    await expect.poll(() => blockedExternal.includes("telegram.org"), { timeout: 30_000 }).toBe(true);
    expect(await violations(page)).toEqual([]);
  });
});
