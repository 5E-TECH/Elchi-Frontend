import { expect, type Page, type Route } from "@playwright/test";

/**
 * FY-2 — xodim tafsiloti (`/all-users/41`) va «Tahrirlash» oynasidagi «Rol» (maketlar `superadmin-users-edit-role`,
 * `superadmin-users-role-confirm-dialog`, `superadmin-users-role-confirm-logist`, `superadmin-users-edit-role-error`).
 * Soxta backend: superadmin; `PATCH users/41/role` javoblari `roleStatuses` navbatidan (sukut 200), tanalari
 * yig'iladi; `GET roles` → `changeable_roles`; `GET region` → logist viloyatlari. Serverga so'rov ketmaydi.
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

export const STAFF = {
  id: "41",
  name: "Nilufar Rashidova",
  phone_number: "+998908112649",
  username: "nilufar_r",
  role: "admin",
  status: "active",
  salary: 6000000,
  payment_day: 5,
  createdAt: "2026-09-03T09:00:00.000Z",
  updatedAt: "2026-10-05T09:00:00.000Z",
  is_deleted: false,
};

export type StaffDetailOptions = {
  user?: Partial<typeof STAFF>;
  /** `PATCH users/41/role` javob kodlari ketma-ket (tugasa — 200). */
  roleStatuses?: number[];
  /** `PATCH users/41` javob kodlari ketma-ket (tugasa — 200). */
  userStatuses?: number[];
  /** `GET region` qatorlari (`logist_id`). */
  regions?: Array<{ id: number; name: string; logist_id: number | string | null }>;
  /** `localStorage` mavzusi. */
  theme?: "light" | "dark";
};

export const openStaffDetail = async (page: Page, options: StaffDetailOptions = {}) => {
  const rolePatches: Array<Record<string, unknown>> = [];
  const userPatches: Array<Record<string, unknown>> = [];
  const roleStatuses = [...(options.roleStatuses ?? [])];
  const userStatuses = [...(options.userStatuses ?? [])];
  let staff: Record<string, unknown> = { ...STAFF, ...options.user };

  await page.context().routeWebSocket(/\/socket\.io\//, (ws) => ws.close());
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") {
      const settings = options.theme ? { appearance: { theme: options.theme, themeChosen: true } } : undefined;
      return reply(route, {
        statusCode: 200,
        data: { id: "1", role: "superadmin", name: "E2E", status: "active", settings },
      });
    }
    if (path === "roles") {
      return reply(route, {
        statusCode: 200,
        data: { items: [], changeable_roles: ["admin", "registrator", "manager", "logist"] },
      });
    }
    if (path === "region") return reply(route, { statusCode: 200, data: options.regions ?? [] });
    if (path === "users/41/role" && request.method() === "PATCH") {
      const body = request.postDataJSON() as Record<string, unknown>;
      rolePatches.push(body);
      const status = roleStatuses.shift() ?? 200;
      if (status !== 200) {
        // Backend matnida texnik yo'l bor — UI uni ko'rsatmasligi kerak.
        return reply(
          route,
          { statusCode: status, message: "Foydalanuvchi 'Yunusobod' filialiga biriktirilgan — DELETE /branches/7/users/41" },
          status,
        );
      }
      staff = { ...staff, role: body.role };
      return reply(route, { statusCode: 200, data: staff });
    }
    if (path === "users/41" && request.method() === "PATCH") {
      const body = request.postDataJSON() as Record<string, unknown>;
      userPatches.push(body);
      const status = userStatuses.shift() ?? 200;
      if (status !== 200) return reply(route, { statusCode: status, message: "Internal server error" }, status);
      staff = { ...staff, ...body };
      return reply(route, { statusCode: 200, data: staff });
    }
    if (path === "users/41") return reply(route, { statusCode: 200, data: staff });
    return reply(route, { statusCode: 200, data: [] });
  });
  await page.addInitScript((theme) => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
    if (theme) {
      window.localStorage.setItem("theme", theme);
      window.localStorage.setItem("theme-version", "2");
    }
  }, options.theme);
  await page.goto("/all-users/41");
  const content = page.locator("[data-shell-slot=content]");
  const name = String(staff.name);
  await expect(content.getByRole("heading", { level: 1, name })).toBeVisible({ timeout: 90_000 });
  return { content, rolePatches, userPatches };
};

/** «Tahrirlash» → oyna; «Rol» ro'yxatidan rol tanlash. */
export const openEditDialog = async (page: Page) => {
  await page.locator("[data-shell-slot=content]").getByRole("button", { name: "Tahrirlash" }).click();
  const dialog = page.getByRole("dialog", { name: "Foydalanuvchini tahrirlash" });
  await expect(dialog).toBeVisible();
  return dialog;
};

export const pickRole = async (page: Page, label: string) => {
  const dialog = page.getByRole("dialog", { name: "Foydalanuvchini tahrirlash" });
  await dialog.getByRole("combobox", { name: "Rol" }).click();
  await page.getByRole("option", { name: new RegExp(`^${label}`) }).click();
};
