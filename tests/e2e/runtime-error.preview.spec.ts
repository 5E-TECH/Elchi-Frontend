import { expect, test, type Route } from "@playwright/test";

/**
 * L6q4DiGU — PROD BUILD: ilova xatosi sahifasida minifikatsiyalangan stek ko'rinmaydi («Xato tafsilotlari» ichida
 * ham) — faqat qisqa xato kodi (`ERR-XXXX`) va xabar. Xato yozuvi — `ErrorBoundary` saqlaydigan shaklda.
 */
const ORIGIN = "http://127.0.0.1:4175";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown) =>
  route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(body) });

const STACK = "TypeError: r.forEach is not a function\n    at Hx (http://127.0.0.1:4175/assets/index-Bq3x.js:1:2345)";
const COMPONENT_STACK = "\n    at Orders (http://127.0.0.1:4175/assets/orders-Zk1a.js:9:99)";

test("⭐ prod: /runtime-error — stek yo'q, «Xato tafsilotlari» da xato kodi va xabar", async ({ page }) => {
  await page.context().route(/api\.elchipochta\.uz|:3004\//, (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = new URL(request.url()).pathname.replace(/^\//, "");
    if (path === "auth/my-profile") {
      return reply(route, { statusCode: 200, data: { id: "1", role: "superadmin", name: "Bosh admin", status: "active" } });
    }
    return reply(route, { statusCode: 200, data: [] });
  });
  await page.addInitScript(
    ({ stack, componentStack }) => {
      const far = Date.now() + 86_400_000;
      window.sessionStorage.setItem("accessToken", "e2e.local.token");
      window.sessionStorage.setItem(
        "authSessionMetadata",
        JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
      );
      window.sessionStorage.setItem(
        "elchi_runtime_error",
        JSON.stringify({
          message: "r.forEach is not a function",
          stack,
          componentStack,
          sourcePath: "/orders",
          occurredAt: new Date().toISOString(),
          retryCount: 1,
        }),
      );
    },
    { stack: STACK, componentStack: COMPONENT_STACK },
  );

  await page.goto("/runtime-error");
  const state = page.locator("[data-error-kind]");
  await expect(state.getByRole("heading", { level: 1, name: "Sahifani ko'rsatib bo'lmadi" })).toBeVisible({ timeout: 60_000 });

  await state.getByRole("button", { name: "Xato tafsilotlari" }).click();
  const details = state.locator("pre");
  await expect(details).toBeVisible();
  await expect(details).toContainText(/Xato kodi: ERR-[0-9A-F]{4}/);
  await expect(details).toContainText("r.forEach is not a function");
  for (const text of ["at Hx", "at Orders", "index-Bq3x.js", "orders-Zk1a.js"]) {
    await expect(page.locator("body")).not.toContainText(text);
  }
});
