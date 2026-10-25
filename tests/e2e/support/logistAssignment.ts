import { expect, type Page, type Route } from "@playwright/test";

/**
 * «Logist biriktirish» va «Logist» yaratish e2e (LG-2, superadmin) uchun soxta backend: `GET /logists`,
 * `GET /region` (`logist_id` bilan), `POST /region/logist/bulk` (holatni o'zgartiradi), `POST /logists`.
 * Hech qanday so'rov serverga ketmaydi; kutilmagan yozuvchi so'rov `leaked` ga tushadi.
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
  route.fulfill({
    status,
    contentType: "application/json",
    headers: cors,
    body: JSON.stringify(body),
  });

type LogistRow = {
  id: string;
  name: string;
  phone_number: string;
  status: "active" | "inactive";
  role: "logist";
};

/** Maketdagi to'rt logist (Malika — nofaol). */
export const LOGISTS: LogistRow[] = [
  {
    id: "41",
    name: "Aziz Rahimov",
    phone_number: "+998901234567",
    status: "active",
    role: "logist",
  },
  {
    id: "42",
    name: "Dilnoza Karimova",
    phone_number: "+998912345678",
    status: "active",
    role: "logist",
  },
  {
    id: "43",
    name: "Sherzod Nazarov",
    phone_number: "+998933456789",
    status: "active",
    role: "logist",
  },
  {
    id: "44",
    name: "Malika Yusupova",
    phone_number: "+998944567890",
    status: "inactive",
    role: "logist",
  },
];

/** 14 viloyat: Aziz — Navoiy, Qashqadaryo, Samarqand, Surxondaryo; Dilnoza — Toshkent vil., Jizzax, Sirdaryo. */
const initialRegions = () => [
  { id: "1", name: "Toshkent shahri", logist_id: null as string | null },
  { id: "2", name: "Toshkent viloyati", logist_id: "42" },
  { id: "3", name: "Andijon viloyati", logist_id: null },
  { id: "4", name: "Buxoro viloyati", logist_id: null },
  { id: "5", name: "Farg'ona viloyati", logist_id: null },
  { id: "6", name: "Jizzax viloyati", logist_id: "42" },
  { id: "7", name: "Namangan viloyati", logist_id: null },
  { id: "8", name: "Navoiy viloyati", logist_id: "41" },
  { id: "9", name: "Qashqadaryo viloyati", logist_id: "41" },
  { id: "10", name: "Qoraqalpog'iston Respublikasi", logist_id: null },
  { id: "11", name: "Samarqand viloyati", logist_id: "41" },
  { id: "12", name: "Sirdaryo viloyati", logist_id: "42" },
  { id: "13", name: "Surxondaryo viloyati", logist_id: "41" },
  { id: "14", name: "Xorazm viloyati", logist_id: null },
];

export type BulkBody = { logist_id: string; region_ids: string[] };

export const mockLogistApi = async (
  page: Page,
  {
    theme = "light",
    logists = LOGISTS,
    bulkStatus = 200,
  }: { theme?: "light" | "dark"; logists?: LogistRow[]; bulkStatus?: number } = {},
) => {
  const leaked: string[] = [];
  const bulks: BulkBody[] = [];
  const creates: unknown[] = [];
  const rows = [...logists];
  const regions = initialRegions();
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
          id: "1",
          role: "superadmin",
          name: "E2E Superadmin",
          status: "active",
          settings: { appearance: { theme, themeChosen: true } },
        },
      });
    }
    if (path === "logists" && request.method() === "GET") {
      return reply(route, {
        statusCode: 200,
        data: { items: rows, meta: { page: 1, limit: 100, total: rows.length } },
      });
    }
    if (path === "logists" && request.method() === "POST") {
      const body = request.postDataJSON() as { name: string; phone_number: string };
      creates.push(body);
      const created: LogistRow = {
        id: "57",
        name: body.name,
        phone_number: body.phone_number,
        status: "active",
        role: "logist",
      };
      rows.push(created);
      return reply(route, { statusCode: 201, message: "Logist yaratildi", data: created }, 201);
    }
    if (path === "region" && request.method() === "GET") {
      return reply(route, { statusCode: 200, data: regions });
    }
    if (path === "region/logist/bulk" && request.method() === "POST") {
      const body = request.postDataJSON() as BulkBody;
      bulks.push(body);
      if (bulkStatus >= 400) {
        return reply(
          route,
          { statusCode: bulkStatus, message: "Logist faol emas (bloklangan)", data: null },
          bulkStatus,
        );
      }
      for (const region of regions) {
        if (body.region_ids.includes(region.id)) region.logist_id = body.logist_id;
        else if (region.logist_id === body.logist_id) region.logist_id = null;
      }
      return reply(route, {
        statusCode: 200,
        data: { logist_id: body.logist_id, region_ids: body.region_ids },
      });
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
      JSON.stringify({
        accessTokenExpiresAt: far,
        refreshTokenExpiresAt: far,
        refreshTokenWarnAt: far,
      }),
    );
  });
  return { leaked, bulks, creates };
};

export const openLogistAssignment = async (page: Page, search = "") => {
  await page.goto(`/regions/logist-assignment${search}`);
  await expect(page.getByRole("heading", { name: "Logist biriktirish", level: 1 })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByRole("heading", { name: /viloyatlari$/, level: 2 })).toBeVisible();
};

/** Viloyatlar kartasi (sarlavhasi «… viloyatlari»). */
export const regionsCard = (page: Page) => page.getByRole("region", { name: /viloyatlari$/ });

export const expectNoHorizontalOverflow = async (page: Page) => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(
    await page
      .locator("[data-shell-slot=content]")
      .evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
};
