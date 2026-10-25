import { expect, type Locator, type Page, type Route } from "@playwright/test";

/**
 * Universal skaner (`/scan`) rejimlari — 3-bosqich (Trello v1eLN2tV) e2e, soxta backend. Kuryer «O'zimga olish»:
 * har kod → `POST orders/scan-assign`; javob `{ idempotent, order_id, order }`.
 */
const ORIGIN = "http://127.0.0.1:4194";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
const wrap = (data: unknown) => ({ statusCode: 200, message: "ok", data });

export const COURIER_TOKENS = {
  "c0c0c0c0c0c0c0c0c0c0c191": { id: "10191", name: "Lobar Yusupova", district: "Yunusobod tumani" },
  "c0c0c0c0c0c0c0c0c0c0c172": { id: "10172", name: "Sardor Qodirov", district: "Mirzo Ulug'bek tumani" },
} as const;

export const mockCourierScanApi = async (page: Page) => {
  const leaked: string[] = [];
  const assigns: string[] = [];
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") {
      return reply(
        route,
        wrap({ id: "31", role: "courier", name: "Kuryer", status: "active", branch_id: "2", branch: { id: "2", name: "Chilonzor", type: "REGIONAL" } }),
      );
    }
    if (path === "orders/scan-assign" && request.method() === "POST") {
      const token = (request.postDataJSON() as { qr_token: string }).qr_token;
      assigns.push(token);
      const order = COURIER_TOKENS[token as keyof typeof COURIER_TOKENS];
      if (!order) return reply(route, { statusCode: 404, message: "Buyurtma topilmadi" }, 404);
      return reply(
        route,
        wrap({
          idempotent: false,
          order_id: order.id,
          post_id: "p-1",
          post_created: assigns.length === 1,
          order: { id: order.id, order_number: order.id, customer: { name: order.name }, district: order.district },
        }),
      );
    }
    if (request.method() !== "GET") {
      leaked.push(`${request.method()} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    }
    return reply(route, wrap([]));
  });
  await page.addInitScript(() => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
  });
  return { leaked, assigns };
};

/** «Qo'lda kiritish» varag'i orqali kod (`submit` — varaq tugmasi: «Olish», «Qo'shish», «Ochish»). */
export const enterScanCode = async (page: Page, camera: Locator, code: string, submit: string) => {
  await camera.getByRole("button", { name: "Qo'lda kiritish" }).first().click();
  const sheet = page.getByRole("dialog", { name: "Kodni qo'lda kiriting" });
  await sheet.getByRole("textbox").fill(code);
  await sheet.getByRole("button", { name: submit }).click();
  await expect(sheet).toBeHidden();
};
