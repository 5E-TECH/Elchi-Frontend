import { test, type Page, type Route } from "@playwright/test";
import { setupShellSession } from "./shellSession";

/**
 * EP-3 (Elchi Pochta #3) — `/profile` «Sessiyalar» e2e: soxta `GET auth/sessions` (faqat o'z sessiyalari: 3 ta
 * faol + qayta kirishi kerak bo'lgan bitta `expired`; `active_count` — faqat faollar) va profil. Yozish so'rovlari
 * taqiqlangan (`leaked`); `sessionRequests` — sessiyalar necha marta so'ralgani.
 *
 * Sessiyalarni yopish (`mockSessionRevoke`) — gateway kabi: `DELETE auth/sessions/:id` (joriy — 400, yo'q yoki
 * yopilgan — 404, aks holda `{ revoked: 1, session_ids: [id] }`; `expired` ham), `POST auth/sessions/revoke-others`
 * (tanasiz → joriydan boshqalari, `expired` ham, `revoked: n`). `revokedHere` — shu brauzerning o'z sessiyasi
 * boshqa qurilmadan yopilgani: har API so'rovi 401 «Session revoked», `POST auth/refresh` ham 401 «Invalid refresh
 * token» (yopilgan qurilma); `refreshDeviceNames` — refresh'dagi `X-Device-Name` (URI-dekodlangan).
 *
 * Yangi qurilma cheklovi (48 soat, Telegram kabi): `locked` — ro'yxat `can_revoke_others: false` +
 * `revoke_available_at` (hozirdan 30 soat keyin) bilan keladi; `tooNew` (mock holati) — ro'yxat hali cheklovsiz,
 * lekin `DELETE` / `revoke-others` 403 `SESSION_TOO_NEW` (backend matni + `available_at`) qaytaradi va shundan
 * keyingi ro'yxat cheklov bilan keladi.
 */
const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

export const SESSIONS = {
  active_count: 3,
  sessions: [
    {
      id: "s-1",
      device_name: "Samsung SM-A515F · Android 13 · Chrome 155",
      device_id: "8d0f7a52-3c1e-4b7a-9f00-000000000001",
      user_agent: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/155.0.0.0 Mobile Safari/537.36",
      ip: "213.230.64.10",
      // Shu qurilmadan qayta kirilgan: oxirgi kirish kecha, birinchisi 9 kun oldin.
      logged_in_at: ago(26 * 60),
      first_logged_in_at: ago(9 * 24 * 60),
      last_seen_at: ago(42),
      expires_at: ago(-24 * 60),
      current: true,
      status: "active",
    },
    {
      id: "s-2",
      device_name: "Kompyuter · Windows · Edge",
      device_id: null,
      user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0",
      ip: "84.54.70.12",
      logged_in_at: ago(2 * 24 * 60 + 90),
      first_logged_in_at: ago(2 * 24 * 60 + 90),
      last_seen_at: ago(7),
      expires_at: ago(-24 * 60),
      current: false,
      status: "active",
    },
    {
      // Eski backend qatori: `status` va `first_logged_in_at` yo'q — faol, «Birinchi marta» qatorisiz.
      id: "s-3",
      device_name: null,
      device_id: null,
      user_agent: null,
      ip: null,
      logged_in_at: ago(5 * 24 * 60),
      last_seen_at: ago(3 * 24 * 60),
      expires_at: ago(-60),
      current: false,
    },
    {
      id: "s-4",
      device_name: "iPhone · iOS 17 · Safari",
      device_id: "8d0f7a52-3c1e-4b7a-9f00-000000000004",
      user_agent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile/15E148 Safari/604.1",
      ip: "213.230.64.10",
      logged_in_at: ago(20 * 24 * 60),
      first_logged_in_at: ago(40 * 24 * 60),
      last_seen_at: ago(12 * 24 * 60),
      expires_at: ago(5 * 24 * 60),
      current: false,
      status: "expired",
    },
  ] as SessionRow[],
};

type SessionRow = {
  id: string;
  device_name: string | null;
  device_id: string | null;
  user_agent: string | null;
  ip: string | null;
  logged_in_at: string;
  first_logged_in_at?: string;
  last_seen_at: string;
  expires_at: string;
  current: boolean;
  status?: "active" | "expired";
};

const isActive = (row: SessionRow) => row.status !== "expired";

/** Cheklov vaqti — hozirdan 30 soat keyin (shu qurilmadan birinchi kirishga 48 soat to'lishi). */
export const lockAvailableAt = () => new Date(Date.now() + 30 * 3_600_000).toISOString();

/** Kartadagi va xabardagi to'liq vaqt («25.10.2026, 14:30») — sahifa vaqt mintaqasida (`Asia/Tashkent`). */
export const formatLockTime = (iso: string) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Tashkent",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((part) => [part.type, part.value]),
  );
  return `${parts.day}.${parts.month}.${parts.year}, ${parts.hour}:${parts.minute}`;
};

export const openProfileWithSessions = async (
  page: Page,
  role = "courier",
  {
    revoke = false,
    locked = false,
    initial,
  }: {
    revoke?: boolean;
    locked?: boolean;
    /** `revoke` holatini sahifa ochilishidan OLDIN sozlash (masalan faqat joriy sessiya + cheklov). */
    initial?: (state: Awaited<ReturnType<typeof mockSessionRevoke>>) => void;
  } = {},
) => {
  const state = { sessionRequests: 0 };
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/auth/sessions" && request.method() === "GET") state.sessionRequests += 1;
  });
  const availableAt = locked ? lockAvailableAt() : null;
  const list = locked ? { ...SESSIONS, can_revoke_others: false, revoke_available_at: availableAt } : SESSIONS;
  const { leaked } = await setupShellSession(
    page,
    role,
    "Ali Valiyev",
    { "auth/sessions": list },
    { phone_number: "+998901234567", createdAt: "2026-01-14T09:00:00.000Z", updatedAt: "2026-10-02T09:00:00.000Z" },
  );
  const revokeState = revoke ? await mockSessionRevoke(page) : null;
  if (revokeState) initial?.(revokeState);
  await page.goto("/profile");
  return { leaked, state, revoke: revokeState, availableAt };
};

const appOrigin = () => new URL(test.info().project.use.baseURL ?? "http://127.0.0.1:4173").origin;

export const mockSessionRevoke = async (page: Page) => {
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
    sessions: SESSIONS.sessions.map((row) => ({ ...row })),
    /** Shu brauzer sessiyasi boshqa qurilmadan yopilgan — hamma narsa 401. */
    revokedHere: false,
    deletes: [] as string[],
    revokeOthers: 0,
    refreshes: 0,
    refreshDeviceNames: [] as string[],
    logouts: 0,
    /** Joriy sessiya yangi: yopish so'rovlari 403 `SESSION_TOO_NEW`, so'ng ro'yxat cheklov bilan. */
    tooNew: false,
    /** 403 dan keyin ro'yxatdagi cheklov vaqti (ISO). */
    lockedUntil: null as string | null,
    tooNewReplies: 0,
  };
  const list = () => ({
    active_count: state.sessions.filter(isActive).length,
    sessions: state.sessions,
    ...(state.lockedUntil ? { can_revoke_others: false, revoke_available_at: state.lockedUntil } : {}),
  });
  /** Gateway kontrakti: 403 + `code` + `available_at`, matnda vaqt (backend o'zi formatlaydi). */
  const tooNewReply = (route: Route) => {
    state.tooNewReplies += 1;
    state.lockedUntil = lockAvailableAt();
    return reply(
      route,
      {
        statusCode: 403,
        message: `Xavfsizlik uchun yangi qurilmadan boshqa sessiyalarni chiqarib bo'lmaydi — ${formatLockTime(state.lockedUntil)} dan keyin mumkin`,
        code: "SESSION_TOO_NEW",
        available_at: state.lockedUntil,
      },
      403,
    );
  };

  // Keyin ro'yxatdan o'tgan route avval ishlaydi — `setupShellSession` dagi umumiy ishlovchidan ustun.
  await page.context().route(/\/auth\/(sessions|refresh|logout)(\/|$)/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin) return route.continue();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace(/^\//, "");
    const method = request.method();
    if (path === "auth/refresh") {
      state.refreshes += 1;
      const name = request.headers()["x-device-name"];
      if (name) state.refreshDeviceNames.push(decodeURIComponent(name));
      return reply(route, { statusCode: 401, message: "Invalid refresh token" }, 401);
    }
    if (path === "auth/logout") {
      state.logouts += 1;
      return reply(route, { statusCode: 401, message: "Unauthorized" }, 401);
    }
    if (state.revokedHere) return reply(route, { statusCode: 401, message: "Session revoked" }, 401);
    if (path === "auth/sessions" && method === "GET") {
      return reply(route, { statusCode: 200, message: "success", data: list() });
    }
    if (path === "auth/sessions/revoke-others" && method === "POST") {
      state.revokeOthers += 1;
      if (state.tooNew) return tooNewReply(route);
      const ids = state.sessions.filter((row) => !row.current).map((row) => row.id);
      state.sessions = state.sessions.filter((row) => row.current);
      const message = ids.length ? "Boshqa sessiyalardan chiqildi" : "Boshqa faol sessiya yo'q";
      return reply(route, { statusCode: 200, message, data: { revoked: ids.length, session_ids: ids } });
    }
    const match = path.match(/^auth\/sessions\/([^/]+)$/);
    if (match && method === "DELETE") {
      const id = decodeURIComponent(match[1]);
      state.deletes.push(id);
      if (state.tooNew) return tooNewReply(route);
      const row = state.sessions.find((item) => item.id === id);
      if (!row) return reply(route, { statusCode: 404, message: "Sessiya topilmadi yoki allaqachon yopilgan" }, 404);
      if (row.current) {
        return reply(
          route,
          { statusCode: 400, message: "Joriy sessiyani bu yerdan yopib bo'lmaydi — «Chiqish» tugmasidan foydalaning" },
          400,
        );
      }
      state.sessions = state.sessions.filter((item) => item.id !== id);
      return reply(route, { statusCode: 200, message: "Sessiya yopildi", data: { revoked: 1, session_ids: [id] } });
    }
    return route.fallback();
  });
  // Yopilgan qurilma: boshqa har API so'rovi ham 401 (refresh'dan oldingi asl so'rov).
  await page.context().route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (!state.revokedHere || url.origin === origin || !/api\.elchipochta\.uz|:3004$/.test(url.host)) {
      return route.fallback();
    }
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    if (/\/auth\/(sessions|refresh|logout)(\/|$)/.test(url.pathname)) return route.fallback();
    return reply(route, { statusCode: 401, message: "Session revoked" }, 401);
  });
  return state;
};
