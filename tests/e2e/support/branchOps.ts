import { expect, type Page, type Route } from "@playwright/test";

/**
 * `/batches` ichidagi «Filiallar — operatsiyalar» e2e uchun soxta backend (superadmin). Hech qanday so'rov
 * serverga ketmaydi; har yozuvchi so'rov `leaked` ga tushadi (oP02jE2P dan beri sahifada yozuv amali yo'q).
 */
/** Dev server manzili (worktree probe'larida boshqa port — `E2E_ORIGIN`). */
const ORIGIN = process.env.E2E_ORIGIN ?? "http://127.0.0.1:4173";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });

/** Backend `branch.new_orders.branches` javobi — `successRes(items)` konverti. */
export const NEW_ORDER_BRANCHES = [
  { id: "12", name: "Urganch filiali", type: "REGIONAL", level: 1, parent_id: "1", code: "URG", status: "active", new_orders_count: 7 },
  { id: "15", name: "Xiva filiali", type: "PICKUP", level: 2, parent_id: "12", code: "XIV", status: "active", new_orders_count: 2 },
];

export const mockBranchOpsApi = async (page: Page) => {
  const leaked: string[] = [];
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
    if (path === "branches/new-orders") {
      return reply(route, { statusCode: 200, message: "Branches with NEW orders", data: NEW_ORDER_BRANCHES });
    }
    if (request.method() !== "GET") {
      leaked.push(`${request.method()} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
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
  return { leaked };
};

export const openBranchOps = async (page: Page) => {
  await page.goto("/batches");
  await expect(page.getByRole("heading", { name: "Filiallar — operatsiyalar" })).toBeVisible({ timeout: 60_000 });
};

/** Dizayn v2 (maket `superadmin-ops-branches`): jadval qatorlari. */
export const branchRows = (page: Page) =>
  page.getByRole("table", { name: "Yangi buyurtmali filiallar" }).locator("tbody tr");
