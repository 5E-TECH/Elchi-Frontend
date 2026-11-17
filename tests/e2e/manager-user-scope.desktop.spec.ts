import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * KQINMdeQ (ega, 2026-11-17) — menejer o'z filiali xodimlarini boshqaradi: huquq backend'da nishonning HOZIRGI filiali
 * bo'yicha (`created_by` emas), tafsilotda `can_manage`.
 *  - admin yaratgan kuryer (`created_by` = admin, `can_manage: true`) — «Tahrirlash», `PATCH /users/:id` ketadi;
 *  - boshqa filial foydalanuvchisi (IDOR) — `GET /users/:id` 403 → «Foydalanuvchini yuklab bo'lmadi»;
 *  - oyna ochiq turganda xodim boshqa filialga o'tkazilgan — saqlashda 403: xabar, tafsilot qayta so'raladi (403).
 * Soxta backend, serverga so'rov ketmaydi.
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

const FORBIDDEN = { statusCode: 403, message: "Siz bu foydalanuvchini boshqara olmaysiz" };

/** Admin yaratgan kuryer, menejer filialida (backend `can_manage: true`). */
const COURIER = {
  id: "101",
  name: "Sherzod Alimov",
  phone_number: "+998901234567",
  username: "sherzod_k",
  role: "courier",
  status: "active",
  salary: 0,
  payment_day: null,
  region_id: "12",
  region: { id: "12", name: "Samarqand viloyati" },
  district_id: null,
  tariff_home: 35000,
  tariff_center: 25000,
  default_tariff: "home",
  created_by: "1",
  branch_id: "b6",
  branch: { id: "b6", name: "Urgut filiali" },
  can_manage: true,
  createdAt: "2026-09-29T09:00:00.000Z",
  updatedAt: "2026-10-05T09:00:00.000Z",
  is_deleted: false,
};

type Backend = {
  patches: Array<Record<string, unknown>>;
  detailCalls: () => number;
};

/**
 * Soxta backend: menejer (Urgut filiali, REGIONAL). `users/101` — `detail()` javobi; `users/500` — doim 403
 * (boshqa filial); PATCH — `patch()` javobi.
 */
const mockBackend = async (
  page: Page,
  {
    detail = () => ({ status: 200, body: { statusCode: 200, data: COURIER } as unknown }),
    patch = (data: Record<string, unknown>) => ({
      status: 200,
      body: { statusCode: 200, data: { ...COURIER, ...data } } as unknown,
    }),
  }: {
    detail?: () => { status: number; body: unknown };
    patch?: (data: Record<string, unknown>) => { status: number; body: unknown };
  } = {},
): Promise<Backend> => {
  const patches: Array<Record<string, unknown>> = [];
  let detailCalls = 0;
  await page.context().routeWebSocket(/\/socket\.io\//, (ws) => ws.close());
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
          id: "25",
          role: "manager",
          name: "Ravshan Ortiqov",
          status: "active",
          branch_id: "b6",
          branch: { id: "b6", type: "REGIONAL", name: "Urgut filiali" },
        },
      });
    }
    if (path === "users/101" && request.method() === "PATCH") {
      const data = request.postDataJSON() as Record<string, unknown>;
      patches.push(data);
      const res = patch(data);
      return reply(route, res.body, res.status);
    }
    if (path === "users/101") {
      detailCalls += 1;
      const res = detail();
      return reply(route, res.body, res.status);
    }
    if (path === "users/500") return reply(route, FORBIDDEN, 403);
    if (path === "region/12") {
      return reply(route, { statusCode: 200, data: { id: "12", name: "Samarqand viloyati", districts: [] } });
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
  return { patches, detailCalls: () => detailCalls };
};

test.use({ viewport: { width: 1440, height: 900 } });
test.describe.configure({ timeout: 180_000 });

test("⭐ menejer admin yaratgan kuryerni tahrirlaydi — `PATCH /users/101` ketadi va saqlanadi", async ({ page }) => {
  const backend = await mockBackend(page);

  await page.goto("/all-users/101");
  const content = page.locator("[data-shell-slot=content]");
  await expect(content.getByRole("heading", { level: 1, name: "Sherzod Alimov" })).toBeVisible({ timeout: 90_000 });
  // Kuryerni o'tkazish — faqat superadmin/admin (o'zgarmagan).
  await expect(content.getByRole("button", { name: "Boshqa filialga o'tkazish" })).toHaveCount(0);

  await content.getByRole("button", { name: "Tahrirlash" }).click();
  const dialog = page.getByRole("dialog", { name: "Foydalanuvchini tahrirlash" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Ism familiya").fill("Sherzod Alimov Yangi");
  await dialog.getByRole("button", { name: "O'zgarishlarni saqlash" }).click();

  await expect.poll(() => backend.patches.length).toBe(1);
  expect(backend.patches[0]).toMatchObject({ name: "Sherzod Alimov Yangi" });
  await expect(dialog).toBeHidden();
  await expect(page.getByText('"Sherzod Alimov" muvaffaqiyatli yangilandi!', { exact: true })).toBeVisible();
});

test("⭐ boshqa filial foydalanuvchisi (IDOR) — 403, «Foydalanuvchini yuklab bo'lmadi»", async ({ page }) => {
  await mockBackend(page);

  await page.goto("/all-users/500");
  const content = page.locator("[data-shell-slot=content]");
  await expect(content.getByText("Foydalanuvchini yuklab bo'lmadi")).toBeVisible({ timeout: 90_000 });
  await expect(content.getByRole("button", { name: "Tahrirlash" })).toHaveCount(0);
});

test("oyna ochiq turganda xodim boshqa filialga o'tkazildi — saqlashda 403: xabar, oyna yopiladi, tafsilot qayta so'raladi", async ({
  page,
}) => {
  let moved = false;
  const backend = await mockBackend(page, {
    detail: () => (moved ? { status: 403, body: FORBIDDEN } : { status: 200, body: { statusCode: 200, data: COURIER } }),
    patch: () => {
      moved = true;
      return { status: 403, body: FORBIDDEN };
    },
  });

  await page.goto("/all-users/101");
  const content = page.locator("[data-shell-slot=content]");
  await expect(content.getByRole("heading", { level: 1, name: "Sherzod Alimov" })).toBeVisible({ timeout: 90_000 });
  const callsBefore = backend.detailCalls();

  await content.getByRole("button", { name: "Tahrirlash" }).click();
  const dialog = page.getByRole("dialog", { name: "Foydalanuvchini tahrirlash" });
  await dialog.getByLabel("Ism familiya").fill("Sherzod Alimov Yangi");
  await dialog.getByRole("button", { name: "O'zgarishlarni saqlash" }).click();

  await expect.poll(() => backend.patches.length).toBe(1);
  await expect(page.getByText("Siz bu foydalanuvchini boshqara olmaysiz", { exact: true })).toBeVisible();
  await expect(dialog).toBeHidden();
  await expect.poll(() => backend.detailCalls()).toBeGreaterThan(callsBefore);
  await expect(content.getByText("Foydalanuvchini yuklab bo'lmadi")).toBeVisible();
});
