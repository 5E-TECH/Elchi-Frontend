import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * wLNccBkX / lQP3ojwq — ops ruxsatlari, kutilgan natija aniq:
 *   - `/settlement` olib tashlangan (40a36e5; backend `settlement/*` — 410): HAR rol uchun 404 «Bu sahifa topilmadi»,
 *     ruxsat ham, 403 ham emas. Kuryer puli endi `/payments/cash-detail/:id` da qabul qilinadi (unit:
 *     `fix3b-cashDetail.test.tsx`, menejer `createPaymentCourier`).
 *   - `/ops` — faqat superadmin (maket `superadmin-ops-*`, «… faqat superadmin»); `/activity-logs` — superadmin va
 *     admin (maket `admin-activity-logs-list`); menejer ikkalasida 403.
 * Soxta backend, 1440px.
 */
const ORIGIN = "http://127.0.0.1:4194";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });

type Role = "superadmin" | "admin" | "manager" | "registrator";
const PROFILES: Record<Role, Record<string, unknown>> = {
  superadmin: { id: "1", role: "superadmin", name: "Bosh admin", status: "active" },
  admin: { id: "2", role: "admin", name: "Admin", status: "active" },
  manager: { id: "25", role: "manager", name: "Menejer", status: "active", branch_id: "3", branch: { id: "3", type: "HQ", name: "HQ" } },
  registrator: { id: "40", role: "registrator", name: "Ro'yxatchi", status: "active", branch_id: "3", branch: { id: "3", type: "HQ", name: "HQ" } },
};

const signIn = async (page: Page, role: Role) => {
  const writes: string[] = [];
  await page.context().routeWebSocket(/\/socket\.io\//, (ws) => ws.close());
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") return reply(route, { statusCode: 200, data: PROFILES[role] });
    if (request.method() !== "GET") writes.push(`${request.method()} ${path}`);
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
  return writes;
};

const NOT_FOUND = { name: "Bu sahifa topilmadi" };
const FORBIDDEN = { name: "Bu sahifaga ruxsatingiz yo'q" };

test.use({ viewport: { width: 1440, height: 900 } });
test.describe.configure({ timeout: 120_000 });

for (const role of ["manager", "registrator", "superadmin"] as const) {
  test(`⭐ ${role}: /settlement — 404 «Bu sahifa topilmadi» (ruxsat ham, 403 ham emas)`, async ({ page }) => {
    const writes = await signIn(page, role);
    await page.goto("/settlement");
    await expect(page.getByRole("heading", NOT_FOUND)).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText("404", { exact: false }).first()).toBeVisible();
    await expect(page.getByRole("heading", FORBIDDEN)).toHaveCount(0);
    expect(writes).toEqual([]);
  });
}

test("⭐ /ops — faqat superadmin; /activity-logs — superadmin va admin; menejer ikkalasida 403", async ({ browser }) => {
  const expected: Array<[Role, string, "open" | "forbidden"]> = [
    ["superadmin", "/ops", "open"],
    ["superadmin", "/activity-logs", "open"],
    ["admin", "/ops", "forbidden"],
    ["admin", "/activity-logs", "open"],
    ["manager", "/ops", "forbidden"],
    ["manager", "/activity-logs", "forbidden"],
  ];
  for (const [role, path, outcome] of expected) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await signIn(page, role);
    await page.goto(path);
    const content = page.locator("[data-shell-slot=content]");
    await expect(content, `${role} ${path}`).toBeVisible({ timeout: 90_000 });
    if (outcome === "forbidden") {
      await expect(page.getByRole("heading", FORBIDDEN), `${role} ${path}`).toBeVisible();
    } else {
      await expect(page.getByRole("heading", FORBIDDEN), `${role} ${path}`).toHaveCount(0);
      await expect(page.getByRole("heading", NOT_FOUND), `${role} ${path}`).toHaveCount(0);
      await expect(content.getByRole("heading", { level: 1 }), `${role} ${path}`).toBeVisible();
    }
    await context.close();
  }
});
