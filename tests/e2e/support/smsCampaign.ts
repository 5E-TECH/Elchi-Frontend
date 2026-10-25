import { expect, type Page, type Route } from "@playwright/test";

/**
 * KM-1 — SMS kampaniya «Mijozlar segmenti» uchun soxta backend: holat (kunlik limit 80 / 500, tungi taqiq
 * 18:00–09:00), tariflar, viloyat / tuman / market ro'yxatlari va `POST …/campaigns/preview` (jonli auditoriya).
 * Kampaniya YUBORILMAYDI: preview'dan boshqa yozish so'rovi `leaked` ga tushadi va 403 oladi.
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

/** 19:10 Toshkent vaqti — reklama tungi taqiqi ichida. */
export const EVENING_TASHKENT = new Date("2026-10-21T14:10:00Z");

const REGIONS = [
  { id: 1, name: "Toshkent sh." },
  { id: 2, name: "Samarqand viloyati" },
];
const DISTRICTS: Record<string, Array<{ id: number; name: string; region_id: number }>> = {
  "1": [
    { id: 12, name: "Chilonzor tumani", region_id: 1 },
    { id: 13, name: "Yunusobod tumani", region_id: 1 },
  ],
  "2": [{ id: 21, name: "Samarqand shahri", region_id: 2 }],
};
const MARKETS = [
  { id: 3, name: "Baraka Shop", phone_number: "+998901112233", status: "active" },
  { id: 4, name: "Nur Elektronika", phone_number: "+998901112244", status: "active" },
];
const HISTORY = [
  {
    id: "5",
    created_at: "2026-10-20T12:05:00.000Z",
    message_class: "promo",
    text: "Elchi: Samarqand va Buxoroga yetkazish endi 2 kunda. Batafsil: elchipochta.uz",
    total: 2480,
    queued: 2480,
    blocked: 127,
    skipped: 0,
    sent: 2391,
    delivered: 2391,
    failed: 89,
    pending: 0,
    estimated_cost: null,
  },
];

export type SmsCampaignMock = {
  /** Jonli auditoriya javobi (o'zgartirsa keyingi so'rovga ta'sir qiladi). */
  audience: { recipients: number; blocked_no_consent: number; skipped_invalid_phone: number };
  previews: Array<Record<string, unknown>>;
  leaked: string[];
};

export const mockSmsCampaignApi = async (page: Page): Promise<SmsCampaignMock> => {
  const mock: SmsCampaignMock = {
    audience: { recipients: 386, blocked_no_consent: 41, skipped_invalid_phone: 3 },
    previews: [],
    leaked: [],
  };
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
        data: { id: "1", role: "superadmin", name: "Bosh admin", status: "active" },
      });
    }
    if (path === "notifications/sms/campaigns/preview" && request.method() === "POST") {
      const body = request.postDataJSON() as Record<string, unknown>;
      mock.previews.push(body);
      const recipients = mock.audience.recipients;
      return reply(route, {
        statusCode: 200,
        data: {
          message_class: "promo",
          text: body.text,
          sample_text: `${String(body.text)}\nRad etish: https://api.elchipochta.uz/sms/stop/x`,
          encoding: "GSM-7",
          parts: 1,
          total: recipients + mock.audience.blocked_no_consent + mock.audience.skipped_invalid_phone,
          ...mock.audience,
          max_fanout: 5000,
          fanout_exceeded: false,
          tariff: 175,
          estimated_cost: recipients * 175,
          scheduled_for: "2026-10-22T04:00:00.000Z",
          sms_enabled: true,
        },
      });
    }
    if (request.method() !== "GET") {
      mock.leaked.push(`${request.method()} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    }
    if (path === "notifications/sms/tariffs")
      return reply(route, { statusCode: 200, data: { transactional: 95, promo: 175, security: 95 } });
    if (path === "notifications/sms/status") {
      return reply(route, {
        statusCode: 200,
        data: {
          enabled: true,
          used_today: 80,
          daily_cap: 500,
          max_fanout: 5000,
          quiet_hours: { start: 18 * 60, end: 9 * 60 },
          tariffs: { transactional: 95, promo: 175, security: 95 },
        },
      });
    }
    if (path === "notifications/sms/campaigns") return reply(route, { statusCode: 200, data: HISTORY });
    if (path === "region") return reply(route, { statusCode: 200, data: REGIONS });
    if (path === "district")
      return reply(route, { statusCode: 200, data: DISTRICTS[url.searchParams.get("region_id") ?? ""] ?? [] });
    if (path === "markets") return reply(route, { statusCode: 200, data: { items: MARKETS, total: MARKETS.length } });
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
  return mock;
};

/** `/notifications/sms` (Kampaniya) → «Mijozlar segmenti»; kampaniya paneli qaytadi. */
export const openSegmentCampaign = async (page: Page) => {
  await page.goto("/notifications/sms");
  const panel = page.getByRole("tabpanel");
  await expect(panel.getByTestId("sms-meter")).toBeVisible({ timeout: 60_000 });
  await panel.getByRole("radio", { name: "Mijozlar segmenti" }).click();
  await expect(panel.getByTestId("campaign-audience")).toBeVisible();
  return panel;
};

/** v2 `Select`: maydon → ro'yxat (`#ui-portal`) → variant. */
export const pick = async (page: Page, field: RegExp, option: string) => {
  await page.getByRole("combobox", { name: field }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
};

export const expectNoHorizontalOverflow = async (page: Page) => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(
    await page.locator("[data-shell-slot=content]").evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
};
