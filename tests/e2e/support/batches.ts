import { expect, type Page, type Route } from "@playwright/test";

/**
 * «Paketlar va qaytarishlar» (`/batches`, `/batches/:id`, `/returns`) e2e — soxta backend.
 * Menejer (filial turi HQ) — paketlar ro'yxati, yangi paketni asosiy filialga yuborish
 * (`PATCH transfer-batches/:id/send { orderIds }`) va qaytarish paketlari.
 */
const ORIGIN = "http://127.0.0.1:4173";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });

const today = (h: number, m: number) => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m).toISOString();
};

export const BATCH_ORDER_IDS = ["10166", "10165", "10163"];

const LIST = [
  {
    id: "172",
    qr_code_token: "BTB-172",
    source_branch: { id: "7", name: "Urgut filiali" },
    destination_branch: { id: "1", name: "Toshkent HQ" },
    region: { id: "14", name: "Samarqand" },
    direction: "FORWARD",
    status: "PENDING",
    order_count: 3,
    total_price: 864000,
    createdAt: today(9, 20),
  },
];

const detail = (sent: Set<string>) => ({
  id: "172",
  qr_code_token: "BTB-172",
  source_branch: { id: "7", name: "Urgut filiali", code: "SMQ-URG" },
  destination_branch: { id: "1", name: "Toshkent HQ" },
  direction: "FORWARD",
  status: "PENDING",
  order_count: 3,
  total_price: 864000,
  createdAt: today(9, 20),
  region: { id: "14", name: "Samarqand viloyati" },
  items: [
    ["10166", "Hulkar Abdullayeva", "address", 265000],
    ["10165", "Akmal Yo'ldoshev", "address", 410000],
    ["10163", "Feruza Qosimova", "center", 189000],
  ]
    .filter(([id]) => !sent.has(String(id)))
    .map(([id, name, whereDeliver, price]) => ({
      id: `i${id}`,
      order_id: id,
      snapshot_price: price,
      order: {
        id,
        status: "received",
        where_deliver: whereDeliver,
        total_price: price,
        createdAt: today(8, 0),
        address: "Mustaqillik ko'chasi, 14-uy",
        qr_code_token: `qr-${id}`,
        customer: { id: `c${id}`, name, phone_number: "+998912451780" },
        district: { id: "d1", name: "Urgut tumani" },
      },
    })),
  history: [],
});

const RETURNS = [
  {
    id: "171",
    source_branch: { name: "Urgut filiali" },
    destination_branch: { name: "Toshkent HQ" },
    order_count: 4,
    total_price: 1160000,
    status: "PENDING",
    createdAt: today(15, 20),
  },
];

export const mockBatchesApi = async (page: Page) => {
  const leaked: string[] = [];
  const sends: { path: string; body: unknown }[] = [];
  const listQueries: string[] = [];
  const sent = new Set<string>();
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
          role: "manager",
          name: "Ravshan Ortiqov",
          status: "active",
          branch_id: "7",
          branch_type: "HQ",
          branch: { id: "7", branch: { id: "7", name: "Urgut filiali", type: "HQ" } },
        },
      });
    }
    if (path === "transfer-batches" && request.method() === "GET") {
      listQueries.push(url.search);
      const returns = url.searchParams.get("direction") === "RETURN";
      const items = returns ? RETURNS : LIST;
      return reply(route, { statusCode: 200, data: { items, meta: { page: 1, limit: 10, total: items.length } } });
    }
    if ((path === "transfer-batches/172" || path === "transfer-batches/172/remaining") && request.method() === "GET") {
      return reply(route, detail(sent));
    }
    // 3HKvAyhm: paket tarixi — xronologik (eng eskisi birinchi), bajargan `user.name`.
    if (path === "transfer-batches/172/history" && request.method() === "GET") {
      const created = { id: "h1", batch_id: "172", user_id: "1", action: "CREATED", action_label: "Yaratildi", notes: null, created_at: today(9, 20), user: { id: "1", name: "Ravshan Ortiqov" } };
      const sentRows = sends.length
        ? [{ id: "h2", batch_id: "172", user_id: "1", action: "SENT", action_label: "Jo'natildi", notes: null, created_at: new Date().toISOString(), user: { id: "1", name: "Ravshan Ortiqov" } }]
        : [];
      return reply(route, { statusCode: 200, data: [created, ...sentRows] });
    }
    if (path === "transfer-batches/172/send" && request.method() === "PATCH") {
      const body = request.postDataJSON() as { orderIds: string[] };
      sends.push({ path, body });
      body.orderIds.forEach((id) => sent.add(id));
      return reply(route, { statusCode: 200, message: "Sent" });
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
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
  });
  return { leaked, sends, listQueries };
};

export const openBatches = async (page: Page, path = "/batches") => {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1, name: "Paketlar" })).toBeVisible({ timeout: 60_000 });
};

/** 390 px da sahifa gorizontal aylanmaydi. */
export const expectNoHorizontalScroll = async (page: Page) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
};
