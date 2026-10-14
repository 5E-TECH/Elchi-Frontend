import { expect, type Page, type Route } from "@playwright/test";

/**
 * Pochta → Qaytarish (`/mails/return`, YEI06cPN) — soxta backend.
 * Javob shakli backend bilan bir xil: `data: { total, scope, groups: [{ courier, courier_id, orders[] }] }`.
 * Tasdiqlash/rad etish serverdagi ro'yxatdan buyurtmani olib tashlaydi.
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

const order = (id: string, name: string) => ({
  id,
  status: "waiting",
  total_price: 150000,
  qr_code_token: `qr-${id}`,
  post_id: "78",
  holder_courier_id: "9",
  return_requested: true,
  createdAt: "2026-10-12T08:00:00.000Z",
  updatedAt: "2026-10-13T08:00:00.000Z",
  customer: { id: `c${id}`, name, phone_number: "+998901234567" },
  district: { id: "d1", name: "Chilonzor" },
  region: { id: "r1", name: "Toshkent" },
});

export const mockReturnApi = async (page: Page) => {
  const state = {
    groups: [
      {
        courier: { id: "9", name: "Baxodir Kuryer", phone_number: "+998970000009" },
        courier_id: "9",
        orders: [order("1251170", "Aliyev Vali"), order("1251171", "Karimova Nodira")],
      },
    ] as Array<{ courier: unknown; courier_id: string; orders: Array<{ id: string }> }>,
  };
  const actions: Array<{ type: string; body: unknown; status: number }> = [];
  const leaked: string[] = [];
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") {
      return reply(route, { statusCode: 200, data: { id: "1", role: "superadmin", name: "Bosh admin", status: "active" } });
    }
    if (path === "post/return-requests/list") {
      const total = state.groups.reduce((sum, group) => sum + group.orders.length, 0);
      return reply(route, { statusCode: 200, message: "Return requests", data: { total, scope: { type: "HQ" }, groups: state.groups } });
    }
    const action = /^post\/return-requests\/(approve|reject)$/.exec(path);
    if (action && request.method() === "POST") {
      const body = request.postDataJSON() as { order_ids: string[] };
      const ids = new Set(body.order_ids);
      state.groups = state.groups
        .map((group) => ({ ...group, orders: group.orders.filter((item) => !ids.has(item.id)) }))
        .filter((group) => group.orders.length > 0);
      actions.push({ type: action[1], body, status: 201 });
      const key = action[1] === "approve" ? "approved" : "rejected";
      return reply(route, { statusCode: 201, message: "ok", data: { [key]: ids.size, skipped: 0 } }, 201);
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
  return { state, actions, leaked };
};

export const openReturnTab = async (page: Page) => {
  await page.goto("/mails/return");
  await expect(page.getByText("Baxodir Kuryer").first()).toBeVisible({ timeout: 60_000 });
};
