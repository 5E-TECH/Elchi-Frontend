import { test, type Page, type Route } from "@playwright/test";
import { setupShellSession } from "./shellSession";

/**
 * EP-3 (Elchi Pochta #3) — `/profile` «Sessiyalar» e2e: soxta `GET auth/sessions` (faqat o'z faol sessiyalari) va
 * profil. Yozish so'rovlari taqiqlangan (`leaked`); `sessionRequests` — sessiyalar necha marta so'ralgani.
 *
 * Sessiyalarni yopish (`mockSessionRevoke`) — gateway kabi: `DELETE auth/sessions/:id` (joriy — 400, yo'q yoki
 * yopilgan — 404, aks holda `{ revoked: 1, session_ids: [id] }`), `POST auth/sessions/revoke-others` (tanasiz →
 * joriydan boshqalari, `revoked: n`). `revokedHere` — shu brauzerning o'z sessiyasi boshqa qurilmadan yopilgani:
 * har API so'rovi 401, `POST auth/refresh` ham 401 (yopilgan qurilma oqimi).
 */
const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

export const SESSIONS = {
  active_count: 3,
  sessions: [
    {
      id: "s-2",
      device_name: "Kompyuter · Windows · Edge",
      device_id: null,
      user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0",
      ip: "84.54.70.12",
      logged_in_at: ago(2 * 24 * 60 + 90),
      last_seen_at: ago(7),
      expires_at: ago(-24 * 60),
      current: false,
    },
    {
      id: "s-1",
      device_name: "Telefon · Android · Chrome",
      device_id: null,
      user_agent: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36",
      ip: "213.230.64.10",
      logged_in_at: ago(26 * 60),
      last_seen_at: ago(42),
      expires_at: ago(-24 * 60),
      current: true,
    },
    {
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
  ],
};

export const openProfileWithSessions = async (page: Page, role = "courier", { revoke = false } = {}) => {
  const state = { sessionRequests: 0 };
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/auth/sessions" && request.method() === "GET") state.sessionRequests += 1;
  });
  const { leaked } = await setupShellSession(
    page,
    role,
    "Ali Valiyev",
    { "auth/sessions": SESSIONS },
    { phone_number: "+998901234567", createdAt: "2026-01-14T09:00:00.000Z", updatedAt: "2026-10-02T09:00:00.000Z" },
  );
  const revokeState = revoke ? await mockSessionRevoke(page) : null;
  await page.goto("/profile");
  return { leaked, state, revoke: revokeState };
};

type SessionRow = (typeof SESSIONS.sessions)[number];

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
    sessions: SESSIONS.sessions.map((row) => ({ ...row })) as SessionRow[],
    /** Shu brauzer sessiyasi boshqa qurilmadan yopilgan — hamma narsa 401. */
    revokedHere: false,
    deletes: [] as string[],
    revokeOthers: 0,
    refreshes: 0,
    logouts: 0,
  };
  const list = () => ({ active_count: state.sessions.length, sessions: state.sessions });

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
      return reply(route, { statusCode: 401, message: "Sessiya yopilgan", error: "Unauthorized" }, 401);
    }
    if (path === "auth/logout") {
      state.logouts += 1;
      return reply(route, { statusCode: 401, message: "Unauthorized" }, 401);
    }
    if (state.revokedHere) return reply(route, { statusCode: 401, message: "Sessiya yopilgan" }, 401);
    if (path === "auth/sessions" && method === "GET") {
      return reply(route, { statusCode: 200, message: "success", data: list() });
    }
    if (path === "auth/sessions/revoke-others" && method === "POST") {
      state.revokeOthers += 1;
      const ids = state.sessions.filter((row) => !row.current).map((row) => row.id);
      state.sessions = state.sessions.filter((row) => row.current);
      return reply(route, { statusCode: 200, message: "Boshqa sessiyalar yopildi", data: { revoked: ids.length, session_ids: ids } });
    }
    const match = path.match(/^auth\/sessions\/([^/]+)$/);
    if (match && method === "DELETE") {
      const id = decodeURIComponent(match[1]);
      state.deletes.push(id);
      const row = state.sessions.find((item) => item.id === id);
      if (!row) return reply(route, { statusCode: 404, message: "Sessiya topilmadi yoki allaqachon yopilgan" }, 404);
      if (row.current) return reply(route, { statusCode: 400, message: "Joriy sessiyani bu yerdan yopib bo'lmaydi" }, 400);
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
    return reply(route, { statusCode: 401, message: "Sessiya yopilgan" }, 401);
  });
  return state;
};
