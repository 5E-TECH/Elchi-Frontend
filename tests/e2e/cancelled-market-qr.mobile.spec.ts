import { expect, test, type Route } from "@playwright/test";

/**
 * CidJqG5a — market roli, bekor qilingan buyurtma YO'Q: «Qabul qilish» (market QR) yoqiq. Shu QR filial menejerining
 * «Marketga topshirildi» oynasiga kerak (qaytarilgan buyurtma → `returned_to_market`, `order-return.desktop.spec.ts`);
 * backend QR'ni bekor buyurtmasiz ham beradi. 390px, soxta backend.
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

test("⭐ market, bekor buyurtma yo'q: «Qabul qilish» yoqiq → POST …/cancelled/qr → QR oynasi; 390px da sig'adi", async ({ page }) => {
  const writes: string[] = [];
  await page.context().routeWebSocket(/\/socket\.io\//, (ws) => ws.close());
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") {
      return reply(route, wrap({ id: "201", role: "market", name: "Baraka Shop", status: "active", cancelled_handover_qr_required: true }));
    }
    if (path === "orders/markets/201/cancelled") return reply(route, wrap([]));
    if (request.method() !== "GET") {
      writes.push(`${request.method()} ${path}`);
      if (path === "orders/markets/201/cancelled/qr") {
        // zkRab9M2 (BG6): QR bilan birga 6 xonali kod.
        return reply(
          route,
          wrap({ market_id: "201", qr_token: "MCR-201-e2e-0001", qr_ttl_seconds: 120, pin: "042917", pin_max_attempts: 5 }),
        );
      }
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
  });

  await page.goto("/new-orders/cancelled/201");
  await expect(page.getByText("Bekor qilingan buyurtma yo'q")).toBeVisible({ timeout: 90_000 });
  const receive = page.getByRole("button", { name: "Qabul qilish" });
  await expect(receive).toBeEnabled();
  expect((await receive.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await receive.click();
  const dialog = page.getByRole("dialog", { name: "Bekor qilingan buyurtmalar QR kodi" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("img", { name: "Bekor qilingan buyurtmalarni topshirish QR kodi" })).toBeVisible();
  // QR ostida kod: «042 917» (boshidagi nol saqlanadi) va amal qilish vaqti.
  const pin = dialog.getByTestId("market-qr-pin");
  await expect(pin.getByText("QR o'qilmasa — PIN kod")).toBeVisible();
  await expect(pin.getByTestId("market-qr-pin-value")).toHaveText("042 917");
  await expect(pin.getByRole("timer")).toHaveText(/0[12]:[0-5]\d amal qiladi/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(writes).toEqual(["POST orders/markets/201/cancelled/qr"]);
});
