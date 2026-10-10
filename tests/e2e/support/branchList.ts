import { expect, type Page, type Route } from "@playwright/test";

/**
 * `/branches` e2e uchun soxta backend (superadmin). `GET branches` backend kabi
 * `page`/`limit` bo'yicha bo'laklaydi va `data: { items, meta }` qaytaradi.
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

const NAMES = [
  "Andijon", "Buxoro", "Farg'ona", "Jizzax", "Xorazm", "Qashqadaryo", "Navoiy",
  "Namangan", "Samarqand", "Sirdaryo", "Surxondaryo", "Toshkent viloyati",
];
// Jonli API tartibi: 1-sahifada Andijon..Namangan (12), 2-sahifada "HQ Toshkent".
export const BRANCHES = [
  ...NAMES.map((name, index) => ({
    id: String(index + 2),
    name: `${name} filiali`,
    code: `BR-${index + 2}`,
    type: "REGIONAL",
    status: "active",
    level: 1,
    parent_id: "1",
  })),
  { id: "1", name: "HQ Toshkent", code: "HQ", type: "HQ", status: "active", level: 0, parent_id: null },
];

export const mockBranchListApi = async (page: Page, viewMode: "table" | "card") => {
  const leaked: string[] = [];
  const listRequests: string[] = [];
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") {
      return reply(route, { statusCode: 200, data: { id: "1", role: "superadmin", name: "Bosh admin", status: "active" } });
    }
    if (path === "branches" && request.method() === "GET") {
      const pageNo = Number(url.searchParams.get("page") ?? 1);
      const limit = Number(url.searchParams.get("limit") ?? 10);
      listRequests.push(`page=${pageNo}&limit=${limit}`);
      const items = BRANCHES.slice((pageNo - 1) * limit, pageNo * limit);
      return reply(route, {
        statusCode: 200,
        message: "Branches list",
        data: {
          items,
          meta: { page: pageNo, limit, total: BRANCHES.length, totalPages: Math.ceil(BRANCHES.length / limit) },
        },
      });
    }
    if (request.method() !== "GET") {
      leaked.push(`${request.method()} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    }
    return reply(route, { statusCode: 200, data: [] });
  });
  await page.addInitScript((mode) => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
    window.localStorage.setItem("branches-view-mode", mode);
  }, viewMode);
  return { leaked, listRequests };
};

export const openBranchList = async (page: Page) => {
  await page.goto("/branches");
  await expect(page.getByText(/dan \d+ tasi ko'rsatilmoqda/)).toBeVisible({ timeout: 60_000 });
};
