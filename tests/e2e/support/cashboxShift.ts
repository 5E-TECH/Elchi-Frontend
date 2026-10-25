import { test, type Page, type Route } from "@playwright/test";

/**
 * CB-2 e2e yordamchisi — kassa smenasi qulfi (menejer «To'lovlar», kassa tafsiloti). Soxta gateway:
 *  - `GET finance/shift/current` — smena yo'q (`shift: null`) `POST finance/shift/open` gacha, keyin ochiq smena;
 *  - `POST finance/shift/open` — tanasi yoziladi (`opens`), javob — ochiq smena;
 *  - `GET finance/cashbox/main` — ochish oynasidagi jonli qoldiq (naqd 1 200 000, karta 300 000);
 *  - boshqa yozish so'rovlari taqiqlangan (`leaked`), qolgan GET'lar bo'sh ro'yxat.
 */
const appOrigin = () => new URL(test.info().project.use.baseURL ?? "http://127.0.0.1:4173").origin;
const wrap = (data: unknown) => ({ statusCode: 200, message: "ok", data });

export const REGIONAL_MANAGER_PROFILE = {
  branch_id: "16",
  branch_type: "REGIONAL",
  branch: { id: "16", name: "Urgut filiali", type: "REGIONAL" },
};

/** `GET finance/cashbox/user/209?cashbox_type=couriers` — filial kuryeri kassasi. */
const courierCashbox = {
  cashbox: { id: "60", cashbox_type: "couriers", user_id: "209", balance: 1280000 },
  history: [],
  user: { id: "209", name: "Bekzod Normurodov", phone_number: "+998902145508", role: "courier" },
};

export const mockCashboxShift = async (
  page: Page,
  role: "manager" | "superadmin",
  profile: Record<string, unknown> = {},
) => {
  const origin = appOrigin();
  const cors = {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  };
  const reply = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
  const state = {
    shift: null as Record<string, unknown> | null,
    opens: [] as unknown[],
    leaked: [] as string[],
  };

  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin) return route.continue();
    if (!/api\.elchipochta\.uz|:3004$/.test(url.host)) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    const name = role === "manager" ? "Ravshan Ortiqov" : "Bosh admin";

    if (path === "auth/my-profile") return reply(route, wrap({ id: "42", role, name, status: "active", ...profile }));
    if (path === "notifications/inbox/unread-count") return reply(route, wrap({ unread: 0 }));
    if (path === "finance/shift/open" && request.method() === "POST") {
      state.opens.push(request.postDataJSON());
      state.shift = { id: "91", status: "open", opened_by: "42", opened_at: new Date().toISOString() };
      return reply(route, wrap(state.shift), 201);
    }
    if (request.method() !== "GET") {
      state.leaked.push(`${request.method()} ${path}`);
      return reply(route, { message: "e2e: yozish taqiqlangan" }, 403);
    }
    if (path === "finance/shift/current") return reply(route, wrap({ shift: state.shift, required: true }));
    if (path === "finance/cashbox/main") {
      return reply(route, wrap({ cashbox: { id: "1", balance: 1500000, balance_cash: 1200000, balance_card: 300000 } }));
    }
    if (path === "finance/cashbox/user/209") return reply(route, wrap(courierCashbox));
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
  return state;
};
