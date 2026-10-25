import { type Locator, type Page, type Route } from "@playwright/test";

/**
 * NS-2 — «Yuborilganlar» (`/notifications/sent`) uchun API soxtasi. Faqat GET; har yozish so'rovi `leaked` ga
 * tushadi. Worktree serverlari boshqa portda — `E2E_ORIGIN`.
 */
export const ORIGIN = process.env.E2E_ORIGIN ?? "http://127.0.0.1:4194";

const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

const SHODIYOR = { id: "1", name: "Shodiyor Ergashev", role: "superadmin" };
const NILUFAR = { id: "7", name: "Nilufar Rashidova", role: "admin" };

type Row = Record<string, unknown> & { dispatch_id: string; status: string; created_by: { id: string } };

const row = (index: number, overrides: Record<string, unknown>): Row => ({
  dispatch_id: `0b7f6f5e-3c1a-4c6e-9b1d-${String(index).padStart(12, "0")}`,
  status: "sent",
  type: "system.manual",
  category: "system",
  priority: "normal",
  title: `Xabar ${index}`,
  body_preview: "Qisqa matn",
  channels: ["in_app", "realtime", "telegram"],
  recipients: 10,
  dispatched: 10,
  skipped_by_preference: 0,
  by_channel: { in_app: 10, realtime: 10, telegram: 10 },
  channel_status: { in_app: { sent: 10 }, realtime: { emitted: 10 }, telegram: { sent: 10 } },
  no_provider: [],
  // Xom backend matni — sahifada ko'rinmasligi kerak.
  message: "Notification dispatched",
  created_by: SHODIYOR,
  created_at: daysAgo(index),
  finished_at: daysAgo(index),
  ...overrides,
});

/** Maket `superadmin-notifications-sent` qatorlari («Kimga» — NS-3 `audience`) + bitta odamga xabar + 2-sahifa uchun (jami 14). */
export const SENT_ROWS: Row[] = [
  row(1, {
    status: "running",
    title: "Marketlarga: yangi tariflar",
    body_preview: "1-noyabrdan Toshkent shahri ichida yetkazish 25 000 so'm bo'ladi.",
    recipients: 0,
    dispatched: 0,
    by_channel: {},
    channel_status: null,
    created_at: minutesAgo(3),
    finished_at: null,
    audience: { roles: ["market"] },
  }),
  row(2, {
    status: "partial",
    title: "Ertaga qabul punkti 10:00 dan ishlaydi",
    body_preview: "9-oktabr kuni Toshkent HQ qabul punkti 10:00 dan 19:00 gacha ishlaydi.",
    channels: ["in_app", "realtime", "telegram", "sms"],
    recipients: 148,
    dispatched: 148,
    channel_status: { in_app: { sent: 148 }, telegram: { queued: 131, skipped: 17 }, sms: { queued: 139, skipped: 9 } },
    message: "Partially dispatched",
    created_at: minutesAgo(8),
    audience: { roles: ["courier", "market"] },
  }),
  row(3, {
    title: "Kunni yakunlashni 19:00 gacha tugating",
    body_preview: "Bugun kassa 19:30 da yopiladi. Kechikkan kuryerlar ertaga topshiradi.",
    channels: ["in_app", "realtime", "push"],
    recipients: 62,
    dispatched: 62,
    created_by: NILUFAR,
    created_at: minutesAgo(30),
    audience: { roles: ["courier"] },
  }),
  row(4, {
    status: "inbox_only",
    title: "Bugun 23:00–23:30 tizimda texnik ishlar",
    body_preview: "Shu vaqt oralig'ida CRM ochilmaydi. Kunni yakunlashni 23:00 gacha tugating.",
    channels: ["in_app", "realtime", "sms"],
    recipients: 1312,
    dispatched: 1312,
    no_provider: ["sms"],
    channel_status: { in_app: { sent: 1312 }, sms: { no_provider: 1312 } },
    created_at: daysAgo(1),
    audience: { broadcast: true },
  }),
  row(5, {
    title: "Yangi kuryerlar uchun qo'llanma",
    recipients: 14,
    dispatched: 14,
    created_by: NILUFAR,
    audience: { recipient_ids: 14 },
  }),
  row(6, {
    status: "skipped",
    title: "Ombor inventarizatsiyasi shanba kuni",
    channels: ["in_app", "push"],
    recipients: 0,
    dispatched: 0,
    skipped_by_preference: 3,
    created_by: NILUFAR,
    audience: { roles: ["registrator"] },
  }),
  row(7, {
    status: "failed",
    title: "Kuryerlar yig'ilishi soat 9:00 da",
    body_preview: "Ertaga soat 9:00 da Toshkent HQ da umumiy yig'ilish bo'ladi.",
    recipients: 0,
    dispatched: 0,
    by_channel: {},
    channel_status: null,
    message: "connect ECONNREFUSED 10.0.0.3:5672",
    audience: { roles: ["courier"] },
  }),
  // NS-3 (NwlmrcMf): bitta qabul qiluvchi — ism · rol (uzun ism telefonda o'raladi).
  row(8, {
    title: "Shaxsiy eslatma",
    recipients: 1,
    dispatched: 1,
    audience: { recipient_ids: 1, recipient: { id: "41", name: "Abdurahmonov Muhammadali", role: "courier" } },
  }),
  ...Array.from({ length: 6 }, (_, index) => row(9 + index, { title: `Eski xabar ${9 + index}` })),
];

export const FAILED_ID = SENT_ROWS[6].dispatch_id;
export const PARTIAL_ID = SENT_ROWS[1].dispatch_id;

const detail = (source: Row) => ({
  statusCode: 200,
  data: {
    ...source,
    body: source.body_preview,
    link: null,
    audience: { roles: ["courier", "market"] },
    error: source.status === "failed" ? "connect ECONNREFUSED 10.0.0.3:5672" : null,
    channel_status:
      source.status === "partial"
        ? { in_app: { sent: 148 }, telegram: { sent: 125, failed: 6, skipped: 17 }, sms: { sent: 136, failed: 3, skipped: 9 } }
        : source.channel_status,
    undelivered: {
      items:
        source.status === "partial"
          ? [
              {
                notification_id: "901",
                recipient_id: "101",
                name: "Aziz Rahimov",
                role: "courier",
                failures: [{ channel: "telegram", status: "failed", reason: "bot_blocked" }],
              },
            ]
          : [],
      meta: { page: 1, limit: 10, total: source.status === "partial" ? 1 : 0, totalPages: 1 },
    },
  },
});

export type SentMock = {
  leaked: string[];
  /** Har `GET notifications/sent` so'rovining query'si. */
  listRequests: URLSearchParams[];
  /** `true` — ro'yxat 500 qaytaradi. */
  failList: boolean;
  /** Ro'yxat bo'sh. */
  emptyList: boolean;
};

export const mockSentApi = async (
  page: Page,
  options: { theme?: "light" | "dark"; role?: "superadmin" | "admin" | "manager"; language?: "uz" | "ru" | "en" } = {},
) => {
  const mock: SentMock = { leaked: [], listRequests: [], failList: false, emptyList: false };
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (request.method() !== "GET") {
      mock.leaked.push(`${request.method()} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    }
    if (path === "auth/my-profile") {
      const role = options.role ?? "superadmin";
      return reply(route, {
        statusCode: 200,
        data: {
          id: role === "admin" ? "7" : "1",
          role,
          name: role === "admin" ? "Nilufar Rashidova" : "Shodiyor Ergashev",
          status: "active",
          settings: { appearance: { theme: options.theme ?? "light", themeChosen: true, language: options.language ?? "uz" } },
        },
      });
    }
    if (path === "notifications/sent") {
      mock.listRequests.push(url.searchParams);
      if (mock.failList) return reply(route, { statusCode: 500, message: "relation \"notification_dispatches\" does not exist" }, 500);
      const status = url.searchParams.get("status");
      const author = url.searchParams.get("created_by");
      const pageNo = Number(url.searchParams.get("page") ?? 1);
      const limit = Number(url.searchParams.get("limit") ?? 20);
      const rows = mock.emptyList
        ? []
        : SENT_ROWS.filter((item) => (!status || item.status === status) && (!author || item.created_by.id === author));
      return reply(route, {
        statusCode: 200,
        message: "Dispatch history",
        data: {
          items: rows.slice((pageNo - 1) * limit, pageNo * limit),
          meta: { page: pageNo, limit, total: rows.length, totalPages: Math.max(1, Math.ceil(rows.length / limit)) },
        },
      });
    }
    const sent = /^notifications\/sent\/(.+)$/.exec(path);
    if (sent) {
      const source = SENT_ROWS.find((item) => item.dispatch_id === decodeURIComponent(sent[1]));
      return source ? reply(route, detail(source)) : reply(route, { statusCode: 404, message: "Dispatch topilmadi" }, 404);
    }
    if (path === "users") {
      const role = url.searchParams.get("role");
      const users = role === "superadmin" ? [{ ...SHODIYOR, username: "998901112233" }] : role === "admin" ? [{ ...NILUFAR, username: "998901112244" }] : [];
      return reply(route, { statusCode: 200, data: { items: users, meta: { page: 1, limit: 100, total: users.length } } });
    }
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
  }, options.theme ?? null);
  return mock;
};

/** Ixtiyoriy skrinshot (PR uchun): `NS2_SHOTS=<papka>` bo'lsa. */
export const shot = async (page: Page, name: string, element?: Locator) => {
  const dir = process.env.NS2_SHOTS;
  if (!dir) return;
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/${name}.png` });
  if (element) await element.screenshot({ path: `${dir}/${name}-part.png` });
};

/** Gorizontal skroll yo'q: hujjatda ham, shell'ning skroll qiluvchi `<main>` ida ham. */
export const noHorizontalScroll = async (page: Page) =>
  page.evaluate(() => {
    const main = document.querySelector("main");
    const mainOk = !main || main.scrollWidth <= main.clientWidth;
    return document.documentElement.scrollWidth <= window.innerWidth && mainOk;
  });

/** Jadvalning gorizontal skroll qiluvchisi (`DataTable` — `overflow-x-auto`) qancha px oshib ketgan (0 — sig'adi). */
export const tableOverflow = async (table: Locator) =>
  table.evaluate((element) => {
    const scroller = element.closest(".overflow-x-auto");
    return scroller ? scroller.scrollWidth - scroller.clientWidth : 0;
  });
