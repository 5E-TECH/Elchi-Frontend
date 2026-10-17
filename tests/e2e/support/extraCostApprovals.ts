import { expect, type Page, type Route } from "@playwright/test";

/**
 * Market dashboardi — «Qo'shimcha xarajat tasdiqlari» (PINtZcLj) soxta backendi. Kontrakt:
 * `GET /orders/extra-cost-approvals?status=pending` (market — faqat o'z so'rovlari),
 * `POST /orders/extra-cost-approvals/:id/approve|reject`. `failFirst` — birinchi ro'yxat so'rovi 500
 * (avtomatik qayta urinish ham), «Qayta urinish» dan keyin — sog'. Serverga so'rov ketmaydi.
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

export const APPROVALS = [
  { id: "ap-1", order_id: "10225", market_id: "7", requested_by_user_id: "56", requested_by_role: "courier", action: "sell", amount: 25000, proof_file_keys: ["a", "b"], status: "pending", createdAt: "2026-10-17T08:40:00.000Z" },
  { id: "ap-2", order_id: "10222", market_id: "7", requested_by_user_id: "61", requested_by_role: "courier", action: "cancel", amount: 15000, proof_file_keys: [], status: "pending", createdAt: "2026-10-17T07:05:00.000Z" },
];

export const mockExtraCostApprovals = async (page: Page, { failFirst = false, alreadyResolved = false } = {}) => {
  const decisions: string[] = [];
  let listCalls = 0;
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") {
      return reply(route, { statusCode: 200, data: { id: "7", role: "market", name: "Baraka Shop", status: "active", add_order: true } });
    }
    if (path === "orders/extra-cost-approvals" && request.method() === "GET") {
      listCalls += 1;
      if (failFirst && listCalls <= 2) return reply(route, { statusCode: 500, message: "Internal server error" }, 500);
      return reply(route, { statusCode: 200, data: APPROVALS.filter((item) => !decisions.some((d) => d.endsWith(item.id))) });
    }
    const decision = path.match(/^orders\/extra-cost-approvals\/([^/]+)\/(approve|reject)$/);
    if (decision && request.method() === "POST") {
      decisions.push(`${decision[2]} ${decision[1]}`);
      // 1tnpaIqd: boshqa joyda (Telegram) allaqachon hal qilingan — atomik qaror 400 qaytaradi.
      if (alreadyResolved) {
        return route.fulfill({
          status: 400,
          contentType: "application/json",
          headers: cors,
          body: JSON.stringify({ statusCode: 400, message: "Bu so'rov allaqachon yakunlangan" }),
        });
      }
      return reply(route, { statusCode: 200, data: { id: decision[1], status: decision[2] === "approve" ? "approved" : "rejected" } });
    }
    if (path === "analytics/dashboard") {
      return reply(route, {
        statusCode: 200,
        data: { orders: { acceptedCount: 40, soldAndPaid: 30, cancelled: 4, profit: 1_200_000 }, myStat: { totalOrders: 38, soldOrders: 30, canceledOrders: 4, profit: 1_200_000, successRate: 78.9 }, topMarkets: [], markets: [] },
      });
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
  return { decisions, listCalls: () => listCalls };
};

export const openMarketDashboard = async (page: Page) => {
  await page.goto("/");
  await expect(page.getByTestId("extra-cost-approvals")).toBeVisible({ timeout: 90_000 });
};
