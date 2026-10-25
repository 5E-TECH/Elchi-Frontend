import { expect, type Page, type Route } from "@playwright/test";

/**
 * «Biriktirish» (`/dispatch`) va «Tezkor amal» (`/courier-bulk`) — soxta backend (dizayn v2, G3).
 *
 * `/dispatch` — HQ registratori: `GET couriers?page=1&limit=100&status=active` (filialga cheklangan rol,
 * `region_id` siz), `GET orders/qr-code/:token` (USB skaner → buyurtma), `POST orders/assign-to-courier
 * { courier_id, order_ids }`.
 * `/courier-bulk` — kuryer: `GET orders/courier/orders?status=waiting` (100 talik sahifalar), «Kunni yakunlash» →
 * `POST orders/sell/:id` / `POST orders/cancel/:id` (`{ comment, extraCost: 0 }`; isbotli — avval `POST files/upload`,
 * keyin `proofFileKeys`; har biri `X-Request-Source: courier-bulk`); «Ertaga» so'rov yubormaydi.
 * Boshqa yozish so'rovi — `leaked` (403).
 */
// Worktree serverlari boshqa portda — `E2E_ORIGIN`.
const ORIGIN = process.env.E2E_ORIGIN ?? "http://127.0.0.1:4194";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });

type Body = Record<string, unknown>;

const order = (id: string, name: string, over: Record<string, unknown> = {}) => ({
  id,
  qr_code_token: `tok-${id}`,
  createdAt: "2026-10-17T08:00:00.000Z",
  created_at: "2026-10-17T08:00:00.000Z",
  status: "received",
  total_price: 185000,
  to_be_paid: 185000,
  where_deliver: "address",
  product_quantity: 1,
  market: { name: "Baraka Shop" },
  customer: { name, phone_number: "+998907421836" },
  district: { name: "Chilonzor tumani", region: { name: "Toshkent sh." } },
  region: { name: "Toshkent sh." },
  items: [],
  ...over,
});

/** Kirish holati: token, uzoq sessiya (banner chiqmaydi), mavzu. */
const signIn = (page: Page) =>
  page.addInitScript(() => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
    window.localStorage.setItem("theme", "light");
    window.localStorage.setItem("theme-version", "2");
  });

type Handler = (route: Route, path: string, method: string, url: URL) => Promise<void | false> | void | false;

const routeApi = async (page: Page, profile: Body, handle: Handler) => {
  const leaked: string[] = [];
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") return reply(route, { statusCode: 200, data: profile });
    const handled = await handle(route, path, request.method(), url);
    if (handled !== false) return;
    if (request.method() !== "GET") {
      leaked.push(`${request.method()} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    }
    return reply(route, { statusCode: 200, data: [] });
  });
  await signIn(page);
  return leaked;
};

const COURIERS = [
  { id: "263", name: "Sardor Aliyev", phone_number: "+998901112233", region: { name: "Toshkent sh." }, status: "active" },
  { id: "264", name: "Jasur Karimov", phone_number: "+998904445566", region: { name: "Toshkent sh." }, status: "active" },
];

export const mockDispatchApi = async (page: Page) => {
  const orders = new Map([
    ["tok-10285", order("10285", "Feruza Mirzayeva")],
    ["tok-10316", order("10316", "Ali Valiyev", { where_deliver: "center", total_price: 240000 })],
    ["tok-10342", order("10342", "Dilnoza Rahimova")],
  ]);
  const courierQueries: Array<Record<string, string>> = [];
  const lookups: string[] = [];
  const assigns: Body[] = [];
  const leaked = await routeApi(
    page,
    {
      id: "269",
      role: "registrator",
      name: "TEST Registrator",
      status: "active",
      region_id: null,
      branch: { id: "1", type: "HQ", name: "Toshkent HQ", region_id: null },
    },
    (route, path, method, url) => {
      if (path === "couriers" && method === "GET") {
        courierQueries.push(Object.fromEntries(url.searchParams));
        return reply(route, {
          statusCode: 200,
          data: { items: COURIERS, meta: { page: 1, limit: 100, total: COURIERS.length, totalPages: 1 } },
        });
      }
      const lookup = /^orders\/qr-code\/(.+)$/.exec(path);
      if (lookup && method === "GET") {
        const token = decodeURIComponent(lookup[1]);
        lookups.push(token);
        const found = orders.get(token);
        return found
          ? reply(route, { statusCode: 200, data: found })
          : reply(route, { statusCode: 404, message: "Buyurtma topilmadi" }, 404);
      }
      if (path === "orders/assign-to-courier" && method === "POST") {
        const body = route.request().postDataJSON() as Body;
        assigns.push(body);
        return reply(route, { statusCode: 200, message: "Assigned", data: { assigned: (body.order_ids as string[]).length } });
      }
      return false;
    },
  );
  return { courierQueries, lookups, assigns, leaked };
};

/**
 * USB (HID) skaner: tez tugmalar + Enter (`useKeyboardScanner`, oynada tinglaydi). Oldidan qisqa pauza — sahifa
 * har skandan keyin darvozani 250 ms yopadi (`blockScans(250)`), haqiqiy operator ham shunchalik tez emas.
 */
export const hidScan = async (page: Page, token: string) => {
  await page.waitForTimeout(400);
  await page.keyboard.type(token);
  await page.keyboard.press("Enter");
};

/** Sahifa ochiladi va kuryerlar yuklanadi («Kuryerga biriktirish» sarlavhasi + skaner kartasi). */
export const openDispatch = async (page: Page) => {
  await page.goto("/dispatch");
  await expect(page.getByRole("heading", { level: 1, name: "Kuryerga biriktirish" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Buyurtma QR kodlarini skanerlang")).toBeVisible();
};

type CourierBulkMockOptions = {
  /** Shu buyurtmalar marketi sotishda isbot talab qiladi (`expense_proof_conditions: ["sell_any"]`, j9KFyqlS). */
  sellProofIds?: string[];
  /** Shu buyurtmalar amali backend xatosi bilan rad etiladi (400 + `message`). */
  failWith?: Record<string, string>;
};

export const mockCourierBulkApi = async (page: Page, { sellProofIds = [], failWith = {} }: CourierBulkMockOptions = {}) => {
  const withProof = (id: string) =>
    sellProofIds.includes(id) ? { market: { name: "Baraka Shop", expense_proof_conditions: ["sell_any"] } } : {};
  const state = {
    orders: [
      order("10401", "Feruza Mirzayeva", { status: "waiting", ...withProof("10401") }),
      order("10402", "Ali Valiyev", { status: "waiting", ...withProof("10402") }),
      order("10403", "Dilnoza Rahimova", { status: "waiting", ...withProof("10403") }),
    ],
  };
  const listQueries: Array<Record<string, string>> = [];
  const sells: Array<{ id: string; body: Body }> = [];
  const cancels: Array<{ id: string; body: Body }> = [];
  /** Har sotish/bekor so'rovi: `X-Request-Source` sarlavhasi; isbot — avval `files/upload`, keyin `proofFileKeys`. */
  const requests: Array<{ action: string; id: string; source: string | null }> = [];
  const uploads: string[] = [];
  const leaked = await routeApi(
    page,
    { id: "26", role: "courier", name: "TEST Kuryer", status: "active" },
    async (route, path, method, url) => {
      if (path === "orders/courier/orders" && method === "GET") {
        listQueries.push(Object.fromEntries(url.searchParams));
        return reply(route, { statusCode: 200, data: state.orders, total: state.orders.length, page: 1, limit: 100 });
      }
      if (path === "files/upload" && method === "POST") {
        const key = `proof/e2e-${uploads.length + 1}.jpg`;
        uploads.push(key);
        return reply(route, { statusCode: 201, data: { key } });
      }
      const action = /^orders\/(sell|cancel)\/(\w+)$/.exec(path);
      if (action && method === "POST") {
        const request = route.request();
        const headers = await request.allHeaders();
        requests.push({ action: action[1], id: action[2], source: headers["x-request-source"] ?? null });
        if (failWith[action[2]]) return reply(route, { statusCode: 400, message: failWith[action[2]] }, 400);
        const body = request.postDataJSON() as Body;
        (action[1] === "sell" ? sells : cancels).push({ id: action[2], body });
        state.orders = state.orders.filter((item) => item.id !== action[2]);
        return reply(route, {
          statusCode: 200,
          data: { id: action[2], status: action[1] === "sell" ? "sold" : "cancelled" },
        });
      }
      return false;
    },
  );
  return { state, listQueries, sells, cancels, requests, uploads, leaked };
};

export const openCourierBulk = async (page: Page) => {
  await page.goto("/courier-bulk");
  await expect(page.getByRole("heading", { level: 1, name: "Tezkor amal" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("radiogroup", { name: "Feruza Mirzayeva: natija" })).toBeVisible();
};

/** Qator natijasi (`Sotildi | Bekor | Ertaga`, `radiogroup` «{ism}: natija»). */
export const markResult = async (page: Page, name: string, option: "Sotildi" | "Bekor" | "Ertaga") => {
  const group = page.getByRole("radiogroup", { name: `${name}: natija` });
  await group.getByRole("radio", { name: option }).click();
  await expect(group.getByRole("radio", { name: option })).toHaveAttribute("aria-checked", "true");
};

export const BULK_SOLD_COMMENT = "Kuryer tezkor amal orqali sotildi deb yakunladi";
export const BULK_CANCEL_COMMENT = "Kuryer tezkor amal orqali bekor qildi";

/**
 * «Buyurtmalar» (`/orders`, kuryer bo'lmagan rol) — OR-1 yangilanish e2e'si uchun: `GET orders` (holat tablari bilan bir
 * xil javob), `listFail` — 500 (yangilash xatosi), `listDelayMs` — kechikish («Yangilanmoqda…»), `listCalls` — so'rovlar
 * soni (avtomatik / qo'lda / ilovaga qaytganda yangilanish).
 */
export const mockOrdersListApi = async (page: Page, role: "superadmin" | "admin" | "registrator" = "superadmin") => {
  const state = {
    orders: [
      order("10242", "Sevara Tursunova", { status: "new" }),
      order("10241", "Dilnoza Karimova"),
      order("10238", "Javohir Toshmatov", { status: "on the road" }),
    ],
    listFail: false,
    listDelayMs: 0,
    listCalls: 0,
  };
  const leaked = await routeApi(
    page,
    { id: "1", role, name: "TEST Xodim", status: "active", region_id: null },
    async (route, path, method) => {
      if (path === "orders" && method === "GET") {
        state.listCalls += 1;
        if (state.listDelayMs) await new Promise((done) => setTimeout(done, state.listDelayMs));
        if (state.listFail) return reply(route, { statusCode: 500, message: "e2e: internal" }, 500);
        return reply(route, {
          statusCode: 200,
          data: state.orders,
          meta: { page: 1, limit: 10, total: state.orders.length, totalPages: 1 },
          total: state.orders.length,
        });
      }
      return false;
    },
  );
  return { state, leaked };
};
