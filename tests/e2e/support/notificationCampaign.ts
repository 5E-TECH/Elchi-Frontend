import { expect, type Locator, type Page, type Route } from "@playwright/test";

/**
 * KM-2 — «Xabar yuborish» → «Auditoriya» (kampaniya) uchun API soxtasi (superadmin). Ruxsat etilgan yozishlar:
 * `POST notifications/audience/preview`, `POST|DELETE notifications/audience/segments`, `POST notifications/campaigns`,
 * `POST notifications/campaigns/:id/cancel`; boshqasi `leaked` ga tushadi. Worktree serveri — `E2E_ORIGIN`.
 */
export const ORIGIN = process.env.E2E_ORIGIN ?? "http://127.0.0.1:4194";

/**
 * Sahifa soati (`page.clock.install`, keyin tabiiy oqadi) va fiksturalar BITTA lahzadan — 2026-10-21 11:00 Toshkent.
 * Aks holda «Ertaga» / «Kecha» Node soati bo'yicha yasalib, brauzer soati bilan Toshkent yarim tunida (19:00 UTC)
 * ajralib qolardi; reklama tungi taqiqi ham CI qaysi soatda yurganiga bog'liq bo'lardi.
 */
export const E2E_NOW = Date.parse("2026-10-21T06:00:00Z");

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

/** Rol bo'yicha soxta sonlar (maket `-send-states`: Kuryer 212 · Menejer 20 · Admin 4). */
const STAFF: Record<string, number> = {
  admin: 4,
  manager: 20,
  registrator: 6,
  courier: 212,
  logist: 4,
};
const CUSTOMERS = 1186;
const MARKETS = 98;

const SEGMENTS = [
  {
    id: "3",
    name: "Toshkent — faol mijozlar (2–10 buyurtma)",
    description: null,
    audience: {
      roles: ["market", "manager", "logist"],
      include_customers: true,
      segment: { region_id: "1", district_id: "11", min_orders: 2, max_orders: 10 },
    },
    last_total: 1308,
    last_counted_at: new Date(E2E_NOW).toISOString(),
  },
  {
    id: "4",
    name: "Uxlab qolgan mijozlar (iyuldan beri)",
    description: null,
    audience: { include_customers: true, segment: { last_order_to: "2026-07-01T00:00:00+05:00" } },
    last_total: 3420,
    last_counted_at: new Date(E2E_NOW - 86_400_000).toISOString(),
  },
];

/** Toshkent kuni (`YYYY-MM-DD`) — «bugun» (`E2E_NOW`) dan `offset` kun. */
export const tashkentDay = (offset = 0) =>
  new Date(E2E_NOW + 5 * 3_600_000 + offset * 86_400_000).toISOString().slice(0, 10);
const at = (day: string, time: string) => `${day}T${time}:00+05:00`;

/**
 * KM-3 «Kampaniyalar tarixi» namunasi (maket `superadmin-notifications-send-schedule`): rejalashtirilgan · yuborilmoqda ·
 * rejalashtirilgan (tungi taqiq) · yuborilgan · bekor qilingan · xato. Vaqtlar bugungi kunga nisbatan.
 */
const historyRows = () => {
  const row = (fields: Record<string, unknown>) => ({
    type: "marketing.manual",
    priority: "normal",
    body: null,
    link: null,
    failed: 0,
    skipped: 0,
    paused_until: null,
    timezone: "Asia/Tashkent",
    ...fields,
  });
  return [
    row({
      id: "11",
      status: "queued",
      display_status: "scheduled",
      title: "Kuzgi chegirma: yetkazish 20% arzon",
      category: "marketing",
      channels: ["in_app", "push"],
      audience: { roles: ["market", "manager", "logist"], include_customers: true, segment: { region_id: "1" } },
      total: 1308,
      sent: 0,
      progress_pct: 0,
      created_at: new Date(E2E_NOW - 600_000).toISOString(),
      scheduled_at: at(tashkentDay(1), "10:00"),
      can_cancel: true,
      is_promo: true,
    }),
    row({
      id: "12",
      status: "running",
      display_status: "sending",
      title: "Yangi tariflar 1-noyabrdan",
      category: "system",
      channels: ["in_app", "realtime"],
      audience: { roles: ["market"] },
      total: 4860,
      sent: 2040,
      progress_pct: 42,
      created_at: new Date(E2E_NOW - 1_200_000).toISOString(),
      scheduled_at: null,
      can_cancel: true,
      is_promo: false,
    }),
    row({
      id: "13",
      status: "queued",
      display_status: "scheduled",
      title: "Hafta oxiri: 2 ta buyurtmaga 1 ta bepul",
      category: "marketing",
      channels: ["in_app", "push"],
      audience: { include_customers: true, segment: { min_orders: 3, max_orders: 10 } },
      total: 3420,
      sent: 0,
      progress_pct: 0,
      created_at: new Date(E2E_NOW - 3_600_000).toISOString(),
      scheduled_at: at(tashkentDay(1), "09:00"),
      can_cancel: true,
      is_promo: true,
    }),
    row({
      id: "14",
      status: "done",
      display_status: "sent",
      title: "Kuryerlar uchun yangi qoidalar",
      category: "system",
      channels: ["in_app", "realtime", "push"],
      audience: { roles: ["courier"] },
      total: 212,
      sent: 210,
      failed: 2,
      progress_pct: 100,
      created_at: at(tashkentDay(-1), "11:00"),
      scheduled_at: null,
      can_cancel: false,
      is_promo: false,
    }),
    row({
      id: "15",
      status: "cancelled",
      display_status: "cancelled",
      title: "Bayram kunlari ish tartibi",
      category: "system",
      channels: ["in_app"],
      audience: { roles: ["manager", "market"] },
      total: 1312,
      sent: 406,
      // Backend bekor qilishda qolganlarni `skipped` ga yozadi va `progress_pct` = 100 (chiziq esa 406 / 1 312 = 31%).
      skipped: 906,
      progress_pct: 100,
      created_at: "2026-10-06T09:00:00+05:00",
      scheduled_at: null,
      can_cancel: false,
      is_promo: false,
    }),
    row({
      id: "16",
      status: "failed",
      display_status: "failed",
      title: "Samarqand filiali yangi manzilda",
      category: "marketing",
      channels: ["in_app", "push"],
      audience: { include_customers: true, segment: { region_id: "2" } },
      total: 2980,
      sent: 1908,
      failed: 1072,
      progress_pct: 100,
      created_at: "2026-10-03T15:20:00+05:00",
      scheduled_at: null,
      can_cancel: false,
      is_promo: true,
    }),
  ];
};

/** «Kuryerlar uchun yangi qoidalar» hisoboti (maket `superadmin-notifications-campaign-report-dialog`). */
const REPORT_14 = {
  kind: "notification",
  campaign: {
    id: "14",
    title: "Kuryerlar uchun yangi qoidalar",
    category: "system",
    status: "done",
    display_status: "sent",
    channels: ["in_app", "realtime", "push"],
  },
  stats: { audience: 212, sent: 210, delivered: null, failed: 0, skipped: 0, pending: 0, undelivered: 72, unlisted_failed: 0 },
  dlr: { supported: false, received: null, awaiting: null, note: "raw backend note" },
  by_channel: [
    { channel: "in_app", sent: 212, failed: 0, skipped: 0, pending: 0, other: 0, statuses: { sent: 212 } },
    { channel: "realtime", sent: 212, failed: 0, skipped: 0, pending: 0, other: 0, statuses: { emitted: 212 } },
    {
      channel: "push",
      sent: 140,
      failed: 2,
      skipped: 70,
      pending: 0,
      other: 0,
      statuses: { sent: 140, failed: 2, no_subscription: 70 },
    },
  ],
  sms: null,
  cost: { currency: "UZS", estimated: 0, cost_of_sent: 0, is_estimate: true, paid_channels: [], note: "raw" },
  permissions: { can_export: true },
  export_sync_limit: 10000,
};

const UNDELIVERED_NAMES = ["Akmal Rasulov", "Dilshod Karimov", "Sardor Ahmedov", "Bekzod Yusupov", "Jasur Tursunov"];
const undeliveredPage = (page: number, limit: number) => {
  const total = 72;
  const from = (page - 1) * limit;
  const items = Array.from({ length: Math.max(0, Math.min(limit, total - from)) }, (_, index) => {
    const n = from + index;
    return {
      ref_id: String(9000 + n),
      recipient_id: String(300 + n),
      name: `${UNDELIVERED_NAMES[n % UNDELIVERED_NAMES.length]}${n >= UNDELIVERED_NAMES.length ? ` ${n}` : ""}`,
      role: "courier",
      phone: null,
      failures: [n < 2 ? { channel: "push", status: "failed", reason: "raw provider text" } : { channel: "push", status: "no_subscription", reason: null }],
    };
  });
  return { kind: "notification", campaign_id: "14", items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) }, unlisted_failed: 0 };
};

export type CampaignMock = {
  leaked: string[];
  previews: Array<Record<string, unknown>>;
  campaigns: Array<{ body: Record<string, unknown>; key: string | null }>;
  /** Preview javobini almashtirish (holatlar uchun): `null` — hisoblangan son. */
  previewOverride: { status: number; body: unknown } | null;
  createReplies: Array<{ status: number; body: unknown }>;
  /** `GET campaigns/7` chaqiruvlari soni (progress har chaqiruvda oshadi). */
  progressCalls: number;
  cancelled: boolean;
  /** KM-3: «Kampaniyalar tarixi» qatorlari (`history: true` bo'lsa — maketdagi 6 ta). */
  history: Array<Record<string, unknown>>;
  /** `GET notifications/campaigns` so'rovlari parametrlari. */
  listQueries: Array<Record<string, string>>;
  /** `POST …/:id/cancel` — qaysi id'lar. */
  cancels: string[];
  exports: number;
};

const previewBody = (body: Record<string, unknown>) => {
  const roles = Array.isArray(body.roles) ? (body.roles as string[]) : [];
  const byRole: Record<string, number> = {};
  if (body.include_customers) byRole.customer = CUSTOMERS;
  if (roles.includes("market")) byRole.market = MARKETS;
  for (const role of roles) if (STAFF[role]) byRole[role] = STAFF[role];
  const total = Object.values(byRole).reduce((sum, n) => sum + n, 0);
  return {
    statusCode: 200,
    data: {
      exact: true,
      total,
      by_role: byRole,
      by_channel: {
        in_app: total,
        realtime: total,
        push: Math.round(total * 0.24),
        sms: null,
        email: 0,
        telegram: null,
      },
      limits: { dispatch_max: 5000, campaign_max: 20000 },
      dispatch_allowed: total > 0 && total <= 5000,
      campaign_allowed: total > 0 && total <= 20000,
      warnings: [],
      ...(body.with_sample
        ? {
            sample: Array.from({ length: Math.min(20, total) }, (_, index) => ({
              id: String(48211 - index * 7),
              role: index % 6 === 4 ? "market" : index % 9 === 8 ? "manager" : "customer",
              phone: `***${String(7434 - index * 311)
                .padStart(4, "0")
                .slice(-4)}`,
            })),
          }
        : {}),
    },
  };
};

export const mockCampaignApi = async (
  page: Page,
  options: { theme?: "light" | "dark"; history?: boolean } = {},
) => {
  const mock: CampaignMock = {
    leaked: [],
    previews: [],
    campaigns: [],
    previewOverride: null,
    createReplies: [],
    progressCalls: 0,
    cancelled: false,
    history: options.history ? historyRows() : [],
    listQueries: [],
    cancels: [],
    exports: 0,
  };
  let total = 0;
  let title = "";
  let scheduledAt: string | null = null;
  await page.clock.install({ time: E2E_NOW });
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    const method = request.method();
    const body = () => JSON.parse(request.postData() ?? "{}") as Record<string, unknown>;

    if (path === "auth/my-profile") {
      return reply(route, {
        statusCode: 200,
        data: {
          id: "1",
          role: "superadmin",
          name: "Bosh admin",
          status: "active",
          settings: {
            appearance: { theme: options.theme ?? "light", themeChosen: true, language: "uz" },
          },
        },
      });
    }
    if (path === "notifications/audience/preview" && method === "POST") {
      const data = body();
      mock.previews.push(data);
      if (mock.previewOverride)
        return reply(route, mock.previewOverride.body, mock.previewOverride.status);
      return reply(route, previewBody(data));
    }
    if (path === "notifications/audience/segments") {
      if (method === "GET") return reply(route, { statusCode: 200, data: { items: SEGMENTS } });
      if (method === "POST") {
        const data = body();
        return reply(
          route,
          {
            statusCode: 201,
            data: { id: "9", ...data, last_total: 236, last_counted_at: new Date(E2E_NOW).toISOString() },
          },
          201,
        );
      }
    }
    if (/^notifications\/audience\/segments\/\d+$/.test(path) && method === "DELETE") {
      return reply(route, { statusCode: 200, data: { id: path.split("/").pop() } });
    }
    if (path === "notifications/campaigns" && method === "POST") {
      const data = body();
      mock.campaigns.push({ body: data, key: request.headers()["idempotency-key"] ?? null });
      const next = mock.createReplies.shift();
      if (next) return reply(route, next.body, next.status);
      total = Number(mock.previews.at(-1) ? previewBody(mock.previews.at(-1)!).data.total : 0);
      title = String(data.title ?? "");
      scheduledAt = typeof data.scheduled_at === "string" ? data.scheduled_at : null;
      return reply(
        route,
        {
          statusCode: 202,
          data: {
            campaign_id: "7",
            status: "queued",
            total,
            scheduled_at: scheduledAt,
            display_status: scheduledAt ? "scheduled" : "sending",
            requested_scheduled_at: scheduledAt,
            scheduled_at_tashkent: scheduledAt,
            timezone: "Asia/Tashkent",
            duplicate: false,
            quiet_hours_shifted: false,
          },
        },
        202,
      );
    }
    if (path === "notifications/campaigns" && method === "GET") {
      const params = Object.fromEntries(url.searchParams.entries());
      mock.listQueries.push(params);
      const limit = Number(params.limit ?? 20);
      const pageNo = Number(params.page ?? 1);
      const rows = mock.history.filter((row) => !params.state || row.display_status === params.state);
      return reply(route, {
        statusCode: 200,
        data: {
          items: rows.slice((pageNo - 1) * limit, pageNo * limit),
          meta: { page: pageNo, limit, total: rows.length, totalPages: Math.max(1, Math.ceil(rows.length / limit)) },
        },
      });
    }
    if (/^notifications\/campaigns\/1\d\/cancel$/.test(path) && method === "POST") {
      const id = path.split("/")[2];
      mock.cancels.push(id);
      const row = mock.history.find((item) => item.id === id);
      if (row) Object.assign(row, { status: "cancelled", display_status: "cancelled", can_cancel: false });
      return reply(route, { statusCode: 200, data: row ?? { id } });
    }
    if (/^notifications\/campaigns\/1\d\/report$/.test(path)) {
      return reply(route, { statusCode: 200, data: REPORT_14 });
    }
    if (/^notifications\/campaigns\/1\d\/undelivered$/.test(path)) {
      return reply(route, {
        statusCode: 200,
        data: undeliveredPage(Number(url.searchParams.get("page") ?? 1), Number(url.searchParams.get("limit") ?? 10)),
      });
    }
    if (/^notifications\/campaigns\/1\d\/undelivered\/export$/.test(path)) {
      mock.exports += 1;
      return route.fulfill({
        status: 200,
        contentType: "text/csv; charset=utf-8",
        // Backend `exposedHeaders` da `Content-Disposition` bor (api-gateway main.ts).
        headers: {
          ...cors,
          "access-control-expose-headers": "Content-Disposition",
          "content-disposition": 'attachment; filename="kampaniya-notification-14-yetkazilmaganlar.csv"',
        },
        body: "ism,rol,kanal,holat,sabab\nAkmal Rasulov,courier,push,failed,\n",
      });
    }
    if (path === "notifications/campaigns/schedule-policy") {
      const category = url.searchParams.get("category");
      return reply(route, {
        statusCode: 200,
        data: {
          timezone: "Asia/Tashkent",
          utc_offset: "+05:00",
          promo_quiet_hours: { start: "18:00", end: "09:00", enabled: true },
          promo_categories: ["marketing"],
          is_promo: category === "marketing",
          max_schedule_days: 90,
          check: { shifted: false },
        },
      });
    }
    if (path === "notifications/campaigns/7" && method === "GET") {
      mock.progressCalls += 1;
      const sent = scheduledAt ? 0 : Math.min(total, Math.max(1, Math.round(total / 2)));
      return reply(route, {
        statusCode: 200,
        data: {
          id: "7",
          status: mock.cancelled ? "cancelled" : scheduledAt ? "queued" : "running",
          display_status: mock.cancelled ? "cancelled" : scheduledAt ? "scheduled" : "sending",
          title,
          category: "marketing",
          channels: ["in_app", "realtime", "push"],
          total,
          sent,
          failed: 0,
          skipped: mock.cancelled ? total - sent : 0,
          progress_pct: Math.round((sent / Math.max(1, total)) * 100),
          scheduled_at: scheduledAt,
          scheduled_at_tashkent: scheduledAt,
          can_cancel: !mock.cancelled,
          is_promo: true,
        },
      });
    }
    if (path === "notifications/campaigns/7/cancel" && method === "POST") {
      mock.cancelled = true;
      return reply(route, {
        statusCode: 200,
        data: {
          id: "7",
          status: "cancelled",
          display_status: "cancelled",
          title,
          total,
          sent: Math.round(total / 2),
          can_cancel: false,
        },
      });
    }
    if (path === "region")
      return reply(route, {
        statusCode: 200,
        data: [
          { id: "1", name: "Toshkent sh." },
          { id: "2", name: "Samarqand" },
        ],
      });
    if (path === "district") {
      return reply(route, {
        statusCode: 200,
        data: [
          { id: "11", name: "Chilonzor tumani", region_id: "1" },
          { id: "12", name: "Yunusobod tumani", region_id: "1" },
        ],
      });
    }
    if (path === "markets")
      return reply(route, {
        statusCode: 200,
        data: { items: [{ id: "5", name: "Baraka Shop" }], meta: { total: 1 } },
      });
    if (method !== "GET") {
      mock.leaked.push(`${method} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    }
    return reply(route, { statusCode: 200, data: [] });
  });
  await page.addInitScript((theme) => {
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
    if (theme) {
      window.localStorage.setItem("theme", theme);
      window.localStorage.setItem("theme-version", "2");
    }
  }, options.theme ?? null);
  return mock;
};

/** Sahifani ochib «Auditoriya» rejimiga o'tadi; forma qaytadi. */
export const openAudience = async (page: Page) => {
  await page.goto("/notifications/send");
  const form = page.getByRole("form", { name: "Xabar yuborish formasi" });
  await expect(form).toBeVisible({ timeout: 60_000 });
  await form.getByRole("radio", { name: "Auditoriya" }).click();
  return form;
};

/**
 * Ixtiyoriy skrinshot (PR uchun): `KM2_SHOTS=<papka>` bo'lsa. Shell'da `<main>` aylanadi — butun sahifa ko'rinsin deb
 * oyna balandligi vaqtincha kontent balandligiga cho'ziladi; `element` — alohida bo'lak.
 */
export const shot = async (page: Page, name: string, element?: Locator) => {
  const dir = process.env.KM2_SHOTS;
  if (!dir) return;
  await page.waitForTimeout(450);
  const viewport = page.viewportSize();
  const height = await page.evaluate(() => {
    const main = document.querySelector("main");
    return Math.max(
      document.documentElement.scrollHeight,
      main ? main.scrollHeight + main.getBoundingClientRect().top + 120 : 0,
    );
  });
  if (viewport && height > viewport.height)
    await page.setViewportSize({ width: viewport.width, height: Math.min(height, 4000) });
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${dir}/${name}.png` });
  if (element) await element.screenshot({ path: `${dir}/${name}-part.png` });
  if (viewport) await page.setViewportSize(viewport);
};

/** Gorizontal skroll yo'q: hujjatda ham, shell'ning skroll qiluvchi `<main>` ida ham. */
export const noHorizontalScroll = async (page: Page) =>
  page.evaluate(() => {
    const main = document.querySelector("main");
    const mainOk = !main || main.scrollWidth <= main.clientWidth;
    return document.documentElement.scrollWidth <= window.innerWidth && mainOk;
  });
