import { expect, type Page, type Route } from "@playwright/test";

/**
 * `/logistics-ops` e2e uchun soxta backend (superadmin, OS-3). Hech qanday so'rov serverga ketmaydi;
 * ruxsatsiz yozuvchi so'rov `leaked` ga tushadi.
 */
/** Dev server manzili (worktree probe'larida boshqa port — `E2E_ORIGIN`). */
const ORIGIN = process.env.E2E_ORIGIN ?? "http://127.0.0.1:4194";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });

/** Backend `logistics.post.return_requests` javobi (gateway boyitgan): kuryer bo'yicha guruhlar + doira. */
export const RETURN_REQUESTS = {
  statusCode: 200,
  message: "Qaytarish so'rovlari",
  data: {
    total: 7,
    scope: { type: "HQ", branch_id: "1" },
    groups: [
      {
        courier_id: "56",
        courier: { id: "56", name: "Jasur Tursunov", phone_number: "+998901112233" },
        orders: [
          { id: "10244", status: "waiting" },
          { id: "10241", status: "on the road" },
          { id: "10223", status: "waiting" },
          { id: "10236", status: "on the road" },
          { id: "10229", status: "on the road" },
        ],
      },
      {
        courier_id: "57",
        courier: { id: "57", name: "Sherzod Komilov", phone_number: "+998901112244" },
        orders: [{ id: "10250", status: "waiting" }],
      },
      { courier_id: null, courier: null, orders: [{ id: "10198", status: "waiting" }] },
    ],
  },
};

/** Maketdagi hajm (12 ta buyurtma, 3 kuryer + kuryersiz) — telefonda pastki varaq balandligini tekshirish uchun. */
export const RETURN_REQUESTS_12 = {
  ...RETURN_REQUESTS,
  data: {
    total: 12,
    scope: { type: "HQ", branch_id: "1" },
    groups: [
      RETURN_REQUESTS.data.groups[0],
      {
        courier_id: "57",
        courier: { id: "57", name: "Sherzod Komilov", phone_number: "+998901112244" },
        orders: [
          { id: "10250", status: "waiting" },
          { id: "10251", status: "on the road" },
          { id: "10252", status: "waiting" },
          { id: "10253", status: "waiting" },
        ],
      },
      {
        courier_id: "58",
        courier: { id: "58", name: "Bekzod Aliyev", phone_number: "+998901112255" },
        orders: [
          { id: "10260", status: "on the road" },
          { id: "10261", status: "waiting" },
        ],
      },
      { courier_id: null, courier: null, orders: [{ id: "10198", status: "waiting" }] },
    ],
  },
};

export const EMPTY_RETURN_REQUESTS = {
  statusCode: 200,
  message: "Qaytarish so'rovlari",
  data: { total: 0, scope: { type: "HQ", branch_id: "1" }, groups: [] },
};

export type ApproveReply = { status: number; body: unknown };

/**
 * `approve` — har `POST post/return-requests/approve` uchun javob (tanasi `approveBodies` ga yoziladi).
 * Muvaffaqiyatli tasdiqdan keyin ro'yxat bo'sh qaytadi (buyurtmalar omborga o'tdi).
 */
export const mockLogisticsOpsApi = async (
  page: Page,
  approve: (body: unknown) => ApproveReply,
  list: unknown = RETURN_REQUESTS,
) => {
  const leaked: string[] = [];
  const approveBodies: unknown[] = [];
  let listCalls = 0;
  let approved = false;
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
      listCalls += 1;
      return reply(route, approved ? EMPTY_RETURN_REQUESTS : list);
    }
    if (path === "post/return-requests/approve" && request.method() === "POST") {
      const body = request.postDataJSON();
      approveBodies.push(body);
      const result = approve(body);
      if (result.status < 400) approved = true;
      return reply(route, result.body, result.status);
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
  return { leaked, approveBodies, listCalls: () => listCalls };
};

export const openLogisticsOps = async (page: Page) => {
  await page.goto("/logistics-ops");
  await expect(page.getByRole("heading", { name: "Logistika — qaytarish so'rovlari" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Sherzod Komilov").first()).toBeVisible();
};

export const APPROVE_DIALOG = "Qaytarish so'rovlarini tasdiqlang";

/** Hammasini tanlab, tasdiq oynasini ochadi (maket `superadmin-ops-logistics-approve-dialog`). */
export const openApproveDialog = async (page: Page, count = 7) => {
  await page.getByRole("checkbox", { name: "Barcha so'rovlarni tanlash" }).first().check();
  await page.getByRole("button", { name: `Tasdiqlash — ${count} ta` }).click();
  const dialog = page.getByRole("alertdialog", { name: APPROVE_DIALOG });
  await expect(dialog).toBeVisible();
  return dialog;
};
