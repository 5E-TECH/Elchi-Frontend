import { expect, type Page, type Route } from "@playwright/test";

/**
 * «Yangi pochtalar» (`GET post/new`) faqat HQ xodimlariga (Elchi-Backend #620, Trello anKpzwxk; ega Q1 sukuti).
 * Soxta backend — registrator:
 *  - HQ bo'lmagan filial (REGIONAL, filial 3): `GET post/new` → 403 `new_posts_hq_only` (#620 javobi). FE uni
 *    UMUMAN chaqirmasligi kerak (`newPostsRequests` bo'sh), «Bugungi» tabi yo'q, `/mails` → `/mails/return`,
 *    xato xabari (toast) chiqmaydi;
 *  - HQ registratori: `GET post/new` → 200 (bitta YANGI pochta) — «Bugungi» bor.
 *  - `GET post/rejected`, `GET post` (eski), `GET post/return-requests/list` — kichik ro'yxatlar;
 *    yozish so'rovlari taqiqlangan (`leaked`).
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

const mail = (id: string, status: string, branchId: string | null, region: [string, string]) => ({
  id,
  createdAt: "2026-11-05T09:15:00.000Z",
  updatedAt: "2026-11-05T09:15:00.000Z",
  isDeleted: false,
  courier_id: "0",
  post_total_price: 650000,
  order_quantity: 3,
  qr_code_token: `POST-${id}`,
  region_id: region[0],
  branch_id: branchId,
  region: { id: region[0], name: region[1], sato_code: "" },
  status,
  courier: null,
});

export type BranchType = "HQ" | "REGIONAL";

export const mockBranchRegistrator = async (
  page: Page,
  { branchType = "REGIONAL" as BranchType, theme = "light" as "light" | "dark" } = {},
) => {
  const leaked: string[] = [];
  const newPostsRequests: string[] = [];
  const branch = branchType === "HQ" ? { id: "1", name: "HQ Toshkent", type: "HQ" } : { id: "3", name: "Andijon filiali", type: "REGIONAL" };
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
        data: {
          id: "61",
          role: "registrator",
          name: "Dilnoza Karimova",
          status: "active",
          branch_id: branch.id,
          branch_type: branch.type,
          branch,
          settings: { appearance: { theme, themeChosen: true } },
        },
      });
    }
    if (path === "post/new") {
      newPostsRequests.push(request.method());
      if (branchType !== "HQ") {
        return reply(
          route,
          {
            statusCode: 403,
            message: "«Yangi pochtalar» faqat HQ xodimlari uchun — ko'rishga ruxsat yo'q",
            data: { reason: "new_posts_hq_only" },
          },
          403,
        );
      }
      return reply(route, { statusCode: 200, data: [mail("2490", "new", null, ["8", "Samarqand"])] });
    }
    if (path === "post/rejected") {
      return reply(route, { statusCode: 200, data: [mail("2488", "canceled", branch.id, ["2", "Andijon"])] });
    }
    if (path === "post/return-requests/list") {
      return reply(route, { statusCode: 200, data: { total: 0, scope: { type: "BRANCH", branch_id: branch.id }, groups: [] } });
    }
    if (path === "post" && request.method() === "GET") {
      const rows = [mail("2487", "received", branch.id, ["2", "Andijon"])];
      return reply(route, {
        statusCode: 200,
        data: { data: rows, total: rows.length, page: 1, totalPages: 1, limit: 8, orders_total: 3, amount_total: 650000 },
      });
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
  return { leaked, newPostsRequests };
};

const shot = async (page: Page, name: string) => {
  if (process.env.E2E_SHOTS_DIR) await page.screenshot({ path: `${process.env.E2E_SHOTS_DIR}/${name}.png`, fullPage: true });
};

const noHorizontalScroll = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

/** 403 xabari (toast yoki xato holati) — bo'lmasligi kerak. */
const expectNoForbiddenNoise = async (page: Page) => {
  await expect(page.getByText("Bu ma'lumotni ko'rishga ruxsatingiz yo'q", { exact: false })).toHaveCount(0);
  await expect(page.getByText("Ma'lumotni yuklab bo'lmadi")).toHaveCount(0);
  await expect(page.getByText("faqat HQ xodimlari uchun", { exact: false })).toHaveCount(0);
};

/** 1440: REGIONAL registrator — «Bugungi» yo'q, `/mails` → «Qaytarish», boshqa tablarda ham `post/new` so'ralmaydi. */
export const runBranchRegistratorDesktop = async (page: Page, theme: "light" | "dark") => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { leaked, newPostsRequests } = await mockBranchRegistrator(page, { theme });

  await page.goto("/mails");
  await expect(page).toHaveURL(/\/mails\/return$/, { timeout: 60_000 });
  const nav = page.getByRole("navigation", { name: "Pochta turlari" });
  await expect(nav.getByRole("link", { name: /^Qaytarish/ })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link")).toHaveText([/^Qaytarish/, /^Rad etilgan/, /^Eski/]);
  await expect(nav.getByRole("link", { name: /Bugungi/ })).toHaveCount(0);
  await shot(page, `mails-branch-registrator-1440-${theme}`);

  await page.goto("/mails/today");
  await expect(page).toHaveURL(/\/mails\/return$/);

  await nav.getByRole("link", { name: /^Rad etilgan/ }).click();
  await expect(page.getByRole("table", { name: "Rad etilgan pochtalar" }).getByRole("link", { name: "№2488", exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await nav.getByRole("link", { name: "Eski" }).click();
  await expect(page.getByRole("table", { name: "Eski pochtalar" }).getByRole("link", { name: "№2487", exact: true })).toBeVisible({
    timeout: 30_000,
  });

  await expectNoForbiddenNoise(page);
  await noHorizontalScroll(page);
  expect(newPostsRequests).toEqual([]);
  expect(leaked).toEqual([]);
};

/** 390: telefon bo'lim tanlagichida «Bugungi pochtalar» yo'q, `/mails` → «Qaytarish so'rovlari». */
export const runBranchRegistratorPhone = async (page: Page, theme: "light" | "dark") => {
  const { leaked, newPostsRequests } = await mockBranchRegistrator(page, { theme });

  await page.goto("/mails");
  await expect(page).toHaveURL(/\/mails\/return$/, { timeout: 60_000 });
  const select = page.getByRole("combobox", { name: "Pochta bo'limi: Qaytarish so'rovlari" });
  await expect(select).toBeVisible();
  await shot(page, `mails-branch-registrator-390-${theme}`);
  await select.click();
  await expect(page.getByRole("option", { name: /Rad etilgan pochtalar/ })).toBeVisible();
  await expect(page.getByRole("option", { name: /Eski pochtalar/ })).toBeVisible();
  await expect(page.getByRole("option", { name: /Bugungi pochtalar/ })).toHaveCount(0);
  // Ro'yxat ochilish animatsiyasi tugasin (skrinshotda orqa fon ko'rinmasin).
  await expect(page.getByRole("listbox")).toHaveCSS("opacity", "1");
  await page.evaluate(() =>
    Promise.allSettled(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map((animation) => animation.finished),
    ),
  );
  await shot(page, `mails-branch-registrator-390-select-${theme}`);
  await page.keyboard.press("Escape");

  await expectNoForbiddenNoise(page);
  await noHorizontalScroll(page);
  expect(newPostsRequests).toEqual([]);
  expect(leaked).toEqual([]);
};

/** HQ registratori — «Bugungi» bor va `post/new` so'raladi (o'zgarmagan). */
export const runHqRegistratorKeepsToday = async (page: Page) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { leaked, newPostsRequests } = await mockBranchRegistrator(page, { branchType: "HQ" });

  await page.goto("/mails");
  await expect(page).toHaveURL(/\/mails\/today$/, { timeout: 60_000 });
  await expect(page.getByRole("table", { name: "Bugungi pochtalar" }).getByRole("link", { name: "№2490", exact: true })).toBeVisible({
    timeout: 30_000,
  });
  expect(newPostsRequests.length).toBeGreaterThan(0);
  expect(leaked).toEqual([]);
};
