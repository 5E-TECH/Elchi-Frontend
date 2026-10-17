import { expect, test, type Route } from "@playwright/test";

/**
 * vmLTsAok — Balans → Tahlil: «Eng katta ta'sir ko'rsatgan tranzaksiyalar» server sahifalashi.
 * Kontrakt: GET finance/financial-balance/top-impacts?page&limit (limit ≤ 100) → `data.pagination.total / totalPages`.
 * Soxta backend serverdek: limit 100 dan katta bo'lsa 100 ga qirqadi. 1440px.
 */
const ORIGIN = "http://127.0.0.1:4173";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown) =>
  route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
const TOTAL = 186;

test.describe("Balans → Tahlil: tranzaksiyalar sahifalashi (vmLTsAok) — 1440px", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });
  test.describe.configure({ timeout: 120_000 });

  test("⭐ TC1/TC2/TC3: `limit` ≤ 100, «186 ta jami» = 19 sahifa, 11-sahifaga o'tilganda `page=11` va 101–110 keladi", async ({ page }) => {
    const requests: URLSearchParams[] = [];
    await page.context().route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin === ORIGIN) return route.continue();
      if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
      if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
      const path = url.pathname.replace(/^\//, "");
      if (path === "auth/my-profile") {
        return reply(route, { statusCode: 200, data: { id: "1", role: "superadmin", name: "E2E", status: "active" } });
      }
      if (path === "finance/cashbox/financial-balanse") {
        return reply(route, {
          statusCode: 200,
          data: {
            main: { balance: 5_000_000, cashbox: { balance: 5_000_000 } },
            markets: { allMarketCashboxes: [], marketsTotalBalans: 0 },
            couriers: { allCourierCashboxes: [], couriersTotalBalanse: 0 },
            currentSituation: 5_000_000,
            difference: 0,
          },
        });
      }
      if (path === "finance/financial-balance/top-impacts") {
        requests.push(url.searchParams);
        const limit = Math.min(100, Number(url.searchParams.get("limit")) || 20);
        const current = Number(url.searchParams.get("page")) || 1;
        const from = (current - 1) * limit;
        const items = Array.from({ length: Math.max(0, Math.min(limit, TOTAL - from)) }, (_, i) => ({
          id: String(from + i + 1),
          amount: 9_000_000 - (from + i) * 1000,
          operation_type: "income",
          source_type: "manual_income",
          payment_date: "2026-10-17T05:00:00.000Z",
        }));
        return reply(route, { statusCode: 200, data: { items, pagination: { total: TOTAL, page: current, limit, totalPages: Math.ceil(TOTAL / limit) } } });
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
    await page.goto("/financial-balance?tab=analysis");

    await expect(page.getByText("186 ta jami")).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText("#10", { exact: true })).toBeVisible();
    await expect(page.getByText("#11", { exact: true })).toHaveCount(0);
    expect(requests.every((params) => Number(params.get("limit")) <= 100)).toBe(true);
    await expect(page.getByRole("button", { name: "19", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "5", exact: true }).click();
    for (let step = 0; step < 6; step += 1) await page.getByRole("button", { name: "Keyingi" }).click();

    await expect.poll(() => requests.at(-1)?.get("page")).toBe("11");
    await expect(page.getByText("#101", { exact: true })).toBeVisible();
    await expect(page.getByText("#110", { exact: true })).toBeVisible();
    expect(requests.at(-1)?.get("limit")).toBe("10");
  });
});
