import { expect, type Locator, type Page, type Route } from "@playwright/test";

/**
 * Pochta → Qaytarish (`/mails/return`, YEI06cPN) — soxta backend.
 * Javob shakli backend bilan bir xil: `data: { total, scope, groups: [{ courier, courier_id, orders[] }] }`.
 * Tasdiqlash/rad etish serverdagi ro'yxatdan buyurtmani olib tashlaydi (sukut — 201; `approve` / `reject` berilsa —
 * o'sha javob, 4xx/5xx da ro'yxat o'zgarmaydi).
 *
 * u5HTJtqK: amallar tasdiq oynasi orqali (maket `superadmin-ops-logistics-approve-dialog`) — oynasiz so'rov ketmaydi.
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

/** `holder` — `holder_courier_id` (`null` — kuryersiz qator: kalit ham, ism ham yo'q). */
export const returnOrder = (id: string, name: string, status = "waiting", holder: string | null = "9") => ({
  id,
  status,
  total_price: 150000,
  qr_code_token: `qr-${id}`,
  post_id: "78",
  ...(holder ? { holder_courier_id: holder } : {}),
  return_requested: true,
  createdAt: "2026-10-12T08:00:00.000Z",
  updatedAt: "2026-10-13T08:00:00.000Z",
  customer: { id: `c${id}`, name, phone_number: "+998901234567" },
  district: { id: "d1", name: "Chilonzor" },
  region: { id: "r1", name: "Toshkent" },
});

type ReturnGroupFixture = { courier: unknown; courier_id: string | null; orders: Array<{ id: string }> };

/** Sukut: bitta kuryer, ikki so'rov. */
const DEFAULT_GROUPS: ReturnGroupFixture[] = [
  {
    courier: { id: "9", name: "Baxodir Kuryer", phone_number: "+998970000009" },
    courier_id: "9",
    orders: [returnOrder("1251170", "Aliyev Vali"), returnOrder("1251171", "Karimova Nodira")],
  },
];

/**
 * Maketdagi hajm (`superadmin-ops-logistics-approve-dialog`): 7 ta — 2 kuryer (5 + 1) va kuryersiz 1 ta.
 * Holatlar aralash: «Kuryer qo'lida» (waiting) va «Kuryer qabul qilmagan» (on the road).
 */
export const MAKET_GROUPS: ReturnGroupFixture[] = [
  {
    courier: { id: "56", name: "Jasur Tursunov", phone_number: "+998901112233" },
    courier_id: "56",
    orders: [
      returnOrder("10244", "Aziz Karimov", "on the road", "56"),
      returnOrder("10241", "Malika Yo'ldosheva", "waiting", "56"),
      returnOrder("10223", "Bobur Rahimov", "on the road", "56"),
      returnOrder("10236", "Dilnoza Sobirova", "waiting", "56"),
      returnOrder("10229", "Sardor Aliyev", "waiting", "56"),
    ],
  },
  {
    courier: { id: "57", name: "Sherzod Komilov", phone_number: "+998901112244" },
    courier_id: "57",
    orders: [returnOrder("10250", "Nodir Ergashev", "on the road", "57")],
  },
  { courier: null, courier_id: null, orders: [returnOrder("10198", "Gulnora Tosheva", "on the road", null)] },
];

export type ActionReply = { status: number; body: unknown };

export const mockReturnApi = async (
  page: Page,
  options: {
    groups?: ReturnGroupFixture[];
    approve?: (body: { order_ids: string[] }) => ActionReply;
    reject?: (body: { order_ids: string[] }) => ActionReply;
  } = {},
) => {
  const state = { groups: structuredClone(options.groups ?? DEFAULT_GROUPS) };
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
      const type = action[1] as "approve" | "reject";
      const body = request.postDataJSON() as { order_ids: string[] };
      const custom = options[type]?.(body);
      const status = custom?.status ?? 201;
      if (status < 400) {
        const ids = new Set(body.order_ids);
        state.groups = state.groups
          .map((group) => ({ ...group, orders: group.orders.filter((item) => !ids.has(item.id)) }))
          .filter((group) => group.orders.length > 0);
      }
      actions.push({ type, body, status });
      const key = type === "approve" ? "approved" : "rejected";
      return reply(
        route,
        custom?.body ?? { statusCode: 201, message: "ok", data: { [key]: body.order_ids.length, skipped_order_ids: [] } },
        status,
      );
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

export const openReturnTab = async (page: Page, courier = "Baxodir Kuryer") => {
  await page.goto("/mails/return");
  await expect(page.getByText(courier).first()).toBeVisible({ timeout: 60_000 });
};

export const APPROVE_DIALOG = "Qaytarish so'rovlarini tasdiqlang";
export const REJECT_DIALOG = "Qaytarish so'rovlarini rad eting";

/** Tanlov panelidagi amal → tasdiq oynasi (oyna chiqmaguncha so'rov ketmaydi). */
export const openActionDialog = async (page: Page, action: "approve" | "reject"): Promise<Locator> => {
  const panel = page.getByRole("region", { name: "Tanlangan so'rovlar" });
  await panel.getByRole("button", { name: action === "approve" ? "Tasdiqlash" : "Rad etish", exact: true }).click();
  const dialog = page.getByRole("alertdialog", { name: action === "approve" ? APPROVE_DIALOG : REJECT_DIALOG });
  await expect(dialog).toBeVisible();
  return dialog;
};
