import { expect, type Page, type Route } from "@playwright/test";

/**
 * `/branch-ops` e2e uchun soxta backend (superadmin). Hech qanday so'rov
 * serverga ketmaydi; ruxsatsiz yozuvchi so'rov `leaked` ga tushadi.
 */
/** Dev server manzili (worktree probe'larida boshqa port — `E2E_ORIGIN`). */
const ORIGIN = process.env.E2E_ORIGIN ?? "http://127.0.0.1:4194";
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

export const mockBranchOpsApi = async (
  page: Page,
  options: { cancel?: (body: unknown) => { status: number; body: unknown } } = {},
) => {
  const leaked: string[] = [];
  const cancelBodies: unknown[] = [];
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
    const cancel = path.match(/^transfer-batches\/([^/]+)\/cancel$/);
    if (cancel && request.method() === "POST" && options.cancel) {
      const body = request.postDataJSON();
      cancelBodies.push(body);
      const result = options.cancel(body);
      return reply(route, result.body, result.status);
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
  return { leaked, cancelBodies };
};

export const openBranchOps = async (page: Page) => {
  await page.goto("/branch-ops");
  await expect(page.getByRole("heading", { name: "Filiallar — operatsiyalar" })).toBeVisible({ timeout: 60_000 });
};

/** Dizayn v2 (maket `superadmin-ops-branches`): jadval qatorlari, forma maydonlari va tugma. */
export const branchRows = (page: Page) =>
  page.getByRole("table", { name: "Yangi buyurtmali filiallar" }).locator("tbody tr");
export const batchIdInput = (page: Page) => page.getByRole("textbox", { name: /Paket ID/ });
export const reasonInput = (page: Page) => page.getByRole("textbox", { name: /Bekor qilish sababi/ });
export const cancelBatchButton = (page: Page) => page.getByRole("button", { name: "Paketni bekor qilish", exact: true });

/**
 * Paketni bekor qilish tasdig'i — dizayn v2 `useConfirm` (`role="alertdialog"`), maket matnlari:
 * «Paketni bekor qilasizmi?» / «Paket bekor qilinadi, undagi barcha buyurtmalar paketdan ajratiladi.» ·
 * «Yo'q» / «Ha, bekor qilish».
 */
export const confirmBatchCancel = async (page: Page) => {
  const dialog = page.getByRole("alertdialog", { name: "Paketni bekor qilasizmi?" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Paket bekor qilinadi, undagi barcha buyurtmalar paketdan ajratiladi.");
  await expect(dialog.getByRole("button", { name: "Yo'q", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Ha, bekor qilish", exact: true }).click();
  await expect(dialog).toHaveCount(0);
};
