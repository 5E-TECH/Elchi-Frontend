import { expect, test, type Route } from "@playwright/test";

/**
 * YEThmZBn — kuryer tafsiloti (`/all-users/:id`, v2): «Tahrirlash» oynasi joriy qiymatlar bilan ochiladi
 * (ism, telefon, tariflar); kuryer hududini bu oynada O'ZGARTIRIB BO'LMAYDI va so'rovda `region_id` yuborilmaydi —
 * u faqat «Boshqa filialga o'tkazish» orqali o'zgaradi (fix3 CODE-21). FY-1 (FY-S4, maket
 * `superadmin-users-edit-courier-district`): «Ish hududi» — viloyat faqat o'qish + o'tkazish izohi; DtKKY0V8: «Tuman»
 * — shu viloyat tumanlari (`GET region/:id`), faqat o'zgarsa `district_id`. Soxta backend, serverga so'rov ketmaydi.
 */
/** Dev server manzili (worktree probe'larida boshqa port — `E2E_ORIGIN`). */
const ORIGIN = process.env.E2E_ORIGIN ?? "http://127.0.0.1:4194";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown) =>
  route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(body) });

const COURIER = {
  id: "263",
  name: "Sherzod Alimov",
  phone_number: "+998901234567",
  username: "sherzod_k",
  role: "courier",
  status: "active",
  salary: 0,
  payment_day: null,
  region_id: "12",
  region: { id: "12", name: "Samarqand viloyati" },
  district_id: "41",
  tariff_home: 35000,
  tariff_center: 25000,
  default_tariff: "home",
  createdAt: "2026-09-29T09:00:00.000Z",
  updatedAt: "2026-10-05T09:00:00.000Z",
  is_deleted: false,
};

test.use({ viewport: { width: 1440, height: 900 } });
test.describe.configure({ timeout: 180_000 });

test("⭐ kuryer: «Tahrirlash» joriy qiymatlar bilan, «Ish hududi» — viloyat faqat o'qish, «Tuman» tanlovi; region_id yuborilmaydi", async ({ page }) => {
  const patches: Array<Record<string, unknown>> = [];
  await page.context().routeWebSocket(/\/socket\.io\//, (ws) => ws.close());
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") {
      return reply(route, { statusCode: 200, data: { id: "1", role: "superadmin", name: "E2E", status: "active" } });
    }
    if (path === "users/263" && request.method() === "PATCH") {
      patches.push(request.postDataJSON() as Record<string, unknown>);
      return reply(route, { statusCode: 200, data: { ...COURIER, ...(request.postDataJSON() as object) } });
    }
    if (path === "users/263") return reply(route, { statusCode: 200, data: COURIER });
    if (path === "region/12") {
      return reply(route, {
        statusCode: 200,
        data: {
          id: "12",
          name: "Samarqand viloyati",
          districts: [
            { id: 41, name: "Urgut tumani" },
            { id: 40, name: "Pastdarg'om tumani" },
          ],
        },
      });
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

  await page.goto("/all-users/263");
  const content = page.locator("[data-shell-slot=content]");
  await expect(content.getByRole("heading", { level: 1, name: "Sherzod Alimov" })).toBeVisible({ timeout: 90_000 });
  // Hudud o'zgarishining yagona yo'li — tafsilot sarlavhasida.
  await expect(content.getByRole("button", { name: "Boshqa filialga o'tkazish" })).toBeVisible();

  await content.getByRole("button", { name: "Tahrirlash" }).click();
  const dialog = page.getByRole("dialog", { name: "Foydalanuvchini tahrirlash" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Ism familiya")).toHaveValue("Sherzod Alimov");
  await expect(dialog.getByLabel("Telefon")).toHaveValue(/90 123 45 67$/);
  await expect(dialog.getByLabel("Uyga tarif")).toHaveValue(/^35\s?000$/);
  await expect(dialog.getByLabel("Markazga tarif")).toHaveValue(/^25\s?000$/);
  await expect(dialog.getByText("Kuryer tarifi")).toBeVisible();
  // «Ish hududi»: viloyat faqat o'qish, izohi — o'tkazish oynasi (unda tuman tozalanadi); viloyat tanlanmaydi.
  await expect(dialog.getByText("Ish hududi")).toBeVisible();
  const region = dialog.getByRole("textbox", { name: "Viloyat" });
  await expect(region).toHaveValue("Samarqand viloyati");
  await expect(region).toHaveAttribute("readonly", "");
  await expect(region).toHaveAccessibleDescription(
    "Filial «Boshqa filialga o'tkazish» orqali o'zgaradi — unda tuman tozalanadi",
  );
  await expect(dialog.getByRole("combobox", { name: /^(Hudud|Viloyat)$/ })).toHaveCount(0);
  // DtKKY0V8: «Tuman» — joriy qiymat, faqat shu viloyat tumanlari.
  const district = dialog.getByRole("combobox", { name: "Tuman" });
  await expect(district).toHaveValue("Urgut tumani");

  await dialog.getByLabel("Ism familiya").fill("Sherzod Alimov (kuryer)");
  await dialog.getByRole("button", { name: "O'zgarishlarni saqlash" }).click();
  await expect.poll(() => patches.length).toBe(1);
  // Faqat o'zgargan maydon yuboriladi; hudud — hech qachon (o'tkazish oynasining ishi), tegilmagan tuman ham yo'q.
  expect(patches[0]).toMatchObject({ name: "Sherzod Alimov (kuryer)" });
  expect(patches[0]).not.toHaveProperty("region_id");
  expect(patches[0]).not.toHaveProperty("district_id");
});

test("DtKKY0V8: kuryer tumanini almashtirish — `PATCH { district_id }`", async ({ page }) => {
  const patches: Array<Record<string, unknown>> = [];
  await page.context().routeWebSocket(/\/socket\.io\//, (ws) => ws.close());
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") {
      return reply(route, { statusCode: 200, data: { id: "1", role: "superadmin", name: "E2E", status: "active" } });
    }
    if (path === "users/263" && request.method() === "PATCH") {
      patches.push(request.postDataJSON() as Record<string, unknown>);
      return reply(route, { statusCode: 200, data: { ...COURIER, ...(request.postDataJSON() as object) } });
    }
    if (path === "users/263") return reply(route, { statusCode: 200, data: COURIER });
    if (path === "region/12") {
      return reply(route, {
        statusCode: 200,
        data: { id: "12", districts: [{ id: 41, name: "Urgut tumani" }, { id: 40, name: "Pastdarg'om tumani" }] },
      });
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

  await page.goto("/all-users/263");
  const content = page.locator("[data-shell-slot=content]");
  await expect(content.getByRole("heading", { level: 1, name: "Sherzod Alimov" })).toBeVisible({ timeout: 90_000 });
  await content.getByRole("button", { name: "Tahrirlash" }).click();
  const dialog = page.getByRole("dialog", { name: "Foydalanuvchini tahrirlash" });
  await dialog.getByRole("combobox", { name: "Tuman" }).click();
  await page.getByRole("option", { name: "Pastdarg'om tumani" }).click();
  await dialog.getByRole("button", { name: "O'zgarishlarni saqlash" }).click();
  await expect.poll(() => patches.length).toBe(1);
  expect(patches[0]).toEqual({ district_id: "40" });
});
