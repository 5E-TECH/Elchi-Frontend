import { expect, type Locator, type Page, type Route } from "@playwright/test";
import { aiDistrictsByRegion, aiProducts, aiRegions } from "../../../src/test/aiOrderFixtures";

/**
 * Qo'lda buyurtma yaratish (Step2Combined) e2e testlari uchun umumiy soxta backend.
 *
 * ⚠️ Hech qanday so'rov serverga KETMAYDI: localhost'dan tashqaridagi HAMMA
 * so'rov shu yerda yopiladi. Kutilmagan yozuvchi so'rov `leaked` ga tushadi va
 * 403 bilan rad etiladi; faqat `POST orders` (buyurtma yaratish) qabul qilinib,
 * tanasi `createdOrders` ga yoziladi.
 */

export const ORIGIN = "http://127.0.0.1:4173";

const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};

const reply = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });

const wrap = (data: unknown) => ({ statusCode: 200, message: "ok", data });

export const mockOrderCreateApi = async (page: Page) => {
  const leaked: string[] = [];
  const createdOrders: Record<string, unknown>[] = [];
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });

    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/refresh") {
      const now = Date.now();
      return reply(route, {
        accessToken: "e2e.local.token",
        accessTokenExpiresAt: now + 3_600_000,
        refreshTokenExpiresAt: now + 86_400_000,
      });
    }
    if (path === "auth/my-profile") {
      return reply(route, wrap({ id: "7", role: "market", name: "E2E market", status: "active", add_order: true }));
    }
    if (path === "orders/ai-availability") return reply(route, wrap({ enabled: false, state: "disabled" }));
    if (path === "region") return reply(route, wrap(aiRegions));
    const region = path.match(/^region\/(\d+)$/);
    if (region) return reply(route, { districts: aiDistrictsByRegion[region[1]] ?? [] });
    if (path === "product/my-products") return reply(route, wrap(aiProducts));
    if (path === "orders" && request.method() === "POST") {
      createdOrders.push(request.postDataJSON() as Record<string, unknown>);
      return reply(route, wrap({ id: "e2e-order-1", status: "new" }), 201);
    }
    if (request.method() !== "GET") {
      leaked.push(`${request.method()} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    }
    return reply(route, wrap([]));
  });
  return { leaked, createdOrders };
};

/**
 * Market roli to'g'ridan-to'g'ri 2-qadamga (Step2Combined) tushadi.
 *
 * Login formasi bu testlarning mavzusi emas — sessiya `sessionStorage` ga
 * oldindan yoziladi (ilova ishga tushganda rolni `auth/my-profile` dan oladi).
 */
export const openManualCreate = async (page: Page) => {
  await page.addInitScript(() => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
  });

  await page.goto("/new-orders/create");
  // Sovuq dev serverda sahifa chunk'lari birinchi marta kompilyatsiya qilinadi
  // (sekin mashinada parallel workerlar bilan 20s dan oshadi).
  await expect(page.locator('input[name="customer.name"]')).toBeVisible({ timeout: 60_000 });
};

/** Maydonni o'z ichiga olgan eng yaqin grid. */
export const gridOf = (field: Locator) =>
  field.locator("xpath=ancestor::div[contains(concat(' ', @class, ' '), ' grid ')][1]");

/** Grid ustunlari va har bir bevosita bolasining kengligi. */
export const measureGrid = (grid: Locator) =>
  grid.evaluate((el) => {
    const style = getComputedStyle(el);
    const content = el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    return {
      columns: style.gridTemplateColumns.split(" ").filter(Boolean),
      content: Math.round(content),
      children: Array.from(el.children).map((child) => Math.round(child.getBoundingClientRect().width)),
    };
  });

/** Haqiqiy skroll konteyneri — `<main>`: ijobiy son = gorizontal skroll bor. */
export const mainHorizontalOverflow = (page: Page) =>
  page.locator("main.el-surface-page").evaluate((main) => main.scrollWidth - main.clientWidth);
