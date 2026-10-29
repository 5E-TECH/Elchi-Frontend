import { expect, type Page, type Route } from "@playwright/test";
import { noHorizontalScroll, shot } from "./notificationCampaign";

/**
 * H7kpCman — SMS kampaniya hisoboti (`/notifications/sms` → «Kampaniyalar tarixi» → «Hisobot»; maket
 * `superadmin-notifications-campaign-report-dialog`, SMS bloki — eng yaqini `superadmin-notifications-sms-report`):
 * 6 ta StatCard (390px da 2 ustun), SMS bloki — bo'laklar va kodlash, operator hisoboti kelmagan — «—» (0 emas), narx
 * «taxminiy»; «Yetkazilmaganlar» — maskalangan telefon va sabab. Kunduzgi va tungi, 390px va 1440px; gorizontal
 * skroll yo'q. Skrinshotlar — `KM2_SHOTS=<papka>` bo'lsa. Yozish so'rovi yuborilmaydi (`leaked`).
 */
const ORIGIN = process.env.E2E_ORIGIN ?? "http://127.0.0.1:4173";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });

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
    delivered: 0,
    failed: 89,
    pending: 0,
    estimated_cost: "434000",
  },
];

const REPORT = {
  kind: "sms",
  campaign: { id: "5", title: null, text: HISTORY[0].text, channels: ["sms"], created_at: HISTORY[0].created_at },
  stats: { audience: 2480, sent: 2391, delivered: null, failed: 89, skipped: 127, pending: 0, undelivered: 89 },
  dlr: { supported: true, received: 0, awaiting: 2391, note: "raw dlr note" },
  by_channel: [{ channel: "sms", sent: 2391, failed: 89, skipped: 127, pending: 0, other: 0, statuses: { sent: 2391, failed: 89 } }],
  sms: {
    messages: 2480,
    parts_total: 4960,
    parts_per_message: { min: 2, max: 2 },
    encoding: "GSM-7",
    encoding_breakdown: { "GSM-7": 2480, "UCS-2": 0 },
    source: "sms_outbox",
    dlr: { final: 0, delivered: 0, failed: 0, awaiting: 2391 },
    tariff_per_part: 175,
    cost_of_sent: 836850,
  },
  cost: { currency: "UZS", estimated: 868000, cost_of_sent: 836850, is_estimate: true, paid_channels: ["sms"], note: "raw" },
  permissions: { can_export: true },
  export_sync_limit: 10000,
};

const UNDELIVERED = {
  kind: "sms",
  items: [
    {
      ref_id: "900",
      recipient_id: "301",
      name: "Dilnoza Karimova",
      role: "customer",
      phone: "***4411",
      failures: [{ channel: "sms", status: "rejected", reason: "raw provider text", reason_code: null }],
    },
    {
      ref_id: "901",
      recipient_id: null,
      name: null,
      role: null,
      phone: "***0912",
      failures: [{ channel: "sms", status: "failed", reason: "raw provider text", reason_code: null }],
    },
  ],
  meta: { page: 1, limit: 10, total: 2, totalPages: 1 },
  unlisted_failed: 0,
};

export const mockSmsReportApi = async (page: Page, theme: "light" | "dark") => {
  const mock = { leaked: [] as string[], reports: 0 };
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
          name: "Bosh admin",
          status: "active",
          settings: { appearance: { theme, themeChosen: true, language: "uz" } },
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
        data: { enabled: true, used_today: 80, daily_cap: 500, max_fanout: 5000, quiet_hours: { start: 1080, end: 540 } },
      });
    }
    if (path === "notifications/sms/campaigns") return reply(route, { statusCode: 200, data: HISTORY });
    if (path === "notifications/sms/campaigns/5/report") {
      mock.reports += 1;
      return reply(route, { statusCode: 200, data: REPORT });
    }
    if (path === "notifications/sms/campaigns/5/undelivered") return reply(route, { statusCode: 200, data: UNDELIVERED });
    return reply(route, { statusCode: 200, data: [] });
  });
  await page.addInitScript((value) => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
    window.localStorage.setItem("theme", value);
    window.localStorage.setItem("theme-version", "2");
  }, theme);
  return mock;
};

/** `/notifications/sms` → «Hisobot» → tekshiruvlar (kenglik va mavzu bo'yicha) va skrinshot. */
export const checkSmsReport = async (page: Page, width: 390 | 1440, theme: "light" | "dark") => {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
  const mock = await mockSmsReportApi(page, theme);
  await page.goto("/notifications/sms");
  const button = page.getByRole("button", { name: /^SMS kampaniya hisoboti — / });
  await expect(button).toBeVisible({ timeout: 60_000 });
  if (width === 390) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await button.click();

  const dialog = page.getByRole("dialog", { name: "Kampaniya hisoboti" });
  const stats = dialog.getByTestId("campaign-report-stats");
  await expect(stats).toContainText("Yetkazildi—operator hisoboti hali kelmagan");
  await expect(stats).toContainText("taxminiy · faktik summa — provayder hisobidan");
  // 390px: kataklar 2 ustun (1440px — 3 ustun).
  const boxes = await Promise.all([0, 1, 2].map((index) => stats.locator(":scope > *").nth(index).boundingBox()));
  expect(Math.round(boxes[0]!.y)).toBe(Math.round(boxes[1]!.y));
  if (width === 390) expect(boxes[2]!.y).toBeGreaterThan(boxes[0]!.y + 10);
  else expect(Math.round(boxes[2]!.y)).toBe(Math.round(boxes[0]!.y));

  const sms = dialog.getByTestId("campaign-report-sms");
  await expect(sms).toContainText("4 960 ta · 1 xabar = 2 bo'lak");
  await expect(sms).toContainText("GSM-7");
  await expect(sms).toContainText("Hali kelmagan · kutilmoqda 2 391 ta");
  await expect(dialog).toContainText("***4411");
  await expect(dialog).toContainText("Operator rad etdi");
  await expect(dialog).not.toContainText("raw");
  await expect(dialog.getByRole("button", { name: "CSV yuklab olish" })).toBeVisible();
  if (width === 390) {
    // Telefonda — pastki varaqa, kanal jadvali o'rniga ro'yxat.
    const box = (await dialog.boundingBox())!;
    expect(Math.round(box.y + box.height)).toBeGreaterThanOrEqual(844 - 2);
    await expect(dialog.getByRole("table")).toBeHidden();
  }
  expect(await noHorizontalScroll(page)).toBe(true);
  expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  await shot(page, `sms-report-${width}-${theme}`);
  expect(mock.reports).toBeGreaterThan(0);
  expect(mock.leaked).toEqual([]);
};
