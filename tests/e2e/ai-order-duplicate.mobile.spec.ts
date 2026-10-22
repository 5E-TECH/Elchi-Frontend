import { expect, test, type Route } from "@playwright/test";
import { aiDistrictsByRegion, aiPreview, aiProducts, aiRegions } from "../../src/test/aiOrderFixtures";

/**
 * j3WEDIpt — AI buyurtma: ai-confirm `duplicate_recent` (`{ ok: false, code, order_id }`) dan keyin karta «Mavjud (#N)»,
 * «Bu kartani yaratish» o'chiq, mavjud buyurtmaga havola; xulosa warning tonida. 390px, soxta backend.
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

test.describe.configure({ timeout: 180_000 });

test("⭐ duplicate_recent: «Mavjud (#48)», yaratish o'chiq, №48 havolasi, xulosa warning; 390px da sig'adi", async ({ page }, testInfo) => {
  const confirms: unknown[] = [];
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") return reply(route, wrap({ id: "37", role: "market", name: "E2E market", status: "active" }));
    if (path === "orders/ai-availability") return reply(route, wrap({ enabled: true, state: "enabled" }));
    if (path === "orders/ai-parse") {
      return reply(route, wrap({ ok: true, orders: [aiPreview({ customer_name: "Aliyev Vali", phone_number: "+998901234567" })] }));
    }
    if (path === "orders/ai-confirm") {
      confirms.push(request.postDataJSON());
      return reply(route, wrap({ results: [{ index: 0, ok: false, code: "duplicate_recent", order_id: "48" }] }));
    }
    if (path === "region") return reply(route, wrap(aiRegions));
    const region = path.match(/^region\/(\d+)$/);
    if (region) return reply(route, { districts: aiDistrictsByRegion[region[1]] ?? [] });
    if (path.startsWith("product/")) return reply(route, wrap(aiProducts));
    return reply(route, wrap([]));
  });
  await page.addInitScript(() => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
  });

  await page.goto("/new-orders/create");
  await page.getByTestId("create-mode-tabs").getByRole("radio", { name: "AI bilan" }).click({ timeout: 90_000 });
  await page.getByRole("textbox", { name: "Buyurtma matni" }).fill("Aliyev Vali buyurtma matni");
  await page.getByRole("button", { name: "Tahlil qilish" }).click();
  const card = page.getByTestId("ai-preview-card");
  await expect(card).toHaveCount(1);

  await card.getByRole("button", { name: "Bu kartani yaratish" }).click();
  await expect(card.getByText("Mavjud (#48)")).toBeVisible();
  await expect(card.getByRole("button", { name: "Bu kartani yaratish" })).toBeDisabled();
  await expect(card.getByRole("link", { name: "№48 ni ochish" })).toHaveAttribute("href", "/orders/edit/48");
  await expect(card.getByText("Bu buyurtma 10 daqiqa ichida allaqachon yaratilgan (#48) — takror yaratilmadi.")).toBeVisible();
  await expect(page.getByText("0 ta yaratildi · 1 ta xato").locator("xpath=ancestor-or-self::*[@data-tone][1]")).toHaveAttribute(
    "data-tone",
    "warning",
  );
  expect(confirms).toHaveLength(1);

  // 390px: gorizontal skroll yo'q, havola tugmasi ≥ 44px.
  const link = await card.getByRole("link", { name: "№48 ni ochish" }).boundingBox();
  expect(link!.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await card.scrollIntoViewIfNeeded();
  await testInfo.attach("duplicate-card-390", { body: await page.screenshot(), contentType: "image/png" });
});
