import { expect, type Page, type Route } from "@playwright/test";

/**
 * «Pochta» jadvali: «Kuryer» o'rnida «Filial» (Bahodir, 2026-11-04) — soxta backend.
 *  - `GET post` (eski pochtalar) va `GET post/rejected` — pochtalar faqat `branch_id` bilan (nomi yo'q), biri
 *    kuryerli (filial kuryeri pochtasi);
 *  - `GET branches` — superadmin uchun nomlar (40-filial ro'yxatda yo'q → «Filial #40»);
 *  - menejer (HQ) — o'z filiali bilan; yozish so'rovlari taqiqlangan (`leaked`).
 */
const ORIGIN = "http://127.0.0.1:4173";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: "application/json",
    headers: cors,
    body: JSON.stringify(body),
  });

const mail = (
  id: string,
  status: string,
  branchId: string | null,
  courier: string | null,
  region: [string, string],
) => ({
  id,
  createdAt: "2026-11-03T09:15:00.000Z",
  updatedAt: "2026-11-03T09:15:00.000Z",
  isDeleted: false,
  courier_id: courier ? "209" : "0",
  post_total_price: 650000,
  order_quantity: 3,
  qr_code_token: `POST-${id}`,
  region_id: region[0],
  branch_id: branchId,
  region: { id: region[0], name: region[1], sato_code: "" },
  status,
  courier: courier ? { id: "209", name: courier } : null,
});

const OLD = [
  mail("101", "received", "16", null, ["8", "Samarqand"]),
  mail("100", "received", "1", "Sherzod Alimov", ["1", "Toshkent shahri"]),
  mail("99", "sent", "40", null, ["12", "Jizzax"]),
];
const REFUSED = [mail("98", "canceled", "16", "Bekzod Normurodov", ["8", "Samarqand"])];

export const mockMailsBranchColumn = async (
  page: Page,
  { role = "superadmin" as "superadmin" | "manager", theme = "light" as "light" | "dark" } = {},
) => {
  const leaked: string[] = [];
  const branchRequests: string[] = [];
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
                id: "42",
                role,
                name: "Ravshan Ortiqov",
                status: "active",
                branch_id: "1",
                branch_type: "HQ",
                branch: { id: "1", name: "HQ Toshkent", type: "HQ" },
                settings: { appearance: { theme, themeChosen: true } },
              }
            : {
                id: "1",
                role,
                name: "Bosh admin",
                status: "active",
                settings: { appearance: { theme, themeChosen: true } },
              },
      });
    }
    if (path === "post" && request.method() === "GET") {
      const rows = role === "manager" ? OLD.filter((item) => item.branch_id === "1") : OLD;
      return reply(route, {
        statusCode: 200,
        data: {
          data: rows,
          total: rows.length,
          page: 1,
          totalPages: 1,
          limit: 8,
          orders_total: 9,
          amount_total: 1950000,
        },
      });
    }
    if (path === "post/rejected") return reply(route, { statusCode: 200, data: REFUSED });
    if (path === "branches") {
      branchRequests.push(url.search);
      return reply(route, {
        statusCode: 200,
        data: {
          items: [
            { id: "1", name: "HQ Toshkent", type: "HQ", status: "active" },
            { id: "16", name: "Urgut filiali", type: "REGIONAL", status: "active" },
          ],
          total: 2,
        },
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
      JSON.stringify({
        accessTokenExpiresAt: far,
        refreshTokenExpiresAt: far,
        refreshTokenWarnAt: far,
      }),
    );
  }, theme);
  return { leaked, branchRequests };
};

const shot = async (page: Page, name: string) => {
  if (process.env.E2E_SHOTS_DIR)
    await page.screenshot({ path: `${process.env.E2E_SHOTS_DIR}/${name}.png`, fullPage: true });
};

const noHorizontalScroll = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

/** 1440 / 768: superadmin «Eski» va «Rad etilgan» — «Filial» ustuni (planshetda viloyat ostida), «Kuryer» yo'q. */
export const runBranchColumnTable = async (
  page: Page,
  theme: "light" | "dark",
  width: 1440 | 768,
) => {
  await page.setViewportSize({ width, height: 900 });
  const { leaked, branchRequests } = await mockMailsBranchColumn(page, { theme });

  await page.goto("/mails/old");
  const table = page.getByRole("table", { name: "Eski pochtalar" });
  await expect(table.getByRole("link", { name: "№101", exact: true })).toBeVisible({
    timeout: 60_000,
  });
  const row = (id: string) =>
    table.getByRole("row").filter({ has: page.getByRole("link", { name: id, exact: true }) });
  if (width === 1440) {
    await expect(table.getByRole("columnheader", { name: "Filial" })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "Kuryer" })).toHaveCount(0);
  } else {
    // < 1024: ustun yashirin, filial viloyat ostida (avval kuryer turgan joy).
    await expect(table.getByRole("columnheader", { name: "Filial" })).toBeHidden();
  }
  await expect(row("№101").getByText("Urgut filiali").locator("visible=true")).toHaveCount(1);
  await expect(row("№100").getByText("HQ Toshkent").locator("visible=true")).toHaveCount(1);
  await expect(row("№99").getByText("Filial #40").locator("visible=true")).toHaveCount(1);
  await expect(table.getByText("Sherzod Alimov")).toHaveCount(0);
  await noHorizontalScroll(page);
  await shot(page, `mails-branch-old-${width}-${theme}`);

  await page.goto("/mails/refused");
  const refused = page.getByRole("table", { name: "Rad etilgan pochtalar" });
  await expect(refused.getByRole("link", { name: "№98", exact: true })).toBeVisible({
    timeout: 30_000,
  });
  if (width === 1440)
    await expect(refused.getByRole("columnheader", { name: "Filial" })).toBeVisible();
  await expect(refused.getByText("Urgut filiali").locator("visible=true")).toHaveCount(1);
  await expect(refused.getByText("Bekzod Normurodov")).toHaveCount(0);
  await shot(page, `mails-branch-refused-${width}-${theme}`);

  expect(branchRequests.length).toBeGreaterThan(0);
  expect(leaked).toEqual([]);
};

/** 390: superadmin telefon kartasi izohida filial («№101 · Urgut filiali · 3 ta buyurtma · sana»). */
export const runBranchColumnPhone = async (page: Page, theme: "light" | "dark") => {
  const { leaked } = await mockMailsBranchColumn(page, { theme });
  await page.goto("/mails/old");
  const card = page
    .getByRole("link", { name: /№101|Samarqand/ })
    .filter({ hasText: "№101" })
    .locator("visible=true")
    .first();
  await expect(card).toBeVisible({ timeout: 60_000 });
  await expect(card).toContainText("№101 · Urgut filiali · 3 ta buyurtma");
  await expect(page.getByText("Sherzod Alimov").locator("visible=true")).toHaveCount(0);
  await noHorizontalScroll(page);
  await shot(page, `mails-branch-old-390-${theme}`);
  expect(leaked).toEqual([]);
};

/** HQ menejeri: o'z filiali — «Kuryer» qoladi, filial nomlari so'ralmaydi. */
export const runManagerKeepsCourier = async (page: Page) => {
  const { leaked, branchRequests } = await mockMailsBranchColumn(page, { role: "manager" });
  await page.goto("/mails/old");
  const table = page.getByRole("table", { name: "Eski pochtalar" });
  await expect(table.getByRole("link", { name: "№100", exact: true })).toBeVisible({
    timeout: 60_000,
  });
  await expect(table.getByRole("columnheader", { name: "Kuryer" })).toBeVisible();
  await expect(table.getByRole("columnheader", { name: "Filial" })).toHaveCount(0);
  await expect(table.getByText("Sherzod Alimov").locator("visible=true")).toHaveCount(1);
  expect(branchRequests).toEqual([]);
  expect(leaked).toEqual([]);
};
