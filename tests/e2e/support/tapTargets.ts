import { expect, type Page, type Route } from "@playwright/test";

/**
 * Bosish maydoni (aA5njZNo) — soxta backend: dashboard (reytinglar, hududlar, grafik) va buyurtmalar ro'yxati
 * to'liq chiziladigan ma'lumot bilan. Serverga so'rov ketmaydi (jonli kanal WebSocket'i ham yopiladi — WebKit'da
 * `--host-resolver-rules` yo'q).
 */
const ORIGIN = "http://127.0.0.1:4194";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown) =>
  route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(body) });

export type TapRole = "superadmin" | "market" | "courier";

const rated = <T extends Record<string, unknown>>(rows: T[], total: (i: number) => number, sold: (i: number) => number) =>
  rows.map((row, i) => ({ ...row, total_orders: total(i), successful_orders: sold(i), success_rate: (sold(i) / total(i)) * 100 }));

const MARKETS = rated(
  ["Baraka Shop", "Nur Elektronika", "Ipak Yo'li", "Chilonzor Market", "Oila Market", "Samarqand Savdo", "Buxoro Bozor"].map(
    (name, i) => ({ market_id: `m${i + 1}`, market_name: name }),
  ),
  (i) => 45 - i,
  (i) => 38 - i * 2,
);
const BRANCHES = rated(
  ["Toshkent HQ", "Samarqand filiali", "Andijon filiali", "Farg'ona filiali", "Buxoro filiali", "Urgut filiali"].map(
    (name, i) => ({ branch_id: `b${i + 1}`, branch_name: name }),
  ),
  (i) => 90 - i * 5,
  (i) => 60 - i * 4,
);
const COURIERS = rated(
  ["Jasur Tursunov", "Ali Valiyev", "Bekzod Karimov", "Dilshod Aliyev", "Sardor Umarov"].map((name, i) => ({
    courier_id: String(i + 1),
    courier_name: name,
  })),
  (i) => 30 - i,
  (i) => 26 - i * 2,
);
const REGIONS = [
  { id: "1", name: "Toshkent shahri", districtCount: 11, activeCouriers: 20, ordersCount: 112, deliveredOrders: 91, cancelledOrders: 8, totalRevenue: 18_500_000 },
  { id: "2", name: "Andijon viloyati", districtCount: 14, activeCouriers: 6, ordersCount: 21, deliveredOrders: 15, cancelledOrders: 3, totalRevenue: 3_000_000 },
  { id: "3", name: "Samarqand viloyati", districtCount: 14, activeCouriers: 9, ordersCount: 48, deliveredOrders: 30, cancelledOrders: 6, totalRevenue: 6_000_000 },
];
const order = (id: number) => ({
  id: String(id),
  status: "sold",
  total_price: 150000,
  createdAt: "2026-10-16T08:00:00.000Z",
  customer: { name: `Mijoz ${id}`, phone_number: "+998901234567" },
  market: { id: "7", name: "Baraka Shop" },
  district: { id: "5", name: "Chilonzor", region: { id: "1", name: "Toshkent" } },
  courier: { id: "26", name: "Jasur Tursunov", phone_number: "+998901112233" },
  items: [],
});

export const mockTapTargetsApi = async (page: Page, role: TapRole = "superadmin") => {
  await page.context().routeWebSocket(/\/socket\.io\//, (ws) => ws.close());
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") {
      return reply(route, { statusCode: 200, data: { id: "1", role, name: "E2E", status: "active" } });
    }
    if (path === "analytics/dashboard") {
      return reply(route, {
        statusCode: 200,
        message: "ok",
        data: {
          orders: { acceptedCount: 120, soldAndPaid: 80, cancelled: 10, profit: 1_200_000, totalRevenue: 9_600_000 },
          myStat: { totalOrders: 28, soldOrders: 19, canceledOrders: 3, profit: 480_000, successRate: 67.86 },
          markets: MARKETS,
          couriers: COURIERS,
          topMarkets: MARKETS,
          topBranches: BRANCHES,
          topCouriers: COURIERS,
          topOperators: [],
          topMarketsMeta: { period_rule: "last_30_days", period_days: 30, min_orders: 1 },
          topBranchesMeta: { period_rule: "last_30_days", period_days: 30, min_orders: 1 },
        },
      });
    }
    if (path === "region/stats/all") return reply(route, { statusCode: 200, data: REGIONS });
    if (path === "orders") {
      const items = [order(1001), order(1002), order(1003)];
      return reply(route, { statusCode: 200, data: items, total: items.length, page: 1, limit: 10 });
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
};

/**
 * Sahifani ochib, shell skrollini (yagona `main`) oxirigacha aylantiradi — pastdagi bo'limlar ko'ringanda
 * chiziladi; keyin yana tepaga.
 */
export const openFully = async (page: Page, path: string, ready: string) => {
  await page.goto(path);
  await expect(page.locator(ready).first()).toBeVisible({ timeout: 90_000 });
  for (let step = 0; step < 40; step += 1) {
    const atEnd = await page.evaluate(() => {
      const main = document.querySelector<HTMLElement>("[data-shell-slot=content]")?.closest("main") ?? document.scrollingElement;
      if (!main) return true;
      const before = main.scrollTop;
      main.scrollTop += 500;
      return main.scrollTop === before;
    });
    await page.waitForTimeout(300);
    if (atEnd) break;
  }
  await page.waitForTimeout(1000);
};

export type TapTarget = { label: string; width: number; height: number };

/**
 * Ko'rinadigan bosiladigan elementlar va ularning BOSISH MAYDONI (`button, a[href], [role=button], select,
 * input`). Bosish maydoni — elementning o'zi; ikki istisno, ikkalasi ham haqiqiy maydon:
 *   - «cho'zilgan havola» (`RankList`): `::after` qatlami (absolute, inset 0) butun qatorni qoplaydi — maydon
 *     o'sha qator; qator burchagiga bosilganda ham shu element tegishi `elementFromPoint` bilan tekshiriladi;
 *   - yashirin checkbox/radio — uni o'rab turgan `label`.
 */
export const tapTargets = (page: Page) =>
  page.evaluate(() => {
    const result: { label: string; width: number; height: number }[] = [];
    for (const el of document.querySelectorAll<HTMLElement>("button, a[href], [role=button], select, input")) {
      const style = getComputedStyle(el);
      let box = el.getBoundingClientRect();
      if (style.visibility === "hidden" || style.display === "none" || box.width === 0 || box.height === 0) continue;
      if (el.closest("[aria-hidden=true], [hidden], [inert]")) continue;
      const after = getComputedStyle(el, "::after");
      const container = el.offsetParent as HTMLElement | null;
      if (after.content !== "none" && after.position === "absolute" && container) {
        container.scrollIntoView({ block: "center" });
        const area = container.getBoundingClientRect();
        // Qatlam haqiqatan qoplaydimi: qatorning o'ng pastki burchagi (4 px ichkarida) — shu element.
        const hit = document.elementFromPoint(area.right - 4, area.bottom - 4);
        if (hit && (hit === el || el.contains(hit))) box = area;
      } else if (el instanceof HTMLInputElement && /^(checkbox|radio)$/.test(el.type) && el.closest("label")) {
        box = el.closest("label")!.getBoundingClientRect();
      }
      const label = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || el.tagName)
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 60);
      result.push({ label, width: Math.round(box.width * 10) / 10, height: Math.round(box.height * 10) / 10 });
    }
    return result;
  });

export const MIN_TAP = 44;
export const tooSmall = (targets: TapTarget[]) =>
  targets.filter((t) => t.width < MIN_TAP || t.height < MIN_TAP).map((t) => `«${t.label}» ${t.width}×${t.height}`);
