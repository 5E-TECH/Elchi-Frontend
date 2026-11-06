import { expect, type Page, type Route } from "@playwright/test";

/**
 * HQ → filial pochtasini faqat MANZIL filial menejeri qabul qiladi (Elchi-Backend #620/#621, Trello anKpzwxk;
 * ega Q4 sukuti). Soxta backend — menejer:
 *  - `viewer: "destination"` — Qarshi filiali (REGIONAL, 3), pochta №2493 shu filialga jo'natilgan;
 *  - `viewer: "other"` — Shahrisabz filiali (REGIONAL, 7), pochta Qarshiga;
 *  - `viewer: "hq"` — HQ menejeri (HQ, 1), pochta HQ filial id'si bilan (HQ ham manzil emas).
 * `GET post/orders/2493` — `sent`, kuryersiz (`courier_id '0'`), 3 ta yo'ldagi buyurtma. `PATCH post/receive/2493` —
 * 403 `post_receive_manager_only` (#621 shakli: `details.post_id`), so'rov tanasi yoziladi (`receives`).
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

export type Viewer = "destination" | "other" | "hq";

const BRANCHES: Record<Viewer, { id: string; name: string; type: string }> = {
  destination: { id: "3", name: "Qarshi filiali", type: "REGIONAL" },
  other: { id: "7", name: "Shahrisabz filiali", type: "REGIONAL" },
  hq: { id: "1", name: "Toshkent HQ", type: "HQ" },
};
const REGION = { id: "14", name: "Qashqadaryo" };

const order = (id: string, name: string, district: string, price: number) => ({
  id,
  createdAt: "2026-11-05T08:00:00.000Z",
  updatedAt: "2026-11-05T08:00:00.000Z",
  market_id: "m-1",
  customer_id: `c${id}`,
  product_quantity: 1,
  where_deliver: "address",
  total_price: price,
  to_be_paid: price,
  paid_amount: 0,
  status: "on the road",
  comment: null,
  operator: null,
  address: "Mustaqillik ko'chasi, 21",
  in_post_now: true,
  customer: { id: `c${id}`, name, phone_number: "+998914521830" },
  market: { id: "m-1", name: "Baraka Shop" },
  district: { id: `d-${district}`, name: district, region_id: REGION.id, region: REGION },
  region: REGION,
  items: [],
});

const ORDERS = [
  order("10312", "Shoxrux Rahmonov", "Qarshi sh.", 185000),
  order("10309", "Mohira Ergasheva", "Kitob tumani", 240000),
  order("10307", "Laylo Hasanova", "G'uzor tumani", 96000),
];

export const mockMailReceiveDestination = async (
  page: Page,
  { viewer = "destination" as Viewer, theme = "light" as "light" | "dark" } = {},
) => {
  const branch = BRANCHES[viewer];
  const postBranchId = viewer === "hq" ? BRANCHES.hq.id : BRANCHES.destination.id;
  const receives: unknown[] = [];
  const leaked: string[] = [];
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
          id: "522",
          role: "manager",
          name: "Bekzod Normurodov",
          status: "active",
          branch_id: branch.id,
          branch_type: branch.type,
          branch,
          settings: { appearance: { theme, themeChosen: true } },
        },
      });
    }
    if (path === "post/orders/2493") {
      return reply(route, {
        statusCode: 200,
        message: "ok",
        data: {
          allOrdersByPostId: ORDERS,
          post: {
            id: "2493",
            status: "sent",
            courier_id: "0",
            branch_id: postBranchId,
            region_id: REGION.id,
            region: REGION,
            qr_code_token: "POST-2493",
            order_quantity: ORDERS.length,
            post_total_price: ORDERS.reduce((sum, item) => sum + item.total_price, 0),
            createdAt: "2026-11-05T08:10:00.000Z",
          },
        },
      });
    }
    if (path === "post/receive/2493" && request.method() === "PATCH") {
      receives.push(request.postDataJSON());
      return reply(
        route,
        {
          statusCode: 403,
          message: "Bu pochtani faqat manzil filial menejeri qabul qila oladi",
          data: { reason: "post_receive_manager_only", details: { post_id: "2493" } },
        },
        403,
      );
    }
    if (request.method() !== "GET") {
      leaked.push(`${request.method()} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    }
    return reply(route, { statusCode: 200, data: [] });
  });
  await page.addInitScript((t) => {
    window.localStorage.setItem("theme", t);
    window.localStorage.setItem("theme-version", "2");
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
  }, theme);
  return { receives, leaked };
};

const shot = async (page: Page, name: string) => {
  if (process.env.E2E_SHOTS_DIR) await page.screenshot({ path: `${process.env.E2E_SHOTS_DIR}/${name}.png`, fullPage: true });
};

const noHorizontalScroll = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

const HINT = "Bu pochtani manzil filial menejeri qabul qiladi — sizda faqat ko'rish.";

/** Manzil bo'lmagan menejer (boshqa filial yoki HQ): «Faqat o'qish», izoh, buyurtmalar ko'rinadi, qabul tugmasi yo'q. */
export const runForeignManagerReadOnly = async (
  page: Page,
  { viewer, theme, label }: { viewer: Exclude<Viewer, "destination">; theme: "light" | "dark"; label: string },
) => {
  const { receives, leaked } = await mockMailReceiveDestination(page, { viewer, theme });
  await page.goto("/mails/2493");

  await expect(page.getByText(HINT).locator("visible=true")).toHaveCount(1, { timeout: 60_000 });
  await expect(page.getByTestId("mail-read-only")).toHaveText("Faqat o'qish");
  await expect(page.getByText("Shoxrux Rahmonov").locator("visible=true").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Pochtani qabul qilish/ })).toHaveCount(0);
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await noHorizontalScroll(page);
  await shot(page, `mail-receive-${label}-${theme}`);
  expect(receives).toEqual([]);
  expect(leaked).toEqual([]);
};

/** Manzil filial menejeri: qabul tugmasi bor; server baribir rad etsa (#621) — lokal xabar, sahifa joyida. */
export const runDestinationManagerRejected = async (page: Page, { theme, label }: { theme: "light" | "dark"; label: string }) => {
  const { receives, leaked } = await mockMailReceiveDestination(page, { viewer: "destination", theme });
  await page.goto("/mails/2493");

  // Asosiy amal «Pochtani qabul qilish — N ta» (kamera tugmasi ham «Pochtani qabul qilish» deb ataladi — aniq nom).
  const receive = (count: number) =>
    page.getByRole("button", { name: `Pochtani qabul qilish — ${count} ta`, exact: true }).locator("visible=true").first();
  await expect(receive(0)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(HINT)).toHaveCount(0);
  await expect(page.getByTestId("mail-read-only")).toHaveCount(0);

  await page.getByRole("checkbox", { name: "№10312 ni tanlash" }).locator("visible=true").first().check();
  await receive(1).click();

  const toast = page.getByRole("alert").filter({ hasText: "Pochta qabul qilinmadi" });
  await expect(toast).toBeVisible();
  await expect(toast).toContainText("Bu pochtani faqat manzil filial menejeri qabul qila oladi.");
  // Xabar kirish animatsiyasi tugasin (skrinshotda yarim ko'rinmasin).
  await page.evaluate(() =>
    Promise.allSettled(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map((animation) => animation.finished),
    ),
  );
  await shot(page, `mail-receive-${label}-${theme}`);
  expect(receives).toEqual([{ order_ids: ["10312"] }]);
  expect(leaked).toEqual([]);
};
