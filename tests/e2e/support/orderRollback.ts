import type { Page, Route } from "@playwright/test";

/**
 * BE #738 (ega qarorlari D1–D4) — «Qaytarish» e2e soxta backendi: menejer `/orders` ro'yxati (`GET orders`,
 * `orders/status-counts`), tafsilot (`GET orders/:id`, tracking) va `POST orders/rollback/:id` (navbatdagi javoblar,
 * `Idempotency-Key` sarlavhasi va tana yoziladi). Har buyurtmada `rollback: { allowed, code, message } | null` —
 * joriy foydalanuvchi uchun (gateway shakli). Boshqa GET — bo'sh, ruxsatsiz yozish — `leaked` (403).
 */
// Worktree serverlari boshqa portda — `E2E_ORIGIN`.
const ORIGIN = process.env.E2E_ORIGIN ?? "http://127.0.0.1:4173";
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
};
const reply = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
const wrap = (data: unknown) => ({ statusCode: 200, message: "ok", data });

export type RollbackField = { allowed: boolean; code: string | null; message: string | null } | null;

export const ALLOWED: RollbackField = { allowed: true, code: null, message: null };
export const SUPERADMIN_ONLY_MESSAGE = "Buyurtma puli bosh ofisga o'tgan — faqat superadmin qaytara oladi";
export const SUPERADMIN_ONLY: RollbackField = { allowed: false, code: "SUPERADMIN_ONLY", message: SUPERADMIN_ONLY_MESSAGE };
export const PARCEL_NOT_IN_BRANCH_MESSAGE =
  "Posilka filialdan jo'natilgan (bekorlar paketi, pochta, HQ yoki market) — qaytarib bo'lmaydi";
export const STATUS_NOT_ROLLBACKABLE = (status: string): RollbackField => ({
  allowed: false,
  code: "STATUS_NOT_ROLLBACKABLE",
  message: `Rollback mumkin emas (status: ${status})`,
});

/** Hududiy (HYBRID) menejer, `can_sell_cancel` yoqiq — eski FE qoidasi ham tugmani ko'rsatardi. */
export const MANAGER = {
  id: "25",
  role: "manager",
  name: "TEST Menejer",
  status: "active",
  branch_id: "12",
  branch: { id: "12", name: "TEST Surxondaryo filiali", type: "HYBRID" },
  branch_type: "HYBRID",
  can_sell_cancel: true,
};

export const rollbackOrder = (id: string, name: string, over: Record<string, unknown> = {}) => ({
  id,
  order_number: `EL-${id}`,
  qr_code_token: `tok-${id}`,
  createdAt: "2026-11-19T08:00:00.000Z",
  created_at: "2026-11-19T08:00:00.000Z",
  status: "sold",
  sold_at: "1784557174975",
  total_price: 96000,
  to_be_paid: 0,
  paid_amount: 96000,
  where_deliver: "address",
  product_quantity: 1,
  post_id: "35",
  holder_type: "COURIER",
  holder_branch_id: "12",
  holder_courier_id: "93",
  courier_id: "93",
  branch_id: "12",
  comment: null,
  address: "Termiz, Mustaqillik 5",
  market: { id: "37", name: "Chilonzor Market" },
  customer: { id: `c-${id}`, name, phone_number: "+998998124011" },
  district: { id: "5", name: "Termiz tumani", region: { name: "Surxondaryo" } },
  region: { name: "Surxondaryo" },
  items: [],
  ...over,
});

export type RollbackReply = { status: number; body: unknown };

export const mockRollbackApi = async (
  page: Page,
  orders: Record<string, unknown>[],
  {
    profile = MANAGER,
    theme = "light",
    rollbackReplies = {},
    onRolledBack,
  }: {
    profile?: Record<string, unknown>;
    theme?: "light" | "dark";
    /** `POST orders/rollback/:id` javoblari navbati (har so'rov birinchisini oladi; tugasa — 200). */
    rollbackReplies?: Record<string, RollbackReply[]>;
    /** 200 javobidan keyin buyurtma yangilanadi (keyingi GET yangi holat va `rollback` ni ko'radi). */
    onRolledBack?: (order: Record<string, unknown>, target: string) => void;
  } = {},
) => {
  const state = {
    orders,
    /** Har rollback so'rovi: id, tana, `Idempotency-Key`. */
    rollbacks: [] as { id: string; body: unknown; key: string | null }[],
    requests: [] as string[],
  };
  const leaked: string[] = [];
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    state.requests.push(`${request.method()} ${path}`);
    if (path === "auth/my-profile") {
      return reply(route, wrap({ ...profile, settings: { appearance: { theme, themeChosen: true, language: "uz" } } }));
    }
    if (request.method() === "GET" && path === "orders/status-counts") {
      const sold = state.orders.filter((order) => order.status === "sold").length;
      return reply(route, wrap({ all: state.orders.length, sold, cancelled: state.orders.length - sold, by_status: {} }));
    }
    if (request.method() === "GET" && path === "orders") {
      return reply(route, {
        statusCode: 200,
        data: state.orders,
        meta: { page: 1, limit: 10, total: state.orders.length, totalPages: 1 },
        total: state.orders.length,
      });
    }
    const rollbackMatch = /^orders\/rollback\/(\d+)$/.exec(path);
    if (request.method() === "POST" && rollbackMatch) {
      const id = rollbackMatch[1];
      const body = request.postDataJSON() as { target_status?: string } | null;
      state.rollbacks.push({ id, body, key: request.headers()["idempotency-key"] ?? null });
      const next = rollbackReplies[id]?.shift();
      if (next && next.status !== 200) return reply(route, next.body, next.status);
      const order = state.orders.find((item) => String(item.id) === id);
      if (order) onRolledBack?.(order, body?.target_status ?? "waiting");
      return reply(route, next?.body ?? { statusCode: 200, message: "Order WAITING holatiga qaytarildi", data: {} });
    }
    const detail = /^orders\/(\d+)$/.exec(path);
    if (request.method() === "GET" && detail) {
      const order = state.orders.find((item) => String(item.id) === detail[1]);
      return order ? reply(route, wrap(order)) : reply(route, { statusCode: 404, message: "Buyurtma topilmadi" }, 404);
    }
    if (/^orders\/\d+\/tracking$/.test(path)) return reply(route, { data: [], total: 0, page: 1, limit: 20 });
    if (request.method() !== "GET") {
      leaked.push(`${request.method()} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    }
    return reply(route, wrap([]));
  });
  await page.addInitScript((value) => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
    window.localStorage.setItem("theme", value);
    window.localStorage.setItem("theme-version", "2");
  }, theme);
  return { state, leaked };
};

/** 200 dan keyin: buyurtma «Kutilmoqda» da, qaytarish endi mumkin emas (gateway maydoni ham yangilanadi). */
export const markRolledBack = (order: Record<string, unknown>, target: string) => {
  order.status = target === "cancelled" ? "cancelled" : "waiting";
  order.rollback = STATUS_NOT_ROLLBACKABLE(String(order.status));
};
