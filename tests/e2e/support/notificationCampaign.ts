import { expect, type Locator, type Page, type Route } from "@playwright/test";

/**
 * KM-2 — «Xabar yuborish» → «Auditoriya» (kampaniya) uchun API soxtasi (superadmin). Ruxsat etilgan yozishlar:
 * `POST notifications/audience/preview`, `POST|DELETE notifications/audience/segments`, `POST notifications/campaigns`,
 * `POST notifications/campaigns/:id/cancel`; boshqasi `leaked` ga tushadi. Worktree serveri — `E2E_ORIGIN`.
 */
export const ORIGIN = process.env.E2E_ORIGIN ?? "http://127.0.0.1:4173";

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
    last_counted_at: new Date().toISOString(),
  },
  {
    id: "4",
    name: "Uxlab qolgan mijozlar (iyuldan beri)",
    description: null,
    audience: { include_customers: true, segment: { last_order_to: "2026-07-01T00:00:00+05:00" } },
    last_total: 3420,
    last_counted_at: new Date(Date.now() - 86_400_000).toISOString(),
  },
];

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

export const mockCampaignApi = async (page: Page, options: { theme?: "light" | "dark" } = {}) => {
  const mock: CampaignMock = {
    leaked: [],
    previews: [],
    campaigns: [],
    previewOverride: null,
    createReplies: [],
    progressCalls: 0,
    cancelled: false,
  };
  let total = 0;
  let title = "";
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
            data: { id: "9", ...data, last_total: 236, last_counted_at: new Date().toISOString() },
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
      return reply(
        route,
        {
          statusCode: 202,
          data: {
            campaign_id: "7",
            status: "queued",
            total,
            scheduled_at: null,
            duplicate: false,
            quiet_hours_shifted: false,
          },
        },
        202,
      );
    }
    if (path === "notifications/campaigns/schedule-policy") {
      return reply(route, {
        statusCode: 200,
        data: {
          timezone: "Asia/Tashkent",
          promo_quiet_hours: { start: "18:00", end: "09:00", enabled: true },
          check: { shifted: false },
        },
      });
    }
    if (path === "notifications/campaigns/7" && method === "GET") {
      mock.progressCalls += 1;
      const sent = Math.min(total, Math.max(1, Math.round(total / 2)));
      return reply(route, {
        statusCode: 200,
        data: {
          id: "7",
          status: mock.cancelled ? "cancelled" : "running",
          display_status: mock.cancelled ? "cancelled" : "sending",
          title,
          category: "marketing",
          channels: ["in_app", "realtime", "push"],
          total,
          sent,
          failed: 0,
          skipped: mock.cancelled ? total - sent : 0,
          progress_pct: Math.round((sent / Math.max(1, total)) * 100),
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
