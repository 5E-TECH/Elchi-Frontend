import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, type Page, type Route } from "@playwright/test";

/**
 * Buyurtma dalillari (`proof_files`) e2e uchun soxta backend. Hech qanday
 * so'rov serverga ketmaydi.
 *
 * `backend` — fayl berish holati:
 *  - "content"    — yangi `GET files/:key/content` (JWT + egalik) baytlarni beradi;
 *  - "signed"     — content yo'q (404), imzolangan URL brauzer ocha oladigan CDN'da;
 *  - "prod-today" — content yo'q (404), imzolangan URL MinIO ICHKI manzili
 *                   (`http://minio:9000/...`) — bugungi prod: brauzer ocha olmaydi.
 */
export type ProofBackend = "content" | "signed" | "prod-today";

const ORIGIN = "http://127.0.0.1:4173";
export const CDN = "https://cdn.e2e.test";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
const wrap = (data: unknown) => ({ statusCode: 200, message: "ok", data });

/** 8×8 qizil PNG — haqiqiy rasm, brauzer uni dekodlaydi. */
export const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFWEXHbQSACj/P8Fu7N9hAAAAAElFTkSuQmCC",
  "base64",
);
/** 1 soniyalik 32×32 H.264 video (ffmpeg bilan yasalgan) — brauzer dekodlaydi. */
export const MP4 = readFileSync(fileURLToPath(new URL("../fixtures/proof-sample.mp4", import.meta.url)));

const bytesFor = (key: string) =>
  /\.mp4$/i.test(key) ? { contentType: "video/mp4", body: MP4 } : { contentType: "image/png", body: PNG };

/** Real #95 dagi kalit (karta dalilidan, so'zma-so'z). */
export const ORDER_95_KEY =
  "proof-1784557173685-10818f3a-6482-4bb3-b092-f85b18057d9b-Screenshot_from_2025-12-05_22-03-56.png";

export const proofOrder = (overrides: Record<string, unknown> = {}) => ({
  id: "95",
  status: "sold",
  where_deliver: "center",
  total_price: 150000,
  to_be_paid: 0,
  paid_amount: 150000,
  comment: null,
  address: null,
  customer: { id: "c1", name: "Aliyev Vali", phone_number: "+998901234567" },
  market: { id: "m1", name: "Zamon Market", expense_proof_conditions: ["sell_any"] },
  items: [],
  proof_files: [ORDER_95_KEY],
  ...overrides,
});

export const mockOrderProofApi = async (
  page: Page,
  {
    order = proofOrder(),
    backend = "content",
    profile = { id: "1", role: "admin", name: "E2E admin", status: "active" },
  }: { order?: Record<string, unknown>; backend?: ProofBackend; profile?: Record<string, unknown> } = {},
) => {
  const leaked: string[] = [];
  /** `files/...` so'rovlari va ularning Authorization sarlavhasi bor-yo'qligi. */
  const fileCalls: string[] = [];
  const unauthorizedFileCalls: string[] = [];
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (url.origin === CDN) {
      const key = decodeURIComponent(url.pathname.replace(/^\//, ""));
      return route.fulfill({ status: 200, ...bytesFor(key) });
    }
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });

    const path = decodeURIComponent(url.pathname.replace(/^\//, ""));
    if (path === "auth/my-profile") return reply(route, wrap(profile));
    if (path === `orders/${order.id}`) return reply(route, wrap(order));

    // Tunnel faqat api-gateway'ga boradi — `/elchi-files/...` (MinIO yo'li) u yerda YO'Q.
    if (path.startsWith("elchi-files/")) return reply(route, { message: "Cannot GET" }, 404);

    if (path.startsWith("files/")) {
      fileCalls.push(path);
      if (!request.headers()["authorization"]) unauthorizedFileCalls.push(path);
      const content = /^files\/(.+)\/content$/.exec(path);
      if (content) {
        if (backend !== "content") return reply(route, { message: "Cannot GET" }, 404);
        return route.fulfill({ status: 200, headers: cors, ...bytesFor(content[1]) });
      }
      const key = path.replace(/^files\//, "");
      const signedUrl =
        backend === "prod-today"
          ? `http://minio:9000/elchi-files/${encodeURIComponent(key)}?X-Amz-Signature=e2e`
          : `${CDN}/${encodeURIComponent(key)}?X-Amz-Signature=e2e`;
      return reply(route, wrap({ url: signedUrl, expires_in: 3600 }));
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
  return { leaked, fileCalls, unauthorizedFileCalls };
};

export const openProofOrder = async (page: Page, id: string) => {
  await page.goto(`/orders/edit/${id}`);
  await expect(page.getByTestId("order-meta")).toBeVisible({ timeout: 60_000 });
};
