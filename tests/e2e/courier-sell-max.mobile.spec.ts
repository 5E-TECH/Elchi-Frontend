import { expect, test, type Route } from "@playwright/test";
import { openSellDialog } from "./support/courierCancel";
import { expectToast } from "./support/toast";

/**
 * uguUEhin (prod №73 holati) — kutilayotgan buyurtmada backend `to_be_paid: 0` beradi (summa sotuvda hisoblanadi).
 * «Marketga to'langan summa» chegarasi endi backend bergan `sale_market_paid_max` dan (30 000, qo'shimcha xarajatdan
 * oldin): «0 so'mdan oshmasin» chiqmaydi, 5 000 xatosiz yuboriladi. 390px, soxta backend — sotuv backend kabi
 * `paidAmount ≤ sale_market_paid_max − extraCost` ni tekshiradi.
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

const ORDER_73 = {
  id: "73",
  created_at: "2026-10-19T08:00:00.000Z",
  status: "waiting",
  total_price: 50000,
  to_be_paid: 0,
  sale_market_paid_max: 30000,
  where_deliver: "address",
  product_quantity: 1,
  market: { name: "TEST Claude Market" },
  customer: { name: "Feruza Mirzayeva", phone_number: "+998993057164" },
  district: { name: "Toshkent tumani" },
  region: { name: "Toshkent viloyati" },
  items: [],
};

test.describe.configure({ timeout: 90_000 });

test("⭐ №73: chegara «30 000 so'mdan oshmasin» (0 emas), 5 000 xatosiz sotiladi; ortig'i — ogohlantirish", async ({ page }) => {
  const sells: Array<Record<string, unknown>> = [];
  const leaked: string[] = [];
  let orders = [ORDER_73];
  await page.context().routeWebSocket(/\/socket\.io\//, (ws) => ws.close());
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") {
      return reply(route, { statusCode: 200, data: { id: "26", role: "courier", name: "TEST Kuryer", status: "active" } });
    }
    if (path === "orders/courier/orders") {
      return reply(route, { statusCode: 200, data: orders, total: orders.length, page: 1, limit: 10 });
    }
    if (path === "orders/sell/73" && request.method() === "POST") {
      const body = request.postDataJSON() as Record<string, unknown>;
      const max = ORDER_73.sale_market_paid_max - Number(body.extraCost ?? 0);
      if (Number(body.paidAmount ?? 0) > max) {
        return reply(route, { statusCode: 400, message: `paidAmount ${max} dan oshmasligi kerak` }, 400);
      }
      sells.push(body);
      orders = [];
      return reply(route, { statusCode: 200, message: "Order sold", data: { id: "73", status: "partly_paid", paid_amount: 5000 } });
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

  const dialog = await openSellDialog(page);
  const paid = dialog.getByLabel("Marketga to'langan summa");
  await expect(dialog.getByText(/30\D000 so'mdan oshmasin/)).toBeVisible();
  await expect(dialog.getByText(/(^|\s)0 so'mdan oshmasin/)).toHaveCount(0);

  // Chegaradan oshsa — maydon ostida ogohlantirish (backend 400 dan oldin).
  await paid.fill("35000");
  await expect(paid).toHaveAttribute("aria-invalid", "true");
  await expect(dialog.getByText(/Marketga to'lov 30\D000 so'mdan oshmasligi kerak/)).toBeVisible();

  // Prod №73: 5 000 — to'g'ri summa, xato yo'q, sotiladi.
  await paid.fill("5000");
  await expect(paid).not.toHaveAttribute("aria-invalid", "true");
  await expect(dialog.getByText(/oshmasligi kerak/)).toHaveCount(0);
  await dialog.getByRole("button", { name: "Sotish", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(sells).toEqual([expect.objectContaining({ paidAmount: 5000 })]);
  await expectToast(page, "Sotildi, marketga qisman to'landi", { tone: "success" });
  expect(leaked).toEqual([]);
});
