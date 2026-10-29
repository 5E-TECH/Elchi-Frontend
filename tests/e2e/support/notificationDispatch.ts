import { expect, type Locator, type Page, type Route } from "@playwright/test";

/**
 * NS-1 — «Xabar yuborish» natijasi uchun API soxtasi (superadmin). Faqat `POST notifications/dispatch` (va «Hamma» soni —
 * `POST notifications/audience/preview`, KM-2) ruxsat;
 * boshqa yozish so'rovi `leaked` ga tushadi. Worktree serverlari boshqa portda — `E2E_ORIGIN`.
 */
export const ORIGIN = process.env.E2E_ORIGIN ?? "http://127.0.0.1:4173";

const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });

const NAMES = ["Baraka Shop", "Jasur Tursunov", "Dilnoza Karimova", "Nur Elektronika", "Ipak Yo'li Savdo"];

const undeliveredRow = (index: number) => ({
  notification_id: String(900 + index),
  recipient_id: String(100 + index),
  name: NAMES[index % NAMES.length] + (index >= NAMES.length ? ` ${index}` : ""),
  role: index % 2 ? "courier" : "market",
  failures:
    index === 1
      ? [
          { channel: "telegram", status: "skipped", reason: "no_telegram_id" },
          { channel: "sms", status: "skipped", reason: "no_phone" },
        ]
      : index === 3
        ? [{ channel: "telegram", status: "failed", reason: "Forbidden: bot was blocked by the user" }]
        : [{ channel: "telegram", status: "skipped", reason: "no_telegram_id" }],
});

export const PARTIAL_DISPATCH = {
  // NS-4: backend javobida holat va kanal natijasi (tarixdagi bilan AYNI).
  status: "partial",
  channel_outcome: { realtime: "full", telegram: "partial", sms: "none" },
  dispatched: 148,
  recipient_ids: [],
  channels: ["in_app", "realtime", "telegram", "sms"],
  by_channel: { in_app: 148, realtime: 148, telegram: 131, sms: 0 },
  no_provider: [],
  skipped_by_preference: 0,
  channel_status: {
    in_app: { sent: 148 },
    realtime: { emitted: 148 },
    telegram: { queued: 131, skipped: 17 },
    sms: { queued: 139, skipped: 9 },
  },
};

const detail = (id: string, page: number, limit: number) => ({
  statusCode: 200,
  data: {
    dispatch_id: id,
    status: "partial",
    type: "system.manual",
    category: "branch",
    priority: "high",
    title: "Ertaga qabul punkti 10:00 dan ishlaydi",
    body: "9-oktabr kuni Toshkent HQ qabul punkti 10:00 dan 19:00 gacha ishlaydi. Buyurtmalarni topshirish vaqtini shunga moslang.",
    link: null,
    channels: ["in_app", "realtime", "telegram", "sms"],
    recipients: 148,
    dispatched: 148,
    skipped_by_preference: 0,
    by_channel: PARTIAL_DISPATCH.by_channel,
    channel_status: {
      in_app: { sent: 148 },
      realtime: { emitted: 148 },
      telegram: { sent: 125, failed: 6, skipped: 17 },
      sms: { sent: 136, failed: 3, skipped: 9 },
    },
    no_provider: [],
    audience: { roles: ["courier", "market"] },
    error: null,
    created_by: { id: "1", name: "Bosh admin", role: "superadmin" },
    created_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
    undelivered: {
      items: Array.from({ length: Math.min(limit, 25 - (page - 1) * limit) }, (_, index) =>
        undeliveredRow((page - 1) * limit + index),
      ),
      meta: { page, limit, total: 25, totalPages: Math.ceil(25 / limit) },
    },
  },
});

export type DispatchMock = {
  leaked: string[];
  /** Har `POST notifications/dispatch` tanasi. */
  posts: Array<Record<string, unknown>>;
  /** Navbatdagi POST javoblari (oxirgisi qolgan barcha so'rovlarga). */
  dispatchReplies: Array<{ status: number; body: unknown }>;
  /** Tarixda bor id'lar (yo'g'i — 404). `null` — har qanday id bor. */
  knownIds: Set<string> | null;
};

export const mockDispatchApi = async (page: Page, options: { theme?: "light" | "dark" } = {}) => {
  const mock: DispatchMock = {
    leaked: [],
    posts: [],
    dispatchReplies: [{ status: 201, body: { statusCode: 201, data: PARTIAL_DISPATCH } }],
    knownIds: null,
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
        data: {
          id: "1",
          role: "superadmin",
          name: "Bosh admin",
          status: "active",
          settings: { appearance: { theme: options.theme ?? "light", themeChosen: true, language: "uz" } },
        },
      });
    }
    // «Hamma» soni (KM-2): backend preview — hech narsa yubormaydi.
    if (path === "notifications/audience/preview" && request.method() === "POST") {
      return reply(route, {
        statusCode: 200,
        data: {
          exact: true,
          total: 148,
          by_role: { courier: 100, market: 48 },
          by_channel: { in_app: 148, realtime: 148, push: 0 },
          limits: { dispatch_max: 5000, campaign_max: 20000 },
          campaign_allowed: true,
        },
      });
    }
    if (path === "notifications/dispatch" && request.method() === "POST") {
      mock.posts.push(JSON.parse(request.postData() ?? "{}"));
      const next = mock.dispatchReplies.length > 1 ? mock.dispatchReplies.shift()! : mock.dispatchReplies[0];
      return reply(route, next.body, next.status);
    }
    const sent = /^notifications\/sent\/(.+)$/.exec(path);
    if (sent && request.method() === "GET") {
      const id = decodeURIComponent(sent[1]);
      if (mock.knownIds && !mock.knownIds.has(id)) return reply(route, { statusCode: 404, message: "Dispatch topilmadi" }, 404);
      const pageNo = Number(url.searchParams.get("page") ?? 1);
      const limit = Number(url.searchParams.get("limit") ?? 10);
      return reply(route, detail(id, pageNo, limit));
    }
    if (request.method() !== "GET") {
      mock.leaked.push(`${request.method()} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
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

/** «Hamma» + Telegram + SMS, sarlavha → «Yuborish» → tasdiq oynasida «Ha, yuborish». */
export const sendToEveryone = async (page: Page) => {
  await page.goto("/notifications/send");
  const form = page.getByRole("form", { name: "Xabar yuborish formasi" });
  await expect(form).toBeVisible({ timeout: 60_000 });
  await form.getByRole("radio", { name: "Hamma" }).click();
  await form.getByRole("checkbox", { name: "Telegram" }).check();
  await form.getByRole("checkbox", { name: "SMS" }).check();
  await form.getByRole("textbox", { name: "Sarlavha" }).fill("Ertaga qabul punkti 10:00 dan ishlaydi");
  await form.getByRole("button", { name: /^Yuborish/ }).click();
  const confirm = page.getByRole("alertdialog", { name: "Xabarni yuborishni tasdiqlang" });
  await confirm.getByRole("button", { name: /Ha, yuborish/ }).click();
  await expect(confirm).toBeHidden();
};

/** Ixtiyoriy skrinshot (PR uchun): `NS1_SHOTS=<papka>` bo'lsa. */
export const shot = async (page: Page, name: string, element?: Locator) => {
  const dir = process.env.NS1_SHOTS;
  if (!dir) return;
  // Oyna ochilish harakati tugasin (yarim shaffof kadr bo'lmasin).
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/${name}.png` });
  // Shell'da `<main>` aylanadi — butun karta alohida rasmda.
  if (element) await element.screenshot({ path: `${dir}/${name}-card.png` });
};

/** Gorizontal skroll yo'q: hujjatda ham, shell'ning skroll qiluvchi `<main>` ida ham. */
export const noHorizontalScroll = async (page: Page) =>
  page.evaluate(() => {
    const main = document.querySelector("main");
    const mainOk = !main || main.scrollWidth <= main.clientWidth;
    return document.documentElement.scrollWidth <= window.innerWidth && mainOk;
  });
