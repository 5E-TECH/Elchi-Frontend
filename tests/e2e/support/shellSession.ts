import { test, type Page, type Route } from "@playwright/test";

/**
 * KI-1 e2e yordamchisi: soxta sessiya + soxta API (`route.fulfill`), yozish so'rovlari taqiqlangan.
 * `handlers` — yo'l (bosh `/` siz) → javob `data`si; qolgan GET'lar bo'sh ro'yxat oladi.
 */
/** Ilova manzili — `playwright.config.ts` dagi `baseURL` dan (port qo'lda takrorlanmaydi). */
const appOrigin = () => new URL(test.info().project.use.baseURL ?? "http://127.0.0.1:4194").origin;
const corsFor = (origin: string) => ({
  "access-control-allow-origin": origin,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
});
const wrap = (data: unknown) => ({ statusCode: 200, message: "ok", data });

export const setupShellSession = async (
  page: Page,
  role: string,
  name: string,
  handlers: Record<string, unknown> = {},
  profile: Record<string, unknown> = {},
) => {
  const leaked: string[] = [];
  const origin = appOrigin();
  const cors = corsFor(origin);
  const reply = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    if (path === "auth/my-profile") return reply(route, wrap({ id: "42", role, name, status: "active", ...profile }));
    if (path === "notifications/inbox/unread-count") return reply(route, wrap({ unread: 0 }));
    if (request.method() !== "GET") {
      leaked.push(`${request.method()} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    }
    if (path in handlers) return reply(route, wrap(handlers[path]));
    return reply(route, wrap({ items: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } }));
  });

  await page.addInitScript(() => {
    const far = Date.now() + 86_400_000;
    window.sessionStorage.setItem("accessToken", "e2e.local.token");
    window.sessionStorage.setItem(
      "authSessionMetadata",
      JSON.stringify({ accessTokenExpiresAt: far, refreshTokenExpiresAt: far, refreshTokenWarnAt: far }),
    );
  });
  return { leaked };
};

/**
 * Bugungi, lekin O'TGAN vaqt: hozirdan `minutesAgo` daqiqa oldin (kelajakdagi qator bo'lmaydi). Yarim tundan keyin
 * darhol ishga tushsa — kun boshiga qisiladi (sana «Bugun» bo'lib qoladi), tartib saqlanadi (kamroq = yangiroq).
 */
const today = (minutesAgo: number) => {
  const now = Date.now();
  const midnight = new Date(now).setHours(0, 0, 0, 0);
  return new Date(Math.max(now - minutesAgo * 60_000, midnight + (60 - minutesAgo))).toISOString();
};

/**
 * `GET finance/cashbox/my-cashbox` — kuryer kassasi: uchta «Kuryerdan filialga o'tkazma» (`courier_payment`):
 * tasdiqlangan (izoh bilan), «Noto'g'ri», javobsiz (maket `courier-cashbox-my-transfers-ack`).
 */
export const courierCashboxWithAck = (cashboxType = "couriers") => ({
  cashbox: { id: "70", cashbox_type: cashboxType, balance: 640_000 },
  cashboxHistory: [
    {
      id: "901",
      amount: -2_400_000,
      operation_type: "expense",
      source_type: "courier_payment",
      payment_method: "cash",
      cashbox_type: cashboxType,
      comment: "Kunlik tushum topshirildi",
      balance_after: 640_000,
      payment_ack: "confirmed",
      createdByUser: { id: 7, name: "Mohira Qodirova", role: "manager" },
      createdAt: today(5),
    },
    {
      id: "902",
      amount: -1_850_000,
      operation_type: "expense",
      source_type: "courier_payment",
      payment_method: "cash",
      cashbox_type: cashboxType,
      balance_after: 1_527_500,
      payment_ack: "disputed",
      createdByUser: { id: 7, name: "Mohira Qodirova", role: "manager" },
      createdAt: today(15),
    },
    {
      id: "903",
      amount: -1_960_000,
      operation_type: "expense",
      source_type: "courier_payment",
      payment_method: "cash",
      cashbox_type: cashboxType,
      balance_after: 1_120_000,
      payment_ack: null,
      createdByUser: { id: 8, name: "Sanjar Aliqulov", role: "manager" },
      createdAt: today(25),
    },
  ],
});

/** Menejer (HQ filial) profili — kassa tafsiloti (`/payments/cash-detail/:id`) uchun. */
export const HQ_MANAGER_PROFILE = {
  branch_id: "7",
  branch_type: "HQ",
  branch: { id: "7", name: "Toshkent HQ", type: "HQ" },
};

/**
 * `GET finance/cashbox/user/:id` — kuryer kassasi tafsiloti (xodim ko'radi, maket
 * `manager-payments-cash-detail-courier-ack`): tarixdagi `courier_payment` qatorlarida `payment_ack`.
 */
export const courierCashDetailWithAck = () => ({
  cashbox: { id: "70", cashbox_type: "couriers", user_id: "263", balance: 250_000 },
  history: courierCashboxWithAck().cashboxHistory,
  user: { id: "263", name: "Bekzod Normurodov", phone_number: "+998901234567", role: "courier", status: "active" },
  is_hq_courier: true,
  can_receive: true,
  receive_check_failed: false,
  olinishi_kerak: 250_000,
  counterparty: "HQ",
});
