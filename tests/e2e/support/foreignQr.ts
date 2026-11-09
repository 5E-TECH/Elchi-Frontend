import { expect, type Page, type Route } from "@playwright/test";
import { toastRegion } from "./toast";

/**
 * Begona QR (Elchi-Backend #620, Trello anKpzwxk; ega Q5 sukuti) — `/scan/:token`. Soxta backend:
 *  - `GET orders/qr-code/ORD-77031` — 403 `order_not_in_your_branch` (javobda faqat `{ statusCode, message, data:
 *    { reason } }`, buyurtma ma'lumoti yo'q);
 *  - `GET orders/qr-code/ORD-77050` — avval 503 `branch_scope_unavailable` (React Query bir marta o'zi qayta so'raydi),
 *    «Qayta urinish» dan keyin — 200, buyurtma;
 *  - `GET post/scan/POST-2493` va `GET post/orders/2493` (pochta sahifasi, S8) — kuryerga 403
 *    `post_not_visible_to_courier`.
 * `role`: REGIONAL menejer (filial 3) yoki kuryer. Yozish so'rovlari taqiqlangan (`leaked`); konsol xatolari
 * yig'iladi (brauzerning «Failed to load resource» va WebSocket tarmoq yozuvlaridan tashqari).
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

const ORDER = {
  id: "77050",
  qr_code_token: "ORD-77050",
  createdAt: "2026-11-05T08:00:00.000Z",
  status: "received",
  total_price: 185000,
  to_be_paid: 185000,
  where_deliver: "address",
  product_quantity: 1,
  market: { id: "m-1", name: "Baraka Shop" },
  customer: { id: "c-1", name: "Feruza Mirzayeva", phone_number: "+998907421836" },
  district: { id: "d-1", name: "Qarshi sh.", region: { id: "14", name: "Qashqadaryo" } },
  region: { id: "14", name: "Qashqadaryo" },
  branch: { id: "3", name: "Qarshi filiali" },
  items: [],
};

export type ForeignQrRole = "manager" | "courier";

export const mockForeignQr = async (
  page: Page,
  { role = "manager" as ForeignQrRole, theme = "light" as "light" | "dark" } = {},
) => {
  const leaked: string[] = [];
  const lookups: string[] = [];
  const consoleErrors: string[] = [];
  let scopeCalls = 0;
  page.on("console", (message) => {
    // Brauzerning tarmoq yozuvlari (403/503 javobi, jonli kanal WebSocket'i — e2e'da prod API bloklangan) — ilova xatosi emas.
    if (message.type() === "error" && !/Failed to load resource|WebSocket connection/.test(message.text())) {
      consoleErrors.push(message.text());
    }
  });
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");

    if (path === "auth/my-profile") {
      return reply(route, {
        statusCode: 200,
        data:
          role === "manager"
            ? {
                id: "522",
                role,
                name: "Bekzod Normurodov",
                status: "active",
                branch_id: "3",
                branch_type: "REGIONAL",
                branch: { id: "3", name: "Qarshi filiali", type: "REGIONAL" },
                settings: { appearance: { theme, themeChosen: true } },
              }
            : {
                id: "42",
                role,
                name: "Jasur Tursunov",
                status: "active",
                branch_id: "3",
                branch: { id: "3", name: "Qarshi filiali", type: "REGIONAL" },
                settings: { appearance: { theme, themeChosen: true } },
              },
      });
    }
    const qr = /^orders\/qr-code\/(.+)$/.exec(path);
    if (qr && request.method() === "GET") {
      const token = decodeURIComponent(qr[1]);
      lookups.push(token);
      if (token === "ORD-77031") {
        return reply(
          route,
          { statusCode: 403, message: "Bu buyurtma sizning filialingizda emas", data: { reason: "order_not_in_your_branch" } },
          403,
        );
      }
      if (token === "ORD-77050") {
        scopeCalls += 1;
        if (scopeCalls <= 2) {
          return reply(
            route,
            {
              statusCode: 503,
              message: "Filialingizni aniqlab bo'lmadi — birozdan so'ng qayta urinib ko'ring",
              data: { reason: "branch_scope_unavailable" },
            },
            503,
          );
        }
        return reply(route, { statusCode: 200, data: ORDER });
      }
      return reply(route, { statusCode: 404, message: "Buyurtma topilmadi" }, 404);
    }
    if (path === "post/orders/2493") {
      lookups.push("post/orders/2493");
      return reply(
        route,
        {
          statusCode: 403,
          message: "Bu pochta hali filialga qabul qilinmagan — kuryerga ko'rinmaydi",
          data: { reason: "post_not_visible_to_courier", details: { post_id: "2493" } },
        },
        403,
      );
    }
    if (path === "post/scan/POST-2493") {
      lookups.push("POST-2493");
      return reply(
        route,
        {
          statusCode: 403,
          message: "Bu pochta hali filialga qabul qilinmagan — kuryerga ko'rinmaydi",
          data: { reason: "post_not_visible_to_courier", details: { post_id: "2493" } },
        },
        403,
      );
    }
    if (request.method() !== "GET") {
      leaked.push(`${request.method()} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    }
    return reply(route, { statusCode: 200, data: [] });
  });
  await page.addInitScript((t) => {
    window.localStorage.setItem("theme", t);
    window.localStorage.setItem("theme-version", "2");
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
  }, theme);
  return { leaked, lookups, consoleErrors };
};

const shot = async (page: Page, name: string) => {
  if (process.env.E2E_SHOTS_DIR) await page.screenshot({ path: `${process.env.E2E_SHOTS_DIR}/${name}.png`, fullPage: true });
};

const noHorizontalScroll = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

/** `/scan/:token` — shell'siz to'liq ekran sahifa: kontent `main` ichida. */
const content = (page: Page) => page.getByRole("main");

/** Skan signali (`ScanFeedbackOverlay`, 1,35 s) — matnida sabab; skrinshotdan oldin yo'qolishini kutamiz. */
const expectFeedbackGone = async (page: Page, text: string) => {
  await expect(page.getByRole("heading", { level: 2, name: text })).toHaveCount(0, { timeout: 10_000 });
};

/** Kulrang «filialingizda emas» kartasi: sarlavha, faqat «Skanerga qaytish», «Qayta urinish» va ma'lumot yo'q. */
export const runForeignOrderQr = async (page: Page, { theme, label }: { theme: "light" | "dark"; label: string }) => {
  const { leaked, lookups, consoleErrors } = await mockForeignQr(page, { role: "manager", theme });
  await page.goto("/scan/ORD-77031");

  const card = content(page).getByTestId("scan-forbidden");
  await expect(card.getByRole("heading", { level: 1, name: "Bu buyurtma sizning filialingizda emas" })).toBeVisible({
    timeout: 60_000,
  });
  await expect(card.getByRole("link", { name: "Skanerga qaytish" })).toHaveAttribute("href", "/scan");
  await expect(content(page).getByRole("button", { name: "Qayta urinish" })).toHaveCount(0);
  await expect(content(page).getByText("Buyurtma topilmadi")).toHaveCount(0);
  await expect(content(page).getByText(/№/)).toHaveCount(0);
  await expect(toastRegion(page)).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name: "Bu buyurtma sizning filialingizda emas" })).toBeVisible();
  await expectFeedbackGone(page, "Bu buyurtma sizning filialingizda emas");
  await noHorizontalScroll(page);
  await shot(page, `scan-foreign-${label}-${theme}`);
  // 403 qayta so'ralmaydi.
  expect(lookups).toEqual(["ORD-77031"]);
  expect(consoleErrors).toEqual([]);
  expect(leaked).toEqual([]);

  await card.getByRole("link", { name: "Skanerga qaytish" }).click();
  await expect(page).toHaveURL(/\/scan$/);
};

/** Kuryer, pochta QR'i: «Pochta hali filialga qabul qilinmagan» + izoh, qayta urinishsiz. */
export const runCourierHiddenPostQr = async (page: Page, { theme, label }: { theme: "light" | "dark"; label: string }) => {
  const { leaked, consoleErrors } = await mockForeignQr(page, { role: "courier", theme });
  await page.goto("/scan/POST-2493");

  const card = content(page).getByTestId("scan-forbidden");
  await expect(card.getByRole("heading", { level: 1, name: "Pochta hali filialga qabul qilinmagan" })).toBeVisible({
    timeout: 60_000,
  });
  await expect(card).toContainText("Filial menejeri qabul qilgach, pochta sizga ko'rinadi.");
  await expect(content(page).getByRole("button", { name: "Qayta urinish" })).toHaveCount(0);
  await expect(content(page).getByText("Pochta topilmadi")).toHaveCount(0);
  await expectFeedbackGone(page, "Pochta hali filialga qabul qilinmagan");
  await noHorizontalScroll(page);
  await shot(page, `scan-foreign-${label}-${theme}`);
  expect(consoleErrors).toEqual([]);
  expect(leaked).toEqual([]);
};

/** 503 `branch_scope_unavailable`: «Filialingizni aniqlab bo'lmadi» + «Qayta urinish» → buyurtma ochiladi. */
export const runScopeUnavailableRetry = async (page: Page, { theme, label }: { theme: "light" | "dark"; label: string }) => {
  const { leaked, lookups } = await mockForeignQr(page, { role: "manager", theme });
  await page.goto("/scan/ORD-77050");

  await expect(content(page).getByRole("heading", { level: 1, name: "Filialingizni aniqlab bo'lmadi" })).toBeVisible({
    timeout: 60_000,
  });
  await expect(content(page).getByText("Birozdan so'ng qayta urinib ko'ring.")).toBeVisible();
  await expectFeedbackGone(page, "Filialingizni aniqlab bo'lmadi");
  await shot(page, `scan-foreign-${label}-${theme}`);
  await content(page).getByRole("button", { name: "Qayta urinish" }).click();
  await expect(content(page).getByRole("heading", { level: 1, name: "Buyurtma №77050" })).toBeVisible({ timeout: 30_000 });
  expect(lookups.filter((token) => token === "ORD-77050").length).toBeGreaterThanOrEqual(3);
  expect(leaked).toEqual([]);
};

/** S8: kuryer pochta havolasini ochdi (`/mails/2493`) — kulrang holat, lokal matn, global xabar yo'q, qayta urinishsiz. */
export const runCourierHiddenPostDetail = async (page: Page, { theme, label }: { theme: "light" | "dark"; label: string }) => {
  const { leaked, consoleErrors } = await mockForeignQr(page, { role: "courier", theme });
  await page.goto("/mails/2493");

  const main = page.locator("[data-shell-slot=content]");
  await expect(main.getByText("Pochta hali filialga qabul qilinmagan")).toBeVisible({ timeout: 60_000 });
  await expect(main.getByText("Filial menejeri qabul qilgach, pochta sizga ko'rinadi.")).toBeVisible();
  await expect(main.getByRole("button", { name: "Qayta urinish" })).toHaveCount(0);
  await expect(main.getByText("Ma'lumotlarni yuklab bo'lmadi")).toHaveCount(0);
  await expect(toastRegion(page)).toHaveCount(0);
  await noHorizontalScroll(page);
  await shot(page, `mail-courier-hidden-${label}-${theme}`);
  expect(consoleErrors).toEqual([]);
  expect(leaked).toEqual([]);
};

/**
 * Universal `/scan` («Ma'lumot» rejimi, 1440): kod qo'lda kiritiladi → 403 `order_not_in_your_branch` — «Natija»
 * kartasida lokal sarlavha, faqat o'qilgan matn (raqam va ma'lumot yo'q), sahifa ochilmaydi.
 */
export const runUniversalForeignQr = async (page: Page, { theme, label }: { theme: "light" | "dark"; label: string }) => {
  const { leaked, lookups, consoleErrors } = await mockForeignQr(page, { role: "manager", theme });
  await page.goto("/scan");

  const form = page.getByRole("form", { name: "Kodni qo'lda kiriting" });
  await form.getByRole("textbox").fill("ORD-77031", { timeout: 60_000 });
  await form.getByRole("button", { name: "Ochish" }).click();

  const result = page.getByRole("region", { name: "Natija" });
  await expect(result.getByText("Bu buyurtma sizning filialingizda emas")).toBeVisible();
  await expect(result.getByText("O'qilgan matn")).toBeVisible();
  await expect(result.getByText("ORD-77031")).toBeVisible();
  await expect(result.getByText("Kodni tekshirib bo'lmadi")).toHaveCount(0);
  await expect(result.getByText(/№/)).toHaveCount(0);
  await expectFeedbackGone(page, "Bu buyurtma sizning filialingizda emas");
  await expect(page).toHaveURL(/\/scan$/);
  await noHorizontalScroll(page);
  await shot(page, `scan-universal-foreign-${label}-${theme}`);
  expect(lookups).toEqual(["ORD-77031"]);
  expect(consoleErrors).toEqual([]);
  expect(leaked).toEqual([]);
};
